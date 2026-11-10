# Kiosk — Chung Family Hub

The touchscreen UI for the family hub: React 18 + Vite + TypeScript, styled with CSS Modules and design tokens. Every screen from the design pass is built and wired to mock data, so you can click through the whole app before Supabase exists.

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

Jump straight to a screen with a hash: `#calendar`, `#tasks`, `#rewards`, `#meals`, `#recipes`, `#photos`, `#lists`, `#jukebox` (also `#jukebox-now`, `#jukebox-albums`, `#jukebox-playlists`), `#settings`, plus the full-screen modes `#idle`, `#sleep`, `#cooking` and `#pin`.

## Data

**Tasks, Rewards and Lists** (plus the members and the slideshow's task count) read from and write to Supabase. A small loader in front of each of those screens waits for its queries. Hooks live in `src/data/hooks.ts`, row-to-UI mapping in `src/data/mappers.ts`, and `src/data/live.ts` subscribes each screen to Realtime for its own tables. The kiosk signs in as a dedicated device user from `.env` (see `.env.example`).

Everything else (Calendar, Meals, Recipes, Photos, Jukebox, weather, Settings values) still reads `src/data/mock.ts` until those tables exist.

## What works with mock data

- **Tasks:** per-person columns, routine tabs, tap to complete, progress, points, "all wrapped up" banner
- **Calendar:** week view for the current week, person filters, all-day row, live "now" line
- **Rewards:** balances computed from a ledger, redeem, approve with the PIN dialog, history
- **Meals:** week grid, today highlighted, "add ingredients" confirmation
- **Recipes:** search, tag filters, servings scaling with kitchen fractions, start cooking mode
- **Cooking mode:** step navigation, working countdown timer, Wake Lock when available
- **Photos:** filters, add to or remove from the slideshow, play slideshow
- **Lists:** switch lists, add items, check off, clear completed
- **Jukebox:** Songs / Playlists / Albums from favorites, record wall with the pick animation, Now playing with calm motion, Up next queue, Spotify search with ♥ to favorite (spec: [`docs/JUKEBOX.md`](../../docs/JUKEBOX.md))
- **Settings:** family colors, routines and points, plus the other sections as toggle/value rows
- **Idle slideshow** after 5 minutes without touch, and **Sleep** from the sidebar

## Project layout

```
src/
  app/          App.tsx (screen switching, overlays, lazy loading), nav.tsx (useNav context)
  components/   AppShell, Button, primitives (Panel, Avatar, Segmented, …), Icon
  screens/      One .tsx + .module.css per screen; Cooking/Idle/Sleep/PinDialog are overlays
  data/mock.ts  Mock rows shaped like the Supabase tables in the design doc (§8)
  hooks/        useClock (ticks per minute), useIdle (single timeout)
  lib/          format.ts (dates, times, quantities), members.ts (who() lookup),
                types.ts (shared types pinned to the kiosk's IconName)
  styles/       tokens.css (the design tokens), base.css (reset, fonts, keyframes)
```

UI types matching the data model live in `packages/shared/src/types.ts` and are imported from `@hub/shared`.

## Next steps toward the real thing

1. ~~Drop this folder into the monorepo as `apps/kiosk` and move `types.ts` into `packages/shared`.~~ Done. DB types are generated into `packages/shared/src/database.types.ts` with `pnpm db:types`.
2. ~~Add `@supabase/supabase-js` + TanStack Query~~ Done for Tasks, Rewards and Lists. Keep replacing exports in `data/mock.ts` with hooks in `data/hooks.ts` as their tables land.
3. Subscribe to Realtime only for the current screen (today's completions, this week's meals, and so on).
4. Weather: fetch Open-Meteo every 15–30 minutes and replace `WEATHER` in `mock.ts`.
5. Jukebox: turn handlers into `jukebox_commands` inserts and read `jukebox_state`.
6. PIN: check against `household_settings.parent_pin_hash` (see `PinDialog.tsx`).
7. Photos: replace `PhotoPlaceholder` with `<img loading="lazy" decoding="async">` using signed URLs.

## Pi notes

- Build on your laptop or in CI, then `rsync dist/` to the Pi. Caddy serves it at `http://localhost`.
- The production bundle is about 160 KB of JS (52 KB gzipped) for React and the app shell, plus 1–5 KB per screen, loaded on demand.
- If RAM gets tight, Preact (`@preact/preset-vite` with `preact/compat`) is a near drop-in swap that cuts roughly 100 KB of JS (about 35 KB gzipped) and the parse time that goes with it. Components should not need changes.
