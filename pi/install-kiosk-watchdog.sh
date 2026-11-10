#!/bin/bash
# Install a boot watchdog that reloads Chromium if it sticks on a blank white tab.
set -euo pipefail

TOOLS="$HOME/hub-kiosk-tools"
mkdir -p "$TOOLS"
cp /tmp/kiosk-watchdog.py "$TOOLS/kiosk-watchdog.py"
chmod +x "$TOOLS/kiosk-watchdog.py"

if [ ! -x "$TOOLS/venv/bin/python" ]; then
  python3 -m venv "$TOOLS/venv"
  "$TOOLS/venv/bin/pip" install -q websockets
fi

PROFILE="$HOME/.bash_profile"
python3 - <<'PY'
from pathlib import Path
path = Path.home() / ".bash_profile"
text = path.read_text()
start = text.find("# Chung Family Hub kiosk")
if start < 0:
    start = text.find('if [ "$(tty)" = "/dev/tty1" ]')
if start < 0:
    raise SystemExit("kiosk block not found")
prefix = text[:start].rstrip() + "\n\n"
block = '''# Chung Family Hub kiosk: autologin on tty1 starts the browser (restart: sudo systemctl restart getty@tty1).
if [ "$(tty)" = "/dev/tty1" ]; then
  # Wait for Caddy — Chromium will stick on a white tab if the first load fails.
  for i in $(seq 1 30); do
    curl -fsS -o /dev/null http://127.0.0.1/ && break
    sleep 1
  done
  # Reload via CDP if Chromium opens a blank page (common after cold boot).
  nohup "$HOME/hub-kiosk-tools/venv/bin/python" "$HOME/hub-kiosk-tools/kiosk-watchdog.py" \\
    >/tmp/hub-kiosk-watchdog.log 2>&1 &
  disown || true
  exec cage -- /usr/bin/chromium --kiosk --ozone-platform=wayland --password-store=basic \\
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --no-first-run --remote-debugging-port=9222 --disk-cache-size=1 http://127.0.0.1/
fi
'''
path.write_text(prefix + block)
print("Updated", path)
PY

echo "Watchdog installed. Restarting kiosk browser..."
sudo systemctl restart getty@tty1
