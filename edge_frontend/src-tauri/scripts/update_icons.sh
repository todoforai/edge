#!/usr/bin/env bash
# update_icons.sh – regenerate all Tauri icon assets in guaranteed RGBA8 format.

set -euo pipefail

## ── locate folders ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$TAURI_DIR")"
PROJECT_ROOT="$(dirname "$FRONTEND_DIR")"

## ── source & target paths ─────────────────────────────────────────────────────
ORIGINAL_ICON="$TAURI_DIR/../public/todoforai_original_icon.png"
TARGET_ICON="$TAURI_DIR/icons/Square310x310Logo.png"

ICO_PATH="$TAURI_DIR/icons/icon.ico"
ICNS_PATH="$TAURI_DIR/icons/icon.icns"
PUBLIC_ICON="$FRONTEND_DIR/public/favicon.png"

## ── sanity check ──────────────────────────────────────────────────────────────
[[ -f "$ORIGINAL_ICON" ]] || { echo "❌ $ORIGINAL_ICON not found." ; exit 1; }

## ── create base image with Edge text ─────────────────────────────────────────
# Let Python handle both copying and adding text
echo "Updating icons with 'Edge' text..."
echo python3 "$SCRIPT_DIR/add_edge_text.py" "$ORIGINAL_ICON" "$TARGET_ICON"
python3 "$SCRIPT_DIR/add_edge_text.py" "$ORIGINAL_ICON" "$TARGET_ICON"

## ── helper: write RGBA icon(s) in one shot ────────────────────────────────────
mkpng() {   # mkpng SIZE OUTPUT
  convert "$TARGET_ICON" -resize "$1"x"$1" -background none -alpha on \
          -define png:color-type=6 -define png:bit-depth=8 \
          -define png:exclude-chunk=time PNG32:"$2"
}

## ── raster variants (all RGBA8) ───────────────────────────────────────────────
echo "🖼  Generating PNG variants…"
pushd "$TAURI_DIR/icons" >/dev/null

mkpng 32   32x32.png
mkpng 128  128x128.png
mkpng 256  128x128@2x.png   # Windows naming quirk
mkpng 256  icon.png

# Windows Store set
for s in 30 44 71 89 107 142 150 284 310; do
  mkpng "$s" "Square${s}x${s}Logo.png"
done

# Ensure StoreLogo.png exists (sometimes required by Tauri)
mkpng 50 StoreLogo.png

popd >/dev/null

## ── favicon for the web front-end ─────────────────────────────────────────────
mkpng 256 "$PUBLIC_ICON"

## ── Windows .ico (multi-size) - FIXED for Windows resource compiler ────────────
echo "Creating Windows ICO file (compatible with rc.exe)..."
# Create Windows-compatible ICO using ImageMagick with -compress none
# This is the most reliable method across platforms
echo "Using ImageMagick to create Windows-compatible ICO file"
convert "$TARGET_ICON" -alpha on -background none \
        -define icon:auto-resize=16,24,32,48,64,128,256 \
        -compress none "$ICO_PATH"

## ── macOS .icns ───────────────────────────────────────────────────────────────
TMP=$(mktemp -d)
echo "$TMP"
mkdir -p "$TMP/icon.iconset"

# Create all the required sizes for macOS iconset
# Standard sizes
mkpng 16  "$TMP/icon.iconset/icon_16x16.png"
mkpng 32  "$TMP/icon.iconset/icon_16x16@2x.png"
mkpng 32  "$TMP/icon.iconset/icon_32x32.png"
mkpng 64  "$TMP/icon.iconset/icon_32x32@2x.png"
mkpng 64  "$TMP/icon.iconset/icon_64x64.png"
mkpng 128 "$TMP/icon.iconset/icon_128x128.png"
mkpng 256 "$TMP/icon.iconset/icon_128x128@2x.png"
mkpng 256 "$TMP/icon.iconset/icon_256x256.png"
mkpng 512 "$TMP/icon.iconset/icon_256x256@2x.png"
mkpng 512 "$TMP/icon.iconset/icon_512x512.png"
mkpng 1024 "$TMP/icon.iconset/icon_512x512@2x.png"

# Check for iconutil (macOS) or png2icns (Linux)
if command -v iconutil &>/dev/null; then
  # macOS native tool
  echo "Using macOS iconutil to create .icns file"
  iconutil -c icns "$TMP/icon.iconset" -o "$ICNS_PATH"
elif command -v png2icns &>/dev/null; then
  # Linux equivalent
  echo "Using Linux png2icns to create .icns file"
  png2icns "$ICNS_PATH" \
           "$TMP/icon.iconset/icon_16x16.png" \
           "$TMP/icon.iconset/icon_32x32.png" \
           "$TMP/icon.iconset/icon_128x128.png" \
           "$TMP/icon.iconset/icon_256x256.png" \
           "$TMP/icon.iconset/icon_512x512.png"
else
  # Check if we're on Linux
  if [[ "$(uname)" == "Linux" ]]; then
    echo "⚠️  For better .icns generation on Linux, install png2icns:"
    echo "    sudo apt update && sudo apt install icnsutils"
  fi
  
  # Fallback method using ImageMagick
  echo "Using ImageMagick fallback to create .icns file (less efficient)"
  convert "$TMP/icon.iconset/icon_512x512.png" -define png:exclude-chunk=time PNG32:"$ICNS_PATH"
fi

rm -rf "$TMP"
# Update the index.html to use the new favicon
INDEX_HTML="$FRONTEND_DIR/index.html"
if [ -f "$INDEX_HTML" ]; then
    # Check if favicon link already exists
    if grep -q "<link rel=\"icon\" type=\"image/png\" href=\"/favicon.png\"" "$INDEX_HTML"; then
        echo "Favicon link already exists in index.html"
    else
        # Add favicon link to head section
        echo "Adding favicon link to index.html"
        sed -i 's/<head>/<head>\n    <link rel="icon" type="image\/png" href="\/favicon.png" \/>/' "$INDEX_HTML"
    fi
fi

echo "✅ Icon set ready – happy building!"