#!/bin/bash
# Script to update icons with "Edge" text and copy to appropriate locations

set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$TAURI_DIR")"
PROJECT_ROOT="$(dirname "$FRONTEND_DIR")"

# Path to the original icon
ORIGINAL_ICON_PATH="$TAURI_DIR/../public/todoforai_original_icon.png"
# Path to the target icon
TARGET_ICON_PATH="$TAURI_DIR/icons/Square310x310Logo.png"
# Path to the .ico file
ICO_PATH="$TAURI_DIR/icons/icon.ico"
# Path to the .icns file
ICNS_PATH="$TAURI_DIR/icons/icon.icns"

# Check if the original icon exists
if [ ! -f "$ORIGINAL_ICON_PATH" ]; then
    echo "Error: Original icon not found at $ORIGINAL_ICON_PATH"
    exit 1
fi

# Make a copy of the original icon to work with
echo "Creating a copy of the original icon..."
cp "$ORIGINAL_ICON_PATH" "$TARGET_ICON_PATH"

# Run the Python script to add "Edge" text
echo "Adding 'Edge' text to icon..."
python3 "$SCRIPT_DIR/add_edge_text.py" "$TARGET_ICON_PATH"

# Copy the modified icon to the public directory for web use
PUBLIC_ICON_PATH="$FRONTEND_DIR/public/favicon.png"
echo "Copying modified icon to $PUBLIC_ICON_PATH"
cp "$TARGET_ICON_PATH" "$PUBLIC_ICON_PATH"

# Using ImageMagick for icon generation
echo "Using ImageMagick for icon generation..."

# Create standard PNG icons
convert "$TARGET_ICON_PATH" -resize 32x32 "$TAURI_DIR/icons/32x32.png"
convert "$TARGET_ICON_PATH" -resize 128x128 "$TAURI_DIR/icons/128x128.png"
convert "$TARGET_ICON_PATH" -resize 256x256 "$TAURI_DIR/icons/128x128@2x.png"
convert "$TARGET_ICON_PATH" -resize 256x256 "$TAURI_DIR/icons/icon.png"

# Create Windows Store icons
convert "$TARGET_ICON_PATH" -resize 30x30 "$TAURI_DIR/icons/Square30x30Logo.png"
convert "$TARGET_ICON_PATH" -resize 44x44 "$TAURI_DIR/icons/Square44x44Logo.png"
convert "$TARGET_ICON_PATH" -resize 71x71 "$TAURI_DIR/icons/Square71x71Logo.png"
convert "$TARGET_ICON_PATH" -resize 89x89 "$TAURI_DIR/icons/Square89x89Logo.png"
convert "$TARGET_ICON_PATH" -resize 107x107 "$TAURI_DIR/icons/Square107x107Logo.png"
convert "$TARGET_ICON_PATH" -resize 142x142 "$TAURI_DIR/icons/Square142x142Logo.png"
convert "$TARGET_ICON_PATH" -resize 150x150 "$TAURI_DIR/icons/Square150x150Logo.png"
convert "$TARGET_ICON_PATH" -resize 284x284 "$TAURI_DIR/icons/Square284x284Logo.png"
# Square310x310Logo.png is already created

# Create Windows ICO file (combines multiple sizes)
convert "$TARGET_ICON_PATH" -define icon:auto-resize=16,32,48,64,128,256 "$ICO_PATH"

# Create macOS ICNS file
# First create temporary directory with required sizes
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/icon.iconset"

# Generate the required sizes for ICNS
convert "$TARGET_ICON_PATH" -resize 16x16 "$TEMP_DIR/icon.iconset/icon_16x16.png"
convert "$TARGET_ICON_PATH" -resize 32x32 "$TEMP_DIR/icon.iconset/icon_16x16@2x.png"
convert "$TARGET_ICON_PATH" -resize 32x32 "$TEMP_DIR/icon.iconset/icon_32x32.png"
convert "$TARGET_ICON_PATH" -resize 64x64 "$TEMP_DIR/icon.iconset/icon_32x32@2x.png"
convert "$TARGET_ICON_PATH" -resize 128x128 "$TEMP_DIR/icon.iconset/icon_128x128.png"
convert "$TARGET_ICON_PATH" -resize 256x256 "$TEMP_DIR/icon.iconset/icon_128x128@2x.png"
convert "$TARGET_ICON_PATH" -resize 256x256 "$TEMP_DIR/icon.iconset/icon_256x256.png"
convert "$TARGET_ICON_PATH" -resize 512x512 "$TEMP_DIR/icon.iconset/icon_256x256@2x.png"
convert "$TARGET_ICON_PATH" -resize 512x512 "$TEMP_DIR/icon.iconset/icon_512x512.png"
convert "$TARGET_ICON_PATH" -resize 1024x1024 "$TEMP_DIR/icon.iconset/icon_512x512@2x.png"

# Check if iconutil is available (macOS)
if command -v iconutil &> /dev/null; then
    # Convert iconset to icns using iconutil (macOS only)
    iconutil -c icns "$TEMP_DIR/icon.iconset" -o "$ICNS_PATH"
else
    # Alternative method using ImageMagick for Linux
    echo "iconutil not found, using ImageMagick to create ICNS file"
    convert "$TEMP_DIR/icon.iconset/icon_16x16.png" \
            "$TEMP_DIR/icon.iconset/icon_32x32.png" \
            "$TEMP_DIR/icon.iconset/icon_128x128.png" \
            "$TEMP_DIR/icon.iconset/icon_256x256.png" \
            "$TEMP_DIR/icon.iconset/icon_512x512.png" \
            "$ICNS_PATH"
fi

# Clean up temporary directory
rm -rf "$TEMP_DIR"

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

echo "Icon update complete!"