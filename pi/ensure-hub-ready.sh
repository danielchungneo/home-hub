#!/usr/bin/env bash
# Fix hub file modes and wait until Caddy serves real JS (not the SPA HTML fallback).
# Windows scp often leaves /var/www/hub/assets as drwx------; Caddy then cannot read
# assets and try_files returns index.html for every /assets/* URL → white kiosk screen.
# Safe to run from tty1 autologin before cage/chromium. Always exits 0.

HUB="${HUB_ROOT:-/var/www/hub}"
BASE="${HUB_URL:-http://127.0.0.1}"

if [ -d "$HUB" ]; then
  chmod -R a+rX "$HUB" 2>/dev/null || true
fi

for _ in $(seq 1 45); do
  if curl -fsS -o /dev/null "$BASE/" 2>/dev/null; then
    js=""
    if [ -f "$HUB/index.html" ]; then
      js=$(grep -oE '/assets/[^"]+\.js' "$HUB/index.html" | head -1 || true)
    fi
    if [ -n "$js" ]; then
      # Pipe-delimited so content-type values with spaces/semicolons don't break parsing.
      meta=$(curl -fsS -o /dev/null -w '%{http_code}|%{content_type}|%{size_download}' "$BASE$js" 2>/dev/null || true)
      code=${meta%%|*}
      rest=${meta#*|}
      ctype=${rest%%|*}
      size=${rest##*|}
      if [ "$code" = "200" ] && [ "${size:-0}" -gt 1000 ] 2>/dev/null && ! echo "$ctype" | grep -qi 'html'; then
        exit 0
      fi
      # Retry chmod in case a deploy just landed mid-wait.
      chmod -R a+rX "$HUB" 2>/dev/null || true
    fi
  fi
  sleep 1
done

exit 0
