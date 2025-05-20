#!/usr/bin/env bash
# Script to sign .deb packages for TodoForAI Edge
set -eo pipefail

# Check if a .deb file was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-deb-file>"
  exit 1
fi

DEB_FILE="$1"
if [ ! -f "$DEB_FILE" ]; then
  echo "Error: File $DEB_FILE not found"
  exit 1
fi

# Install dependencies if needed
if ! command -v dpkg-sig &> /dev/null; then
  echo "Installing dpkg-sig..."
  sudo apt-get update -qq
  sudo apt-get install -y dpkg-sig
fi

# Check if GPG key exists or needs to be created
if [ -n "$GPG_PRIVATE_KEY" ]; then
  # Import key from environment variable
  echo "Importing GPG key from environment..."
  echo "$GPG_PRIVATE_KEY" | gpg --batch --import
  
  # Get the key ID
  KEY_ID=$(gpg --list-secret-keys --with-colons | awk -F: '/^sec:/ {print $5; exit}')
  
  if [ -z "$KEY_ID" ]; then
    echo "Error: Failed to import GPG key"
    exit 1
  fi
  
  echo "Using GPG key: $KEY_ID"
  
  # Sign the .deb file
  echo "Signing $DEB_FILE..."
  dpkg-sig --sign builder --key "$KEY_ID" "$DEB_FILE"
  
  # Verify the signature
  echo "Verifying signature..."
  dpkg-sig --verify "$DEB_FILE"
  
  echo "✅ Package signed successfully!"
else
  echo "Warning: No GPG key provided, skipping signing"
fi