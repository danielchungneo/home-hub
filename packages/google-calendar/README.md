# Google Calendar sync tooling

Link N Google accounts and pull events into Supabase for the kiosk Calendar tab.

## One-time Google Cloud setup

1. Create (or reuse) a Google Cloud project and enable **Google Calendar API**.
2. Create an OAuth client (Desktop app or Web) with redirect URI exactly:
   `http://127.0.0.1:8788/callback`
3. Copy Client ID + Secret into `packages/google-calendar/.env` (see `.env.example`).
4. Add the same values as Supabase edge secrets:

```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... --project-ref zgobtwaajbwxdtiatjyq
```

5. Fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `HOUSEHOLD_ID` in `.env`.

## Link accounts

```bash
pnpm install
pnpm google:calendar-login -- --member daniel   # your Google account
pnpm google:calendar-login -- --member shelby   # Shelby’s Google account
```

Primary calendar maps to that member; other calendars on the account default to Family.

If you add a calendar later in Google (for example Outlook work synced in as **Dan’s Work**), run login again so it appears under Settings → Calendars. Then tap the person chip next to it (Daniel / Shelby / …) so events use that member’s color, and sync from the Calendar screen.

The hub does not use Google’s calendar colors — only household member colors (Daniel = moss, Family = fjord, etc.).

## Sync

```bash
pnpm google:calendar-sync
```

Or wait for the scheduled edge function (`calendar-sync`, every 5 minutes once cron + vault secrets are set).
