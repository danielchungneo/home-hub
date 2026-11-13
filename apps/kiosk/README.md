# Kiosk — Chung Family Hub

The touchscreen UI for the family hub: React 18 + Vite + TypeScript, styled with CSS Modules and design tokens.

- **Design rules:** [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md). Read it before building UI. Jukebox feature spec: [`docs/JUKEBOX.md`](../../docs/JUKEBOX.md).
- **Cursor:** the repo-root `.cursor/rules/design-system.mdc` applies the design system automatically when you edit `apps/kiosk/src/**/*.tsx` or `*.css`.

## Run it

From the repo root:

```bash
pnpm install                           # installs every workspace
pnpm dev:kiosk                         # http://localhost:5173
pnpm build:kiosk                       # type-check + production build into apps/kiosk/dist/
pnpm --filter @hub/kiosk typecheck     # type-check only
pnpm --filter @hub/kiosk preview       # serve dist/ like the Pi will
```

Open the browser at **1920×1080** (DevTools device toolbar → Responsive → 1920 × 1080).

Jump straight to a screen with a hash: `#calendar`, `#tasks` (also `#tasks-add`), `#rewards`, `#meals`, `#recipes`, `#photos`, `#lists`, `#jukebox` (also `#jukebox-now`, `#jukebox-albums`, `#jukebox-playlists`), `#settings`, plus the full-screen modes `#idle`, `#sleep`, `#cooking` and `#pin`.

## Data (live vs still to wire)

Hooks live in `src/data/hooks.ts`, row-to-UI mapping in `src/data/mappers.ts`, and `src/data/live.ts` subscribes each screen to Realtime. The kiosk signs in as a dedicated device user from `.env` (see `.env.example`).

| Area | Status |
|------|--------|
| **Members / Settings** | Live (family CRUD, PIN, sleep, calendars, speakers) |
| **Calendar events** | Live (Google sync). Coming-up countdowns and week-header forecast **not wired** |
| **Rewards (Star Shop)** | Live |
| **Lists** | Live. “Usually on it” chips empty until a history view exists |
| **Meals / Recipes / Cooking** | Live |
| **Jukebox** | Live |
| **Weather** | Live via Open-Meteo when household lat/lon is set |
| **Tasks** | Lists + toggle completions live. **Template library, add task, and bounties not wired** |
| **Photos / Idle slideshow** | **Not wired** (Idle shows clock + today glance only) |

Google Calendar linking: `packages/google-calendar/README.md`. Tasks UI spec: [`docs/TASKS.md`](../../docs/TASKS.md).

## Project layout

```
src/
  app/          App.tsx (screen switching, overlays, lazy loading), nav.tsx (useNav context)
  components/   AppShell, Button, primitives (Panel, Avatar, Segmented, …), Icon
  screens/      One .tsx + .module.css per screen (bigger ones get a folder)
  data/         hooks.ts, mappers.ts, live.ts, queryClient.ts
  hooks/        useClock, useIdle, useCountUp
  lib/          format, members, mealSlots, recipes, tasks, calendar, lists, weather, …
  styles/       tokens.css, base.css
```

UI types matching the data model live in `packages/shared/src/types.ts` and are imported from `@hub/shared`.

## Still to do

1. Tasks: wire `task_templates` + `bounties` queries/mutations and the Add sheet / claim flow (see `docs/TASKS.md`).
2. Calendar: countdowns table/hook; multi-day forecast for week headers.
3. Lists: usual-items from purchase history (or a stored usual list).
4. Photos: Storage + slideshow on Idle (replace `PhotoPlaceholder`).
5. Weather: set household location in Settings if the header shows “Set location”.

## Pi notes

- Build on your laptop or in CI, then `rsync dist/` to the Pi. Caddy serves it at `http://localhost`.
- The production bundle is about 160 KB of JS (52 KB gzipped) for React and the app shell, plus 1–5 KB per screen, loaded on demand.
- If RAM gets tight, Preact (`@preact/preset-vite` with `preact/compat`) is a near drop-in swap that cuts roughly 100 KB of JS (about 35 KB gzipped) and the parse time that goes with it. Components should not need changes.
