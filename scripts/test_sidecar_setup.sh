#!/bin/bash
# Script to test the sidecar setup for Tauri

set -e

echo "Testing the WebSocket sidecar setup for Tauri"

# Determine the OS and architecture
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        TARGET_TRIPLE="aarch64-apple-darwin"
    else
        TARGET_TRIPLE="x86_64-apple-darwin"
    fi
    SOURCE_EXECUTABLE="todoforai-edge-sidecar"
    TARGET_EXECUTABLE="todoforai-edge-sidecar-$TARGET_TRIPLE"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
    TARGET_TRIPLE="x86_64-pc-windows-msvc"
    SOURCE_EXECUTABLE="todoforai-edge-sidecar.exe"
    TARGET_EXECUTABLE="todoforai-edge-sidecar-$TARGET_TRIPLE.exe"
else
    OS="linux"
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        TARGET_TRIPLE="x86_64-unknown-linux-gnu"
    elif [[ "$ARCH" == "aarch64" ]]; then
        TARGET_TRIPLE="aarch64-unknown-linux-gnu"
    else
        TARGET_TRIPLE="$ARCH-unknown-linux-gnu"
    fi
    SOURCE_EXECUTABLE="todoforai-edge-sidecar"
    TARGET_EXECUTABLE="todoforai-edge-sidecar-$TARGET_TRIPLE"
fi

echo "Operating system: $OS"
echo "Architecture: $ARCH"
echo "Target triple: $TARGET_TRIPLE"
echo "Source executable: $SOURCE_EXECUTABLE"
echo "Target executable: $TARGET_EXECUTABLE"

# Clean up any existing files
echo "Cleaning up existing files..."
rm -rf dist
rm -rf edge_frontend/src-tauri/binaries

# Build the executable
echo "Building the executable..."
python3 build_executable.py

# Check if the executable was built
if [ ! -f "dist/$SOURCE_EXECUTABLE" ]; then
    echo "Error: Failed to build the executable"
    exit 1
fi

# Create the binaries directory
mkdir -p "edge_frontend/src-tauri/binaries"

# Copy the executable with the correct target triple
echo "Copying the executable with the correct target triple..."
cp "dist/$SOURCE_EXECUTABLE" "edge_frontend/src-tauri/binaries/$TARGET_EXECUTABLE"

# Make it executable on Unix-like systems
if [[ "$OS" != "windows" ]]; then
    chmod +x "edge_frontend/src-tauri/binaries/$TARGET_EXECUTABLE"
fi

echo "Sidecar executable is now available at: edge_frontend/src-tauri/binaries/$TARGET_EXECUTABLE"
echo "This is the correct location and naming for Tauri to find it as a sidecar."
echo ""
echo "To build the Tauri application, run:"
echo "  cd edge_frontend && npm run tauri build"
echo ""
echo "All tests passed!"