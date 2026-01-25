#!/bin/bash
# Sync shared packages from ../../packages into src/shared/
# Run this after pulling changes to packages or adding/removing files

set -e
cd "$(dirname "$0")/.."

echo "Syncing shared packages..."
rm -rf src/shared/fe src/shared/fbe src/shared/fer
mkdir -p src/shared
cp -al ../../packages/shared-fe/src src/shared/fe
cp -al ../../packages/shared-fbe/src src/shared/fbe
cp -al ../../packages/shared-fer/src src/shared/fer
echo "Done."
