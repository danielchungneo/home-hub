# Kiosk fixes: faster tab switching, no more white screens, one-command deploy

Context: the kiosk (`apps/kiosk`) now runs on a Raspberry Pi 3 B+ in Chromium kiosk mode, served by Caddy from `/var/www/hub`. It works, but **opening a tab for the first time is slow**; going back to a tab that already loaded is fast. Causes:

- Each screen is a `React.lazy()` chunk loaded only on first visit, and the Pi 3 B+ is slow to parse JS.
- Tasks, Rewards and Lists also sign in to Supabase and fetch data over the internet on first visit.
- `<Suspense fallback={null}>` shows nothing while a screen loads, so taps feel unresponsive.

Read `docs/DESIGN_SYSTEM.md` and follow the existing code style (CSS Modules, tokens, no new dependencies). Keep changes small and focused on the items below.

## 1. Preload every screen in the background

In `apps/kiosk/src/app/App.tsx`:

- Keep the dynamic imports in one `loaders` object keyed by `ScreenId` (plus Cooking, Idle, Sleep, PinDialog), and build the `lazy()` components from it so each import path appears only once.
- After the app mounts, wait ~2 seconds, then call each loader **one at a time** with a short gap (~200 ms) between them, so the Pi stays responsive. Use `requestIdleCallback` when available, falling back to `setTimeout`.
- Skip loaders that already ran. Ignore preload errors (the real navigation will retry and surface them).

Example shape:

```tsx
const loaders = {
  calendar: () => import('../screens/Calendar'),
  tasks: () => import('../screens/Tasks'),
  // ...every screen
} satisfies Record<ScreenId, () => Promise<{ default: () => JSX.Element }>>

const screens = Object.fromEntries(
  Object.entries(loaders).map(([id, load]) => [id, lazy(load)]),
) as Record<ScreenId, React.LazyExoticComponent<() => JSX.Element>>
```

## 2. Prefetch Supabase data for the live screens

- At startup (after `ensureSession()` succeeds), prefetch the queries that Tasks, Rewards and Lists use, via `queryClient.prefetchQuery` with **the same query keys and query functions** as the hooks in `src/data/hooks.ts`. Refactor the hooks so each query's options come from a shared function (e.g. `tasksQuery()`, `ledgerQuery()`), used both by the hook and the prefetch, so keys can't drift apart.
- Prefetch after the first screen renders, not before.
- In `src/data/queryClient.ts`, raise `staleTime` to 5 minutes. Realtime already invalidates queries when rows change, so the cache stays correct.

## 3. Show a loading state immediately

- Replace `<Suspense fallback={null}>` with a lightweight `ScreenLoading` component: an empty panel matching the screen area, using existing tokens, with at most a simple opacity fade (no spinners driven by JS, no blur, no box-shadow). It should appear instantly on tap.
- Keep the sidebar/header (AppShell) visible while a screen loads, so the tab highlight changes immediately on tap.

## 4. Error boundary (no more blank white screen)

- Add an `ErrorBoundary` component around the app (in `main.tsx`) and around the screen area in `App.tsx`.
- On error, show a full-screen, readable message: "Something went wrong", the error message in small monospace text, and a large **Reload** button (`window.location.reload()`).
- Also add `window.addEventListener('error' / 'unhandledrejection')` handlers that log to the console, so problems are visible through remote DevTools.
- If `ensureSession()` fails (bad kiosk credentials, no internet), show a clear message ("Can't sign in to the hub. Check the internet connection.") with a Retry button instead of a crash.

## 5. One-command deploy from Windows

The dev machine is **Windows (PowerShell)**. The Pi is `home-hub.local`, user `danielchung`. Files are served from `/var/www/hub` by Caddy. `rsync` is not available.

Create `pi/deploy.ps1` (and update `pi/deploy.sh` to do the same for macOS/Linux):

1. Run `pnpm build:kiosk` from the repo root; stop if it fails.
2. Read the Pi host and user from parameters with defaults (`-PiHost home-hub.local -PiUser danielchung`).
3. `scp -r apps/kiosk/dist <user>@<host>:/tmp/hub-dist`
4. In **one** `ssh -t` call:
   `rm -rf /var/www/hub/* && cp -r /tmp/hub-dist/* /var/www/hub/ && rm -rf /tmp/hub-dist && sudo chmod -R a+rX /var/www/hub && sudo systemctl restart getty@tty1`
   - The `chmod` is required: files copied from Windows arrive as `drwx------`, Caddy can't read them, and the page goes white.
   - Restarting `getty@tty1` relaunches the kiosk browser without a full reboot.
5. Print a short success message.

Add a root script: `"deploy:pi": "powershell -ExecutionPolicy Bypass -File pi/deploy.ps1"`.

Document it in the root README under a "Deploy to the Pi" heading, including a note that setting up an SSH key (`ssh-keygen`, then copy the public key into `~/.ssh/authorized_keys` on the Pi) removes the password prompts.

## 6. Fill in the Pi config stubs

Replace the TODO stubs with what is actually running on the Pi:

- `pi/caddy/Caddyfile`:
  ```
  http://localhost {
      bind 127.0.0.1
      root * /var/www/hub
      try_files {path} /index.html
      file_server
  }
  ```
  Bound to localhost on purpose: the kiosk login (`VITE_KIOSK_EMAIL` / `VITE_KIOSK_PASSWORD`) is built into the JS, so the site must not be reachable from other devices on the network.
- `pi/setup.sh`: installs `cage chromium fonts-noto-color-emoji caddy htop` (fall back to `chromium-browser` if `chromium` isn't found), sets console autologin (`raspi-config nonint do_boot_behaviour B2`), creates `/var/www/hub` owned by the user, installs the Caddyfile, and appends the kiosk launcher to `~/.bash_profile` **only if it isn't already there**:
  ```bash
  if [ "$(tty)" = "/dev/tty1" ]; then
    exec cage -- chromium --kiosk --ozone-platform=wayland --password-store=basic \
      --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
      --no-first-run http://localhost
  fi
  ```
  Also enable zram (`zram-tools`). Make the script safe to run twice.
- `pi/systemd/kiosk.service`: leave as a commented alternative and note that the kiosk currently launches from `~/.bash_profile` on tty1.

## Done when

- `pnpm typecheck` and `pnpm build:kiosk` pass.
- In `pnpm --filter @hub/kiosk preview`, every tab opens instantly after the first few seconds, and throwing an error in a screen shows the error screen instead of white.
- Summarize what changed and anything I need to do by hand.
