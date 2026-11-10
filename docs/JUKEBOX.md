# Jukebox — feature spec

**Status:** v2 live wiring (November 2026). Favorites + queue + playback use Supabase; search goes through the Pi music-agent.
**Related:** design doc §2.8 (Jukebox), §5 (playing on Alexa and Google Home), §8 (data model); [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §7–§8.

---

## 1. What it is

The Jukebox tab browses and plays the household's **favorited Spotify items** on the Echo and Google speakers (Spotify Connect, design doc §5 Path A).

- **Songs**, **Playlists** and **Albums** tabs show only things the family has favorited. Each item keeps its Spotify artwork.
- **Search** looks across Spotify. Any song, album or playlist in the results can be favorited with the heart, and from then on it shows up in its tab, with its art, on the hub and on every phone.
- **Now playing** has a full view (big art, controls, speakers, and an **Up next** queue) plus a mini player docked under the browse tabs.
- The **queue** belongs to the app: you can add to it, play a song next, move songs up, remove them, and clear it.

---

## 2. Screens

| View | What's on it |
|---|---|
| Toolbar (always) | Tabs (Songs · Playlists · Albums, with counts), search box (opens the on-screen SoftKeyboard — Chromium has no OS keyboard), and a "Now playing" button while something is playing |
| Songs | "Jump back in" (the last 4 albums or playlists played, from `play_collection` commands) and the list of favorite songs. Each row has Play, **Play next** and **Add to queue** |
| Albums / Playlists | The **record wall**: covers leaning on two wooden ledges, scrolling sideways. Tap a cover to play it with the pick animation; tap the caption to see its songs |
| Detail | Cover, title, meta, Play · Shuffle · Add all to queue · ♥, then the song list. Playlists you don't own show a note instead of songs (see §6) |
| Search | "In your favorites" first, then "From Spotify". Each result has a type badge (Song / Album / Playlist), Queue or Play, and ♥ |
| Now playing | Art tinted stage with a calm pulse, progress, shuffle/prev/play/next/repeat, volume, speaker picker; Up next panel with move up / remove / clear |
| Mini player | Under browse views: art, title, prev/play/next, progress, "Up next · n". Tapping the song opens Now playing |

Animation timings and rules are in §8 and in `DESIGN_SYSTEM.md` §8 (music motion).

---

## 3. Favorites drive the tabs

```
Search (spotify-search) ──♥──▶ insert jukebox_favorites ──Realtime──▶ hub + phones
                                         │
            Songs tab  = favorites where kind = 'track'
            Albums tab = favorites where kind = 'album'
            Playlists  = favorites where kind = 'playlist'
```

- **Favoriting** saves the item's display metadata on the row at that moment: title, subtitle, album, image URL, duration and track count. The tabs render straight from the table with **no Spotify calls**. That matters because Spotify removed batch lookups (`GET /tracks`, `GET /albums`) in February 2026, so re-fetching metadata would be one request per item.
- **Unfavoriting** deletes the row (♥ in search results, on the detail header, or later from the phone).
- **Ordering:** by `sort_order`, then newest first. Drag-to-reorder can come later on the phone.
- **Artwork:** store Spotify's image URL (pick the ~300px image for covers). Don't copy the image files into our own storage without checking Spotify's Developer Terms first. The UI falls back to a drawn placeholder when there's no URL.
- **Optional later:** mirror favorites to the Spotify account's library (`PUT /me/library`) so they show up in the Spotify app too.

---

## 4. Search

- Kiosk and phone call the **`spotify-search`** edge function. They never call Spotify directly; tokens stay server-side.
- One request: `GET /v1/search?type=track,album,playlist&limit=10&q=…`. In Development Mode the maximum `limit` is now **10 per type** (default 5), so ask for 10 explicitly and page with `offset` for "Show more".
- The function returns one shape for all three kinds:

```ts
type SearchResult = {
  kind: 'track' | 'album' | 'playlist'
  uri: string            // spotify:track:… / spotify:album:… / spotify:playlist:…
  title: string
  subtitle: string       // artists, or playlist owner
  album?: string         // tracks
  imageUrl?: string
  durationMs?: number    // tracks
  trackCount?: number    // albums, playlists
  owned?: boolean        // playlists: can we read its items?
}
```

- UI: debounce 350 ms, minimum 2 characters, cache results for 5 minutes (TanStack Query). Favorites matching the query are shown first, straight from the table.

---

## 5. Playback and the queue

### Why the app owns the queue
Spotify's Web API lets you **read** the playback queue and **add** to the end of it, but not remove or reorder items. The design needs Play next, move up, remove and clear, so the queue lives in **`jukebox_queue`** and the app feeds Spotify one song at a time.

### Commands (UI → `jukebox_commands`, as in design doc §4)

| UI action | Command / write | What the `spotify-control` function does |
|---|---|---|
| Play a song | `play_track {uri}` | `PUT /me/player/play {uris:[uri]}` on the chosen device |
| Play an album / owned playlist | `play_collection {uri}` | Expand to track URIs (`/albums/{id}/tracks`, `/playlists/{id}/items`), play the first, write the rest to `jukebox_queue` |
| Play a playlist you don't own | `play_collection {uri}` | `PUT /me/player/play {context_uri}`; Spotify picks the songs; Up next shows "Spotify is choosing from …" |
| Play next / Add to queue / move / remove / clear | direct insert/update/delete on `jukebox_queue` | — |
| Pause / resume / prev / volume / shuffle / repeat | `toggle`, `prev`, `volume`, … | The matching `/me/player/*` call |
| Next, or the song ends | `advance` | Pop the head of `jukebox_queue` and play it (or stop / repeat) |
| Pick a speaker | `transfer {speaker_id}` | `PUT /me/player {device_ids:[…]}` |

### Advancing when a song ends (v1)
The kiosk is always on and already knows the song length and position from `jukebox_state`. When the song ends, it inserts an `advance` command. The edge function checks Spotify's playback state before acting, so a duplicate `advance` (say, from a phone) does nothing. Expect a gap of under a second between songs.
**Phase 2:** the Pi music agent (design doc §6.3) can take this over by calling the edge function on a short timer while something is playing, so it works even if the screen is asleep.

---

## 6. Spotify constraints to design around (checked November 2026)

| Constraint | Effect on the Jukebox |
|---|---|
| Search: max 10 results per type per page in Development Mode | Search shows ≤ 10 per kind; "Show more" pages with `offset` |
| Playlist items are only returned for playlists the user **owns or collaborates on** | Shared or other people's playlists can be favorited and played (by `context_uri`), but their song list and "Add all to queue" aren't available. The detail view explains this |
| Batch `GET /tracks` and `GET /albums` were removed | Store metadata on the favorite row; fetch album/playlist songs only when a detail view opens or a collection is played |
| Audio Features (tempo/BPM) is unavailable to new apps | The pulse animation uses one fixed calm tempo (`--pulse: 3.2s`), not per-song BPM |
| Development Mode quota is shared across all of a developer's Client IDs; quota errors return 429 with `reason: "QUOTA_EXCEEDED"` | Cache aggressively; show "Spotify is busy, try again in a minute" for that reason code |
| Playback control requires Spotify Premium | Already noted in the design doc (§5 Path A) |
| Algorithmic and Spotify-owned editorial playlists are restricted for new apps | Expect some playlists in search results to be unplayable; hide them or show a quiet note |

Sources: [February 2026 Web API Dev Mode changes — migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [Web API quota updates for Development Mode (July 2026)](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates), [Introducing some changes to our Web API (Nov 2024)](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api), [Add Item to Playback Queue](https://developer.spotify.com/console/post-queue), [Spotify Community: removing songs from the queue via the API](https://community.spotify.com/t5/Spotify-for-Developers/API-Delete-Remove-songs-from-queue/m-p/5496278/highlight/true). Re-check before building; Spotify has changed these rules several times.

---

## 7. Data model

Every table has `household_id`, and RLS is scoped to it (same as the design doc).

```sql
-- What the Songs / Albums / Playlists tabs show.
create table jukebox_favorites (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  kind             text not null check (kind in ('track', 'album', 'playlist')),
  spotify_uri      text not null,
  title            text not null,
  subtitle         text,           -- artists (track/album) or owner (playlist)
  album_title      text,           -- tracks only
  image_url        text,           -- Spotify image URL captured when favorited
  duration_ms      integer,        -- tracks only
  track_count      integer,        -- albums and playlists
  is_owned         boolean,        -- playlists: can we read its items?
  default_speaker_id uuid references speakers(id),
  added_by         uuid references members(id),
  added_at         timestamptz not null default now(),
  sort_order       integer,
  unique (household_id, spotify_uri)
);

-- The app-owned "Up next" list.
create table jukebox_queue (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  position      integer not null,
  spotify_uri   text not null,     -- tracks only
  title         text not null,
  subtitle      text,
  image_url     text,
  duration_ms   integer,
  added_by      uuid references members(id),
  added_at      timestamptz not null default now()
);
create index on jukebox_queue (household_id, position);
```

Changes to existing tables from the design doc:

- **`jukebox_state`**: add `current_uri`, `current_title`, `current_subtitle`, `current_image_url`, `duration_ms`, `position_ms`, `position_at` (timestamp of `position_ms`), `from_title`, `shuffle`, `repeat`. Clients compute the elapsed time locally, so the progress bar doesn't need a write every second.
- **`jukebox_commands.type`**: `play_track`, `play_collection`, `toggle`, `advance`, `prev`, `volume`, `shuffle`, `repeat`, `transfer`.
- **Remove `jukebox_favorites (title, uri, speaker_id)`** from the old draft. "Quick picks" are replaced by favorites; the per-playlist speaker moves to `default_speaker_id`.
- **Realtime:** add `jukebox_favorites` and `jukebox_queue` to the publication.

### Edge functions

| Function | Purpose |
|---|---|
| `spotify-search` | Unified search (§4) |
| `spotify-collection` | Track list for an album or owned playlist, for the detail view and "Add all to queue" |
| `spotify-control` | Runs `jukebox_commands` against the Spotify player API, maintains `jukebox_state` and pops `jukebox_queue` on `advance` |

---

## 8. Motion

All animations are CSS keyframes on `transform` and `opacity` (see `Jukebox.module.css`). Everything pauses when playback pauses (`animation-play-state: paused`), and `prefers-reduced-motion` skips the pick animation.

| Element | Timing |
|---|---|
| Glow behind the art | Scale 1 → 1.05, opacity .18 → .26, every 3.2s |
| Art "breathing" | Scale 1 → 1.02, every 3.2s |
| Rings | 3 rings, each 6.4s from the cover edge to 1.9×, opacity .3 → 0, staggered by a third |
| Record | One turn every 4s; slides behind the cover when paused |
| Equalizer bars | 2.2s / 1.8s / 2.6s, out of phase |
| Mini-player ring | Every 3.2s, opacity .4 → 0 |
| **Pick (tap a cover)** | 2.35s total: 0–0.35s dim and sleeve lifts · 0.45s record slides out · 0.8s spins · 1.35s record rolls off the right edge and the sleeve fades · 1.75s screen washes to the cover color · 2.35s switch to Now playing, then the wash fades away over 0.8s |

---

## 9. Code map (kiosk)

```
src/data/jukebox.ts              Mock Spotify catalog + favorites (replace with queries)
src/screens/jukebox/
  Jukebox.tsx                    Screen: toolbar, tab routing, pick flow, toast
  useJukebox.ts                  Player + queue + favorites state (→ commands/Realtime later)
  Browse.tsx                     SongsView, WallView, DetailView, SearchView
  NowPlaying.tsx                 Now playing stage, Up next, MiniPlayer
  PickOverlay.tsx                Pick animation + color wash reveal
  parts.tsx                      Cover, Equalizer, FavoriteButton, TrackRow
  Jukebox.module.css             All jukebox styles + keyframes
```

Dev shortcuts: `#jukebox`, `#jukebox-now`, `#jukebox-albums`, `#jukebox-playlists`.

**Wiring order:** (1) `jukebox_favorites` query → tabs; (2) `spotify-search` → SearchView, with ♥ = insert/delete; (3) `jukebox_state` + `spotify-control` → player; (4) `jukebox_queue` → Up next; (5) `advance` on song end.

---

## 10. Design doc updates

Replace §2.8 with:

> ### 2.8 Jukebox
> - Tabs: **Songs, Playlists, Albums**, showing only the household's **favorited Spotify items** (`jukebox_favorites`) with their artwork
> - **Search** across Spotify; tap ♥ on any song, album or playlist to favorite it, and it appears in its tab on the hub and phones
> - Albums and Playlists are a **record wall**: tap a cover to play it, with a short "put the record on" animation
> - **Now playing** view with controls, speaker picker and an **Up next** queue (play next, add, move up, remove, clear); a mini player sits under the browse tabs
> - Calm motion while playing (pulse, rings, spinning record); everything stops when paused
> - Full spec: `docs/JUKEBOX.md`

In §5 *Jukebox data* and §8 *Jukebox*, replace the `jukebox_favorites` row and add `jukebox_queue` as in §7 above.

Add to §14 open questions:

- [ ] Can kids favorite and unfavorite, or is that parent-only (PIN)?
- [ ] Should favorites also save to the Spotify account's library?
- [ ] What should happen when the queue runs out: stop, or keep playing from the last album/playlist?
