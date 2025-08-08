#!/usr/bin/env bash
# download_logos.sh - Download brand logos

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGOS_DIR="$(dirname "$SCRIPT_DIR")/public/logos"
TOKEN="pk_cbL_8xTEQniWuLMp4Wh3wQ"

mkdir -p "$LOGOS_DIR"

declare -A LOGOS=(
    ["gmail"]="gmail.com"
    ["stripe"]="stripe.com"
    ["spotify"]="spotify.com"
    ["brave"]="brave.com"
    ["airtable"]="airtable.com"
    ["puppeteer"]="pptr.dev"
    ["pdf-filler"]="adobe.com"
    ["weather"]="accuweather.com"
)

echo "📥 Downloading logos..."

for name in "${!LOGOS[@]}"; do
    domain="${LOGOS[$name]}"
    file="$LOGOS_DIR/${name}.png"
    url="https://img.logo.dev/${domain}?token=${TOKEN}&format=png&size=256"
    
    if curl -sf -o "$file" "$url" && [[ -s "$file" ]]; then
        echo "✅ $name"
    else
        echo "❌ $name"
    fi
done

echo "Done! Check: $LOGOS_DIR"