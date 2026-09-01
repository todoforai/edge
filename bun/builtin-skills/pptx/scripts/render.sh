#!/usr/bin/env bash
# Render a deck to PNG thumbnails for visual verification.
# Usage: render.sh <file.pptx|file.docx> [outdir]
set -euo pipefail
f="$1"; out="${2:-$(dirname "$f")/render_$(basename "${f%.*}")}"
command -v soffice >/dev/null || { echo "error: soffice (LibreOffice) not found" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# Isolated profile avoids lock contention with a running LibreOffice.
if ! soffice "-env:UserInstallation=file://$tmp/lo" --headless --convert-to pdf --outdir "$tmp" "$f" >"$tmp/lo.log" 2>&1; then
  cat "$tmp/lo.log" >&2; exit 1
fi
pdf="$tmp/$(basename "${f%.*}").pdf"
[ -f "$pdf" ] || { echo "error: conversion produced no PDF" >&2; cat "$tmp/lo.log" >&2; exit 1; }

rm -rf "$out"; mkdir -p "$out"
cp "$pdf" "$out/"
if command -v pdftoppm >/dev/null; then
  pdftoppm -png -r 60 "$pdf" "$out/slide"
  echo "rendered: $(find "$out" -name 'slide*.png' | wc -l) pages -> $out/"
else
  echo "rendered pdf only: $out/$(basename "$pdf") (pdftoppm not found)"
fi
