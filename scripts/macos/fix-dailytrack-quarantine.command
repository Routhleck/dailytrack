#!/bin/bash
set -euo pipefail

APP_PATH="${1:-/Applications/dailytrack.app}"

echo "dailytrack macOS quarantine helper"
echo "Target app: $APP_PATH"
echo

if [ ! -d "$APP_PATH" ]; then
  echo "App not found at: $APP_PATH"
  echo "Usage:"
  echo "  ./fix-dailytrack-quarantine.command /path/to/dailytrack.app"
  echo
  read -r -p "Press Enter to exit..."
  exit 1
fi

echo "Removing quarantine attribute..."
xattr -dr com.apple.quarantine "$APP_PATH"

echo "Done. Trying to open app..."
open "$APP_PATH" || true

echo
echo "Success. You can now launch dailytrack normally."
read -r -p "Press Enter to exit..."
