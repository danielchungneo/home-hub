#!/usr/bin/env bash
# Bounce Wi-Fi on the kiosk Pi. Invoked via sudo from hub-device.py only.
set -euo pipefail

IFACE="${1:-wlan0}"

if command -v nmcli >/dev/null 2>&1; then
  nmcli radio wifi off || true
  sleep 2
  nmcli radio wifi on
  sleep 2
  CONN="$(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | awk -F: -v d="$IFACE" '$2 == d { print $1; exit }' || true)"
  if [ -n "${CONN:-}" ]; then
    nmcli con up "$CONN" || true
  else
    nmcli device connect "$IFACE" || true
  fi
else
  ip link set "$IFACE" down
  sleep 1
  ip link set "$IFACE" up
  sleep 2
fi

# Soft-sleep of the Broadcom radio is a common cause of silent Wi-Fi drops.
if command -v iwconfig >/dev/null 2>&1; then
  iwconfig "$IFACE" power off || true
elif command -v iw >/dev/null 2>&1; then
  iw dev "$IFACE" set power_save off || true
fi

# Brief wait so the caller can report a useful link state.
sleep 1
ip -br addr show "$IFACE" || true
