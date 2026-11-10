#!/usr/bin/env bash
# Build the kiosk on this machine and copy it to the Pi (never build on the Pi 3 B+).
# Usage: pi/deploy.sh [host] [user]    (defaults: home-hub.local danielchung)

set -euo pipefail

PI_HOST="${1:-${PI_HOST:-home-hub.local}}"
PI_USER="${2:-${PI_USER:-danielchung}}"
TARGET="$PI_USER@$PI_HOST"

cd "$(dirname "$0")/.."

echo "==> Building the kiosk"
pnpm build:kiosk

echo "==> Copying apps/kiosk/dist to $TARGET:/tmp/hub-dist"
ssh "$TARGET" 'rm -rf /tmp/hub-dist'
scp -r apps/kiosk/dist "$TARGET:/tmp/hub-dist"

# chmod is required: copied files can arrive as drwx------ and Caddy can't read them.
echo "==> Installing into /var/www/hub and restarting the kiosk browser"
ssh -t "$TARGET" 'rm -rf /var/www/hub/* && cp -r /tmp/hub-dist/* /var/www/hub/ && rm -rf /tmp/hub-dist && sudo chmod -R a+rX /var/www/hub && sudo systemctl restart getty@tty1'

echo "Deployed to $PI_HOST. The kiosk is restarting."
