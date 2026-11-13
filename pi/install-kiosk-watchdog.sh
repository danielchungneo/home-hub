#!/bin/bash
# Install boot readiness (chmod + asset wait) and a CDP watchdog for blank tabs.
set -euo pipefail

TOOLS="$HOME/hub-kiosk-tools"
mkdir -p "$TOOLS"

# Prefer files shipped next to this script; fall back to /tmp copies from a laptop scp.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/ensure-hub-ready.sh" ]; then
  install -m 755 "$SCRIPT_DIR/ensure-hub-ready.sh" "$TOOLS/ensure-hub-ready.sh"
elif [ -f /tmp/ensure-hub-ready.sh ]; then
  install -m 755 /tmp/ensure-hub-ready.sh "$TOOLS/ensure-hub-ready.sh"
fi

if [ -f "$SCRIPT_DIR/kiosk-watchdog.py" ]; then
  install -m 644 "$SCRIPT_DIR/kiosk-watchdog.py" "$TOOLS/kiosk-watchdog.py"
elif [ -f /tmp/kiosk-watchdog.py ]; then
  install -m 644 /tmp/kiosk-watchdog.py "$TOOLS/kiosk-watchdog.py"
fi
chmod +x "$TOOLS/kiosk-watchdog.py" 2>/dev/null || true

if [ ! -x "$TOOLS/venv/bin/python" ]; then
  python3 -m venv "$TOOLS/venv"
  "$TOOLS/venv/bin/pip" install -q websockets
fi

if apt-cache policy chromium 2>/dev/null | grep -q 'Candidate: [0-9]'; then
  CHROMIUM=chromium
else
  CHROMIUM=chromium-browser
fi
# Prefer the binary that is already on PATH.
if command -v chromium >/dev/null 2>&1; then
  CHROMIUM=chromium
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM=chromium-browser
fi

PROFILE="$HOME/.bash_profile"
python3 - "$CHROMIUM" <<'PY'
from pathlib import Path
import sys

chromium = sys.argv[1]
path = Path.home() / ".bash_profile"
text = path.read_text() if path.exists() else ""
start = text.find("# Chung Family Hub kiosk")
if start < 0:
    start = text.find('if [ "$(tty)" = "/dev/tty1" ]')
prefix = (text[:start].rstrip() + "\n\n") if start >= 0 else (text.rstrip() + "\n\n" if text.strip() else "")
block = f'''# Chung Family Hub kiosk: autologin on tty1 starts the browser (restart: sudo systemctl restart getty@tty1).
if [ "$(tty)" = "/dev/tty1" ]; then
  # chmod hub (Windows scp leaves 700) and wait until Caddy serves real JS, not HTML fallback.
  [ -x "$HOME/hub-kiosk-tools/ensure-hub-ready.sh" ] && "$HOME/hub-kiosk-tools/ensure-hub-ready.sh"
  # Reload via CDP if Chromium opens a blank #root (common after cold boot).
  nohup "$HOME/hub-kiosk-tools/venv/bin/python" "$HOME/hub-kiosk-tools/kiosk-watchdog.py" \\
    >/tmp/hub-kiosk-watchdog.log 2>&1 &
  disown || true
  exec cage -- /usr/bin/{chromium} --kiosk --ozone-platform=wayland --password-store=basic \\
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --no-first-run --remote-debugging-port=9222 --disk-cache-size=1 http://127.0.0.1/
fi
'''
path.write_text(prefix + block)
print("Updated", path)
PY

echo "Readiness helper + watchdog installed."
echo "Restart the kiosk with: sudo systemctl restart getty@tty1"
