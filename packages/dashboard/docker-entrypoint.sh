#!/bin/sh
set -e
HTML_ROOT="${HTML_ROOT:-/usr/share/nginx/html}"
CONFIG_PATH="${HTML_ROOT}/config.json"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/	/\\t/g' | tr -d '\n\r'
}

ADMIN_TOKEN_ESC=$(json_escape "${ADMIN_TOKEN:-}")
CONTROL_API_BASE_ESC=$(json_escape "${CONTROL_API_BASE:-}")

cat > "$CONFIG_PATH" <<JSON
{
  "adminToken": "${ADMIN_TOKEN_ESC}",
  "controlApiBase": "${CONTROL_API_BASE_ESC}"
}
JSON

if [ -n "${ADMIN_TOKEN:-}" ]; then
  echo "[dashboard] wrote ${CONFIG_PATH} (adminToken: set)"
else
  echo "[dashboard] wrote ${CONFIG_PATH} (adminToken: empty)"
fi

exec nginx -g "daemon off;"
