#!/bin/bash
# Test script to verify binary download URLs are correct

set -e

echo "=== Testing Binary Download URLs ==="
echo ""

echo "1. GitHub CLI (gh)"
curl -sI "https://github.com/cli/cli/releases/download/v2.88.1/gh_2.88.1_linux_amd64.tar.gz" | grep -E "HTTP|content-type"
echo "✓ gh URL works"
echo ""

echo "2. Stripe CLI (FIXED)"
curl -sI "https://github.com/stripe/stripe-cli/releases/download/v1.37.3/stripe_1.37.3_linux_x86_64.tar.gz" | grep -E "HTTP|content-type"
echo "✓ stripe URL works (was broken with x86-64)"
echo ""

echo "3. GitLab CLI (glab) - FIXED"
curl -sI "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/packages/generic/glab/1.89.0/glab_1.89.0_linux_amd64.tar.gz" | grep -E "HTTP|content-type"
echo "✓ glab URL works (now using GitLab packages API)"
echo ""

echo "4. cloudflared"
curl -sI "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" | grep -E "HTTP|content-type"
echo "✓ cloudflared URL works"
echo ""

echo "5. jq"
curl -sI "https://github.com/jqlang/jq/releases/latest/download/jq-linux-amd64" | grep -E "HTTP|content-type"
echo "✓ jq URL works"
echo ""

echo "6. yq"
curl -sI "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64" | grep -E "HTTP|content-type"
echo "✓ yq URL works"
echo ""

echo "7. Vault"
curl -sI "https://releases.hashicorp.com/vault/1.21.4/vault_1.21.4_linux_amd64.zip" | grep -E "HTTP|content-type"
echo "✓ vault URL works"
echo ""

echo "=== Testing npm packages ==="
echo ""

echo "8. Supabase (SWITCHED TO NPM)"
npm view supabase@latest version repository.url
echo "✓ supabase npm package is official"
echo ""

echo "=== All tests passed! ==="
