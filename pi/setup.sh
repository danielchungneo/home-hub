#!/usr/bin/env bash
# Provision Raspberry Pi OS Lite for the kiosk. Safe to run more than once.
# Run as the kiosk user (not root), from a copy of this repo's pi/ folder on the Pi:
#   bash pi/setup.sh
# Then deploy the app from the dev machine with `pnpm deploy:pi`.

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as the kiosk user (it uses sudo where needed), not as root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIOSK_USER="$(id -un)"

echo "==> Installing packages"
sudo apt-get update
if apt-cache policy chromium | grep -q 'Candidate: [0-9]'; then
  CHROMIUM=chromium
else
  CHROMIUM=chromium-browser
fi
sudo apt-get install -y cage "$CHROMIUM" fonts-noto-color-emoji caddy htop zram-tools

echo "==> Enabling zram swap"
printf 'ALGO=zstd\nPERCENT=50\n' | sudo tee /etc/default/zramswap >/dev/null
sudo systemctl enable zramswap
sudo systemctl restart zramswap

echo "==> Console autologin on tty1"
sudo raspi-config nonint do_boot_behaviour B2

echo "==> Web root and Caddy"
sudo mkdir -p /var/www/hub
sudo chown "$KIOSK_USER:$KIOSK_USER" /var/www/hub
sudo chmod a+rX /var/www/hub
sudo install -m 644 "$SCRIPT_DIR/caddy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy

echo "==> Kiosk readiness helper + launcher in ~/.bash_profile"
TOOLS="$HOME/hub-kiosk-tools"
mkdir -p "$TOOLS"
install -m 755 "$SCRIPT_DIR/ensure-hub-ready.sh" "$TOOLS/ensure-hub-ready.sh"
if [ -f "$SCRIPT_DIR/kiosk-watchdog.py" ]; then
  install -m 644 "$SCRIPT_DIR/kiosk-watchdog.py" "$TOOLS/kiosk-watchdog.py"
fi

PROFILE="$HOME/.bash_profile"
if [ ! -f "$PROFILE" ]; then
  # bash skips ~/.profile once ~/.bash_profile exists, so keep loading it.
  echo '[ -f "$HOME/.profile" ] && . "$HOME/.profile"' >"$PROFILE"
fi

# Always refresh the kiosk block so readiness/chmod fixes stay in sync with this script.
python3 - "$PROFILE" "$CHROMIUM" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
chromium = sys.argv[2]
text = path.read_text() if path.exists() else ""
markers = ("# Chung Family Hub kiosk", 'if [ "$(tty)" = "/dev/tty1" ]')
start = -1
for marker in markers:
    start = text.find(marker)
    if start >= 0:
        break
prefix = (text[:start].rstrip() + "\n\n") if start >= 0 else (text.rstrip() + "\n\n" if text.strip() else "")
block = f'''# Chung Family Hub kiosk: autologin on tty1 starts the browser (restart: sudo systemctl restart getty@tty1).
if [ "$(tty)" = "/dev/tty1" ]; then
  # chmod hub (Windows scp leaves 700) and wait until Caddy serves real JS, not HTML fallback.
  [ -x "$HOME/hub-kiosk-tools/ensure-hub-ready.sh" ] && "$HOME/hub-kiosk-tools/ensure-hub-ready.sh"
  # Optional: reload via CDP if Chromium still paints a blank #root.
  if [ -x "$HOME/hub-kiosk-tools/venv/bin/python" ] && [ -f "$HOME/hub-kiosk-tools/kiosk-watchdog.py" ]; then
    nohup "$HOME/hub-kiosk-tools/venv/bin/python" "$HOME/hub-kiosk-tools/kiosk-watchdog.py" \\
      >/tmp/hub-kiosk-watchdog.log 2>&1 &
    disown || true
  fi
  exec cage -- {chromium} --kiosk --ozone-platform=wayland --password-store=basic \\
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --no-first-run --remote-debugging-port=9222 --disk-cache-size=1 http://127.0.0.1/
fi
'''
path.write_text(prefix + block)
print("Updated", path)
PY

echo "==> Music agent (optional; needs Node 20+)"
if command -v node >/dev/null 2>&1; then
  AGENT_DIR="$HOME/hub-music-agent"
  mkdir -p "$AGENT_DIR"
  if [ -f "$SCRIPT_DIR/systemd/music-agent.service" ]; then
    sudo install -m 644 "$SCRIPT_DIR/systemd/music-agent.service" /etc/systemd/system/music-agent.service
    sudo systemctl daemon-reload
    echo "Installed music-agent.service. Copy the agent sources + .env to $AGENT_DIR, then: sudo systemctl enable --now music-agent"
  fi
else
  echo "Node not found — install Node 20+ later to run the music agent."
fi

echo "Done. Deploy the app with 'pnpm deploy:pi' from the dev machine, then reboot the Pi."
