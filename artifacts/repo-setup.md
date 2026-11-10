Set up a new monorepo for my Smart Home Hub project. Read `smarthome-hub-design.md` in the repo root first. It's the source of truth for architecture, tabs, and the data model (§8). Follow it, and ask me before deviating.

## Repo structure
Use **pnpm workspaces + Turborepo**, TypeScript everywhere.

```
smarthome-hub/
├── apps/
│   ├── kiosk/          # React + Vite + TS + Tailwind (touchscreen UI)
│   ├── mobile/         # Expo (React Native + TS, Expo Router)
│   └── music-agent/    # Node + TS service, placeholder only for now
├── packages/
│   └── shared/         # Supabase DB types, client factory, shared constants/utils
├── supabase/           # Supabase CLI project (migrations, seed, functions)
├── pi/                 # Raspberry Pi provisioning (stubs for now)
├── smarthome-hub-design.md
└── README.md
```

## Root
- `pnpm-workspace.yaml`, `turbo.json` with `dev`, `build`, `lint`, `typecheck` pipelines
- Root `package.json` scripts:
  - `dev:kiosk`, `dev:mobile`
  - `db:start` → `supabase start`
  - `db:reset` → `supabase db reset`
  - `db:push` → `supabase db push`
  - `db:types` → `supabase gen types typescript --linked > packages/shared/src/database.types.ts`
- Shared `tsconfig.base.json`, ESLint + Prettier config
- `.gitignore` that ignores all `.env*` files except `.env.example`, plus `node_modules`, `dist`, `.turbo`, `.expo`, and `supabase/.temp`
- Expo in a pnpm monorepo: follow Expo's current monorepo guide. If it requires `node-linker=hoisted` in `.npmrc`, add it and explain why in the README.

## packages/shared
- `src/database.types.ts` (placeholder until types are generated)
- `src/supabase.ts`: a `createHubClient(url, key, options?)` factory typed with `Database`, usable from both Vite and Expo
- `src/constants.ts`: routine values (`morning | afternoon | evening | chores`), member roles, and so on, matching the DB enums
- Export everything from `src/index.ts`

## apps/kiosk
- Vite + React + TS + the latest Tailwind (using its Vite plugin)
- TanStack Query, plus `@supabase/supabase-js` through the shared client
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.example`
- Basic shell only: a left sidebar with the tabs from the design doc (Calendar, Tasks, Rewards, Meals, Recipes, Photos, Lists, Jukebox; Sleep and Settings pinned at the bottom), a header with date and time, and a placeholder page per tab, using React Router
- Design target: 1920×1080 landscape, touch-first, with large touch targets. No heavy UI libraries (no MUI), no blur or backdrop-filter.
- One working proof of the data path: the Tasks page lists `tasks` from Supabase and subscribes to Realtime changes

## apps/mobile
- Expo with Expo Router and TS, using the shared client
- Env vars: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.example`
- Supabase auth session storage set up for React Native, following Supabase's Expo guide
- Placeholder screens: Login, Home

## apps/music-agent
- Minimal Node + TS project (tsx for dev) with a README explaining it's for phase 2. No real logic yet.

## supabase/
- Initialize with `supabase init`. **Do not run `supabase link` or `db push`.** I'll do that myself.
- Create the first migration with the following tables from §8 of the design doc:
  - `households`, `members`, `profiles`
  - `tasks`, `task_completions`
  - `rewards`, `reward_redemptions`, `points_ledger`
  - `lists`, `list_items`
- Leave calendar, meals, recipes, photos, jukebox, and settings tables for later migrations.
- Requirements:
  - UUID primary keys and `created_at`/`updated_at` timestamps, with an `updated_at` trigger
  - Postgres enums or check constraints for the routine, role, and status fields
  - `household_id` on every table, with sensible foreign keys and indexes
  - `task_completions` unique on `(task_id, for_date)`
  - `points_ledger` append-only (no update or delete policies); add a `member_points` view that sums the balance
- **RLS on every table:**
  - Add a `security definer` helper function `current_household_id()` that reads it from `profiles` for `auth.uid()`
  - Policies scope all reads and writes to that household
  - `profiles.kind` is `person` or `kiosk`; the kiosk can read everything and write tasks, completions, lists, and redemption requests
- Add the tables shown live on screen to the `supabase_realtime` publication
- `supabase/seed.sql` with one household, a few members (with colors), sample tasks across routines, a few rewards, and a Groceries list

## pi/
- Stub files with TODO comments only: `setup.sh`, `deploy.sh`, `caddy/Caddyfile`, `systemd/kiosk.service`

## README
Include setup steps:
1. `pnpm install`
2. `supabase login`
3. `supabase link --project-ref <my-ref>`
4. `pnpm db:push`, then `pnpm db:types`
5. Copy `.env.example` to `.env` in `apps/kiosk` and `apps/mobile`, and fill in the URL and the anon/publishable key from the Supabase dashboard
6. `pnpm dev:kiosk`

Also note in the README: **never** put the service-role/secret key in kiosk, mobile, or Pi env files.

## Rules
- Don't invent features beyond this list.
- Use current stable versions and current official docs for Vite, Tailwind, Expo, and Supabase.
- When done, run `pnpm install`, `pnpm typecheck`, and `pnpm build` for the kiosk, and fix any errors.
- Summarize what you created and anything I need to do manually.