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

## ── copy & label base image ───────────────────────────────────────────────────
cp "$ORIGINAL_ICON" "$TARGET_ICON"
python3 "$SCRIPT_DIR/add_edge_text.py" "$TARGET_ICON"

## ── helper: write RGBA icon(s) in one shot ────────────────────────────────────
mkpng() {   # mkpng SIZE OUTPUT
  convert "$TARGET_ICON" -resize "$1"x"$1" -background none -alpha on PNG32:"$2"
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

popd >/dev/null

## ── favicon for the web front-end ─────────────────────────────────────────────
mkpng 256 "$PUBLIC_ICON"

## ── Windows .ico (multi-size) ─────────────────────────────────────────────────
convert "$TARGET_ICON" -alpha on -background none \
        -define icon:auto-resize=16,32,48,64,128,256 PNG32:"$ICO_PATH"

## ── macOS .icns ───────────────────────────────────────────────────────────────
TMP=$(mktemp -d)
mkdir -p "$TMP/icon.iconset"
for s in 16 32 128 256 512 1024; do
  mkpng "$s" "$TMP/icon.iconset/icon_${s}x${s}.png"
done
if command -v iconutil &>/dev/null; then
  iconutil -c icns "$TMP/icon.iconset" -o "$ICNS_PATH"
else
  # minimal fallback – single-res ICNS
  convert "$TMP/icon.iconset/icon_512x512.png" PNG32:"$ICNS_PATH"
fi
rm -rf "$TMP"

## ── verify everything is RGBA8 ────────────────────────────────────────────────
echo "🔍 Verifying channel layout & bit depth…"
bad=0
for f in "$TAURI_DIR"/icons/*.png "$PUBLIC_ICON"; do
  meta=$(identify -format '%r' "$f")     # e.g. "RGBA 8-bit"
  case "$meta" in
    *"RGBA 8-bit"*) : ;;
    *) echo "⚠️  $f is $meta – re-encoding"; mkpng "$(identify -format '%w' "$f")" "$f" ;;
  esac
done

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