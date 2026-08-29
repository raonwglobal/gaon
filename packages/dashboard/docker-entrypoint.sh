#!/bin/sh
set -e
HTML_ROOT="${HTML_ROOT:-/usr/share/nginx/html}"
CONFIG_PATH="${HTML_ROOT}/config.json"
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\n\r'
}
CONTROL_API_BASE_ESC=$(json_escape "${CONTROL_API_BASE:-}")
cat > "$CONFIG_PATH" <<JSON
{
  "controlApiBase": "${CONTROL_API_BASE_ESC}"
}
JSON
echo "[dashboard] wrote ${CONFIG_PATH} (no secrets)"
exec nginx -g "daemon off;"
