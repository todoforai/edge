#!/bin/bash
# Script to copy the compiled WebSocket sidecar to the Tauri binaries directory

set -e

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

# Source directory
SOURCE_DIR="./dist"
# Destination directory - for external binaries
DEST_DIR="./edge_frontend/src-tauri/binaries"

# Check if the executable exists
if [ ! -f "${SOURCE_DIR}/${SOURCE_EXECUTABLE}" ]; then
    echo "Warning: Executable not found at ${SOURCE_DIR}/${SOURCE_EXECUTABLE}"
    echo "Building the executable now..."
    python3 build_executable.py
    
    # Check again after building
    if [ ! -f "${SOURCE_DIR}/${SOURCE_EXECUTABLE}" ]; then
        echo "Error: Failed to build the executable"
        echo "Continuing without the executable - will use Python script at runtime"
    fi
fi

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Copy the executable if it exists
if [ -f "${SOURCE_DIR}/${SOURCE_EXECUTABLE}" ]; then
    echo "Copying ${SOURCE_EXECUTABLE} to ${DEST_DIR}/${TARGET_EXECUTABLE}..."
    cp "${SOURCE_DIR}/${SOURCE_EXECUTABLE}" "${DEST_DIR}/${TARGET_EXECUTABLE}"

    # Make it executable on Unix-like systems
    if [[ "$OS" != "windows" ]]; then
        chmod +x "${DEST_DIR}/${TARGET_EXECUTABLE}"
    fi
    
    echo "Done! The WebSocket sidecar executable is now available for Tauri as an external binary."
else
    echo "Note: No executable was copied. The application will use the Python script at runtime."
fi

echo "Setup complete!"