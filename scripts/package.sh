#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-build}"

mkdir -p "$OUT_DIR"

echo "Packaging artifacts in $OUT_DIR..."
echo "TODO: Invoke platform-specific packagers (NSIS, DMG, AppImage)"
