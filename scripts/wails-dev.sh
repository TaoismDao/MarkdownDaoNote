#!/usr/bin/env bash
set -euo pipefail

# Ensure Wails uses an executable temp directory (some /tmp mounts on Windows/WSL are noexec).
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
TEMP_DIR="$PROJECT_ROOT/.tmp/wails"

mkdir -p "$TEMP_DIR"
export TMPDIR="$TEMP_DIR"

exec wails dev "$@"
