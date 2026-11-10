# Build the kiosk on this machine and copy it to the Pi (never build on the Pi 3 B+).
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

  Write-Host "==> Copying apps/kiosk/dist to ${target}:/tmp/hub-dist"
  ssh $target 'rm -rf /tmp/hub-dist'
  if ($LASTEXITCODE -ne 0) { throw "Can't reach $target over SSH." }
  scp -r apps/kiosk/dist "${target}:/tmp/hub-dist"
  if ($LASTEXITCODE -ne 0) { throw 'Copy to the Pi failed.' }

  # chmod is required: files copied from Windows arrive as drwx------ and Caddy can't read them.
  Write-Host '==> Installing into /var/www/hub and restarting the kiosk browser'
  ssh -t $target 'rm -rf /var/www/hub/* && cp -r /tmp/hub-dist/* /var/www/hub/ && rm -rf /tmp/hub-dist && sudo chmod -R a+rX /var/www/hub && sudo systemctl restart getty@tty1'
  if ($LASTEXITCODE -ne 0) { throw 'Install on the Pi failed.' }

  Write-Host "Deployed to $PiHost. The kiosk is restarting."
}
finally {
  Pop-Location
}
