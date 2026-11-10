# Music agent

Node service that runs on the Raspberry Pi. It watches `jukebox_commands` in Supabase, wakes Google Cast speakers over the LAN when they're asleep, then controls playback through the official Spotify Web API.

This is self-contained in `home-hub` — it does not call any other project or laptop wake URL.

## Setup (once)

1. Create a Spotify developer app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
   - API: Web API
   - Redirect URI: `http://127.0.0.1:8888/callback`
   - Add your Spotify email under User Management (development mode allows 5 users)
2. Copy `.env.example` → `.env` and fill in:
   - Supabase URL + **service-role** key (Project Settings → API)
   - `HOUSEHOLD_ID` (Chung household seed id is fine)
   - Spotify Client ID + Secret
3. On your PC (with the `.env` present):

   ```bash
   pnpm --filter @hub/music-agent spotify:login
   ```

   Paste the printed `SPOTIFY_REFRESH_TOKEN` into `.env`.
4. In a browser signed into Spotify (**preferably a private/incognito window**), open DevTools → Application → Cookies → `open.spotify.com` → copy **both** `sp_dc` and `sp_key` into `SPOTIFY_SP_DC` / `SPOTIFY_SP_KEY`. Close the tab **without logging out** (logging out invalidates them). Treat them like passwords.
5. Link Spotify in the Google Home app and note each speaker's exact name.
6. Copy `.env` to the Pi (`~/hub-music-agent/.env`, `chmod 600`), install deps, and enable the systemd unit (see `pi/systemd/music-agent.service`).

## Run locally

```bash
pnpm --filter @hub/music-agent start
```

## Notes

- Cast wake uses unofficial Spotify endpoints and the `sp_dc` cookie. If Spotify breaks that path, speakers that are already in Connect still work; asleep Google speakers will need a voice wake until we update the handshake.
- Speaker groups are not woken yet — single Cast speakers only for now.
- Never put the service-role key or Spotify secrets in the kiosk `.env`.
