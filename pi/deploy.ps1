# Build the kiosk on this machine and copy it to the Pi (never build on the Pi 3 B+).
# Also installs/refreshes the localhost device helper (Wi-Fi restart).
# Usage: pnpm deploy:pi    or    powershell -File pi/deploy.ps1 -PiHost home-hub.local -PiUser danielchung
param(
  [string]$PiHost = 'home-hub.local',
  [string]$PiUser = 'danielchung'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$target = "$PiUser@$PiHost"

Push-Location $root
try {
  Write-Host '==> Building the kiosk'
  pnpm build:kiosk
  if ($LASTEXITCODE -ne 0) { throw 'Build failed. Nothing was deployed.' }

  Write-Host "==> Installing hub-device helper on $target"
  ssh $target 'rm -rf /tmp/hub-device /tmp/hub-device.service /tmp/Caddyfile /tmp/install-hub-device.sh'
  if ($LASTEXITCODE -ne 0) { throw "Can't reach $target over SSH." }
  scp -r pi/hub-device "${target}:/tmp/hub-device"
  if ($LASTEXITCODE -ne 0) { throw 'Copy of hub-device failed.' }
  scp pi/systemd/hub-device.service "${target}:/tmp/hub-device.service"
  if ($LASTEXITCODE -ne 0) { throw 'Copy of hub-device.service failed.' }
  scp pi/caddy/Caddyfile "${target}:/tmp/Caddyfile"
  if ($LASTEXITCODE -ne 0) { throw 'Copy of Caddyfile failed.' }
  scp pi/install-hub-device.sh "${target}:/tmp/install-hub-device.sh"
  if ($LASTEXITCODE -ne 0) { throw 'Copy of install-hub-device.sh failed.' }
  ssh -t $target 'bash /tmp/install-hub-device.sh'
  if ($LASTEXITCODE -ne 0) { throw 'install-hub-device.sh failed on the Pi.' }

  Write-Host "==> Copying apps/kiosk/dist to ${target}:/tmp/hub-dist"
  ssh $target 'rm -rf /tmp/hub-dist'
  if ($LASTEXITCODE -ne 0) { throw "Can't reach $target over SSH." }
  scp -r apps/kiosk/dist "${target}:/tmp/hub-dist"
  if ($LASTEXITCODE -ne 0) { throw 'Copy to the Pi failed.' }

  # chmod is required: files copied from Windows arrive as drwx------ and Caddy can't read them.
  # Use owner chmod (no sudo) — sudo often prompts and used to leave assets as 700 → white screen.
  Write-Host '==> Installing into /var/www/hub and restarting the kiosk browser'
  ssh -t $target 'rm -rf /var/www/hub/* && cp -r /tmp/hub-dist/* /var/www/hub/ && rm -rf /tmp/hub-dist && chmod -R a+rX /var/www/hub && sudo systemctl restart getty@tty1'
  if ($LASTEXITCODE -ne 0) { throw 'Install on the Pi failed.' }

  Write-Host "Deployed to $PiHost. The kiosk is restarting."
}
finally {
  Pop-Location
}
