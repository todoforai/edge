#!/usr/bin/env bash
# Bash wrapper for Windows code signing (both EXE and MSI files)
set -eo pipefail

# Function to show usage
show_usage() {
  echo "Usage: $0 <path-to-file>"
  echo "Supports signing both .exe and .msi files"
  exit 1
}

# Check if a file was provided
if [ -z "$1" ]; then
  show_usage
fi

FILE_PATH="$1"
if [ ! -f "$FILE_PATH" ]; then
  echo "Error: File $FILE_PATH not found"
  exit 1
fi

# Check if we're on Windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # Determine file type and call appropriate PowerShell script
  if [[ "$FILE_PATH" == *.exe ]]; then
    echo "Signing EXE file on Windows..."
    powershell.exe -ExecutionPolicy Bypass -File "$(dirname "$0")/sign_exe.ps1" -ExePath "$FILE_PATH" -Thumbprint "${WINDOWS_CERT_THUMBPRINT:-}"
  elif [[ "$FILE_PATH" == *.msi ]]; then
    echo "Signing MSI file on Windows..."
    powershell.exe -ExecutionPolicy Bypass -File "$(dirname "$0")/sign_msi.ps1" -MsiPath "$FILE_PATH" -Thumbprint "${WINDOWS_CERT_THUMBPRINT:-}"
  else
    echo "Error: Unsupported file type. Only .exe and .msi files are supported."
    exit 1
  fi
else
  echo "Warning: Code signing is only supported on Windows"
  exit 0
fi