#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_NAME="axel_desktop.zip"
TARGET_DIR="${ROOT_DIR}/axel_desktop"

cd "$ROOT_DIR"

if [[ ! -f "$ZIP_NAME" ]]; then
  echo "Error: ${ZIP_NAME} not found in ${ROOT_DIR}. Place the zip here before running this script." >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

unzip -q "$ZIP_NAME" -d "$TARGET_DIR"

cat <<MSG
Successfully extracted ${ZIP_NAME} into ${TARGET_DIR}.
If this zip contains the AXEL desktop source, you can now continue with the planned fixes.
MSG
