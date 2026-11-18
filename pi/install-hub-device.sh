#!/usr/bin/env bash
# Install the localhost device helper (Wi-Fi restart) for the kiosk.
# Safe to run more than once. Run as the kiosk user (not root).
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as the kiosk user (it uses sudo where needed), not as root." >&2
  exit 1
fi

KIOSK_USER="$(id -un)"
HOME_DIR="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
TOOLS="$HOME_DIR/hub-kiosk-tools"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Prefer files next to this script; fall back to /tmp copies from deploy scp.
src() {
  local name="$1"
  if [ -f "$SCRIPT_DIR/hub-device/$name" ]; then
    echo "$SCRIPT_DIR/hub-device/$name"
  elif [ -f "$SCRIPT_DIR/$name" ]; then
    echo "$SCRIPT_DIR/$name"
  elif [ -f "/tmp/hub-device/$name" ]; then
    echo "/tmp/hub-device/$name"
  elif [ -f "/tmp/$name" ]; then
    echo "/tmp/$name"
  else
    echo "Missing $name (looked in $SCRIPT_DIR and /tmp)" >&2
    exit 1
  fi
}

mkdir -p "$TOOLS"
install -m 755 "$(src restart-wifi.sh)" "$TOOLS/restart-wifi.sh"
install -m 755 "$(src hub-device.py)" "$TOOLS/hub-device.py"

# Sudoers: only this script, NOPASSWD.
SUDOERS_SRC="$(src hub-device.sudoers)"
TMP_SUDOERS="$(mktemp)"
sed "s/__KIOSK_USER__/$KIOSK_USER/g" "$SUDOERS_SRC" >"$TMP_SUDOERS"
sudo install -m 440 "$TMP_SUDOERS" /etc/sudoers.d/hub-device
rm -f "$TMP_SUDOERS"
sudo visudo -cf /etc/sudoers.d/hub-device >/dev/null

# Systemd unit — rewrite User/paths for this account.
UNIT_SRC=""
if [ -f "$SCRIPT_DIR/systemd/hub-device.service" ]; then
  UNIT_SRC="$SCRIPT_DIR/systemd/hub-device.service"
elif [ -f /tmp/hub-device.service ]; then
  UNIT_SRC="/tmp/hub-device.service"
elif [ -f /tmp/systemd/hub-device.service ]; then
  UNIT_SRC="/tmp/systemd/hub-device.service"
else
  echo "Missing hub-device.service" >&2
  exit 1
fi
TMP_UNIT="$(mktemp)"
sed \
  -e "s|User=danielchung|User=$KIOSK_USER|" \
  -e "s|/home/danielchung/hub-kiosk-tools|$TOOLS|g" \
  "$UNIT_SRC" >"$TMP_UNIT"
sudo install -m 644 "$TMP_UNIT" /etc/systemd/system/hub-device.service
rm -f "$TMP_UNIT"
sudo systemctl daemon-reload
sudo systemctl enable --now hub-device.service
sudo systemctl restart hub-device.service

# Refresh Caddyfile so /api/device is proxied (idempotent install).
CADDY_SRC=""
if [ -f "$SCRIPT_DIR/caddy/Caddyfile" ]; then
  CADDY_SRC="$SCRIPT_DIR/caddy/Caddyfile"
elif [ -f /tmp/Caddyfile ]; then
  CADDY_SRC="/tmp/Caddyfile"
elif [ -f /tmp/caddy/Caddyfile ]; then
  CADDY_SRC="/tmp/caddy/Caddyfile"
fi
if [ -n "$CADDY_SRC" ]; then
  sudo install -m 644 "$CADDY_SRC" /etc/caddy/Caddyfile
  sudo systemctl reload caddy || sudo systemctl restart caddy
fi

echo "hub-device installed. Health: curl -s http://127.0.0.1:8788/health"
