# Smart Home Hub

Monorepo for a wall-mounted household touchscreen (kiosk), companion Expo app, and Supabase backend.

Design source of truth: [`smarthome-hub-design.md`](./smarthome-hub-design.md).

## Structure

```
apps/kiosk          @hub/kiosk — React 18 + Vite touchscreen UI (mock data for now)
apps/mobile         @hub/mobile — Expo placeholder (Login / Home)
apps/music-agent    @hub/music-agent — phase-2 Node stub (not needed for v1)
packages/shared     @hub/shared — UI types, DB types, Supabase client factory, constants
docs/               DESIGN_SYSTEM.md, JUKEBOX.md
supabase/           Migrations, seed, config
pi/                 Raspberry Pi setup, Caddy config and deploy scripts
```

## Kiosk

The kiosk app lives in [`apps/kiosk`](./apps/kiosk) (see its [README](./apps/kiosk/README.md)). Read [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) before any UI work (Jukebox: [`docs/JUKEBOX.md`](./docs/JUKEBOX.md)); the Cursor rule in `.cursor/rules/design-system.mdc` applies it automatically to kiosk files.

```bash
pnpm dev:kiosk      # http://localhost:5173
pnpm build:kiosk    # type-check + build into apps/kiosk/dist/
```

## Setup

1. `pnpm install`
2. `supabase login`
3. `supabase link --project-ref <your-ref>`
4. `pnpm db:push`, then `pnpm db:types` (Supabase CLI v3 defaults to the local stack, so these scripts pass `--remote`). On a fresh project, `supabase db push --remote --include-seed` also loads `supabase/seed.sql`.
5. Create the kiosk device user in the dashboard (**Authentication → Users → Add user**, auto-confirm), then link it to the household:
   ```sql
   insert into public.profiles (id, household_id, kind)
   select id, '11111111-1111-1111-1111-111111111111', 'kiosk' from auth.users where email = '<kiosk email>';
   ```
6. Copy `.env.example` → `.env` in `apps/kiosk` and `apps/mobile`, and fill in the project URL, publishable key and (kiosk only) the device user's email and password
7. `pnpm dev:kiosk`

**Never** put the service-role / secret key in kiosk, mobile, or Pi env files. Use the anon/publishable key only; RLS enforces access.

## Deploy to the Pi

The kiosk runs on a Raspberry Pi 3 B+ (`home-hub.local`, user `danielchung`) in Chromium kiosk mode, served by Caddy from `/var/www/hub` on `http://localhost` only. Provision a fresh Pi once with `bash pi/setup.sh` (run on the Pi, from a copy of the `pi/` folder).

From Windows, in the repo root:

```powershell
pnpm deploy:pi
# or for a different Pi:
powershell -ExecutionPolicy Bypass -File pi/deploy.ps1 -PiHost other-pi.local -PiUser someone
```

This builds the kiosk, copies `apps/kiosk/dist` to the Pi with `scp`, replaces `/var/www/hub`, fixes file permissions (files copied from Windows arrive unreadable to Caddy, which shows a white page), and restarts `getty@tty1` to relaunch the kiosk browser. On macOS/Linux use `pi/deploy.sh [host] [user]`.

**Skip the password prompts** by setting up an SSH key once:

```powershell
ssh-keygen -t ed25519                     # accept the defaults
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh danielchung@home-hub.local "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

`sudo` on the Pi may still ask for a password unless the user has passwordless sudo (the Raspberry Pi OS default).

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev:kiosk` | Vite kiosk |
| `pnpm build:kiosk` | Type-check + build the kiosk |
| `pnpm deploy:pi` | Build the kiosk and deploy it to the Pi (Windows) |
| `pnpm dev:mobile` | Expo start |
| `pnpm db:start` | Local Supabase |
| `pnpm db:reset` | Reset local DB + seed |
| `pnpm db:push` | Push migrations to linked project |
| `pnpm db:types` | Regenerate `packages/shared/src/database.types.ts` |
| `pnpm typecheck` | Typecheck workspaces |
| `pnpm build` | Build workspaces (kiosk) |

## Expo + pnpm

Expo SDK 54+ supports pnpm’s default **isolated** linker in monorepos, so this repo does **not** set `node-linker=hoisted`. If a native module fails to resolve later, add `node-linker=hoisted` to `.npmrc` (or `nodeLinker: hoisted` in `pnpm-workspace.yaml`) and reinstall.

## What’s intentionally unfinished

- Kiosk Tasks, Rewards, Lists and Jukebox use Supabase; calendar/meals/recipes/photos still use mock data.
- Mobile is placeholders only until after the Pi kiosk is working.
- Music agent Cast wake is unofficial (needs `SPOTIFY_SP_DC`); see `apps/music-agent/README.md`.
- Calendar/meals/recipes/photos tables: later.
