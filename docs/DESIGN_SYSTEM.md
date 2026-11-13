# Chung Family Hub — Design System ("Scandi Calm")

The reference for every screen on the kiosk. When you build or change UI, follow this file, use the tokens in `src/styles/tokens.css`, and reuse the components in `src/components/`. If something you need isn't here, add it here first, then build it.

**Contents:** 1. Principles · 2. Color · 3. Typography · 4. Spacing, radii, sizes · 5. Layout · 6. Components · 7. Patterns · 8. Motion · 9. Icons · 10. Accessibility · 11. Performance on the Pi 3 B+ · 12. Writing style · 13. Code conventions · 14. Checklist

---

## 1. Principles

1. **Calm, warm, readable across the room.** Oat and white surfaces, muted colors, big serif headings. Nothing glows, pulses or shouts.
2. **Each person owns a color.** Daniel = moss, Shelby = clay, Noah = honey by default; Family/Home/Up for grabs = **slate** (system-only, not in pickers). People pick from presets or a custom `#RRGGBB`. That color marks their columns, events, avatars and checkmarks everywhere.
3. **Big, forgiving touch targets.** Kids, sticky hands, a screen on the wall. Nothing tappable under 56 px.
4. **One idea per surface.** A page has one title, one main panel, and at most one primary (ink) button per panel.
5. **Fast on a Pi 3 B+.** Static CSS, no runtime styling, animate only `transform` and `opacity`.

---

## 2. Color

All colors live in `src/styles/tokens.css`. **Never write a hex value in a component.** Use a token. If you need a new color, add a token here and in `tokens.css`.

### Surfaces

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#F0EBE3` | App background (oat) |
| `--color-rail` | `#E6DED2` | Sidebar, segmented-control tracks, header pills |
| `--color-surface` | `#FFFDFA` | Cards, panels, active nav item, selected item in a rail |
| `--color-surface-sunken` | `#F3EEE7` | Inputs, secondary buttons, quantity chips |
| `--color-surface-muted` | `#F7F3ED` | Quiet fills (text-only meal slots, idle speakers) |
| `--color-highlight` | `#FBF7F1` | "Today" column wash on the calendar |

Surfaces are layered: **bg → surface (panel) → sunken (inside the panel)**. Don't put a sunken element directly on the bg.

### Lines

| Token | Hex | Use |
|---|---|---|
| `--color-border` | `#ECE4D9` | Card and row outlines (1px) |
| `--color-border-strong` | `#CFC5B8` | Empty checkboxes, dashed "add" tiles |
| `--color-divider` | `#F1EBE2` | List separators, calendar grid lines |
| `--color-track` | `#D9CFC2` | Switch-off track, upcoming progress segments, empty meal slots |

### Ink (text and icons)

| Token | Hex | Contrast (surface / bg) | Use |
|---|---|---|---|
| `--color-ink` | `#2E2A26` | 14.0 / 12.0 | Primary text, primary buttons, FAB |
| `--color-ink-2` | `#4F4740` | 9.0 / 7.7 | Secondary text |
| `--color-ink-3` | `#615950` | 6.8 / 5.8 (5.2 on rail) | Labels, captions, eyebrows |
| `--color-ink-soft` | `#8A7F73` | 3.9 / 3.3 | **Large display text only** (≥ 34px), e.g. the header clock |
| `--color-on-ink` | `#FFFDFA` | — | Text on ink or member-colored fills |

### Member palette

Each named color has a **deep** value (text, fills, avatars, checkmarks) and a **tint** (backgrounds). White on every deep color is ≥ 6.1:1, and each deep color on its own tint is ≥ 5.2:1, so deep-on-tint text is always safe.

| Name | Deep | Tint | Default owner |
|---|---|---|---|
| moss | `#55623F` | `#E9EDE1` | Daniel |
| clay | `#7D513C` | `#F3E7DF` | Shelby |
| honey | `#735623` | `#F4ECDA` | Noah |
| fjord | `#4B6270` | `#E4EAEE` | Selectable preset |
| plum | `#6E5A72` | `#EDE6F0` | Spare (new member, guests) |
| pine | `#3F5E4A` | `#E2EBE5` | Selectable preset |
| berry | `#7A4555` | `#F0E4E8` | Selectable preset |
| sand | `#8A6F4B` | `#F2EBE0` | Selectable preset |
| ocean | `#3E6B6A` | `#E2ECEB` | Selectable preset |
| rose | `#8B5E5E` | `#F1E6E6` | Selectable preset |
| **slate** | `#6B6560` | `#EBE8E4` | **System only** — Family, Home, Up for grabs |

People can also store a custom `#RRGGBB` (Profiles / Settings color picker). Custom colors set `--member` / `--member-tint` inline via `memberColorProps()`; named tokens still use `data-color`.

**How to apply a member color:** use `memberColorProps(color)` (named → `data-color`, custom → inline vars), then `var(--member)` / `var(--member-tint)` inside.

```tsx
<section {...memberColorProps(member.color)} className={s.column}>…</section>
```
```css
.column .head { background: var(--member-tint); }
.column .points { color: var(--member); }
```

Member colors are also reused as category accents (meal slots, reward tiles, list icons). That's fine, as long as person-colored things stay tied to the right person. Never offer `slate` in a member color picker.

### Semantic

| Token | Value | Use |
|---|---|---|
| `--color-success` / `-tint` | moss | Completed states, "added" confirmations, Next/Done |
| `--color-alert` | `#B4533A` | The calendar "now" line, destructive emphasis |
| `--color-warning` | clay | "Asleep · wake it" speaker state |
| `--color-star` | `#F4D58D` | Filled "in slideshow" star |
| `--color-star-gold` | bounty-edge | Star glyph wherever stars are money (Star Shop) |
| `--color-peach` | `#E9A27E` | Running-timer button |
| `--color-scrim` | rgba ink 62% | Text panels over photos |
| `--color-night` / `--color-night-ink` | `#0B0A09` / `#8A8178` | Sleep screen only |
| `--color-backdrop` | `#24201C` | Full-screen dim behind the Jukebox pick animation |
| `--color-wall` | `#E9E0D2` | Jukebox record wall |
| `--color-ledge` / `--color-ledge-edge` | `#B98E5E` / `#8E6A43` | Wooden picture ledge |
| `--color-vinyl` / `--color-vinyl-groove` | `#1E1B18` / `#2A2622` | Records |

### Kitchen (Recipes + Meals)

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#FFFDF6` | Recipe cards (box, pull-out, board, drawer). Warmer than `--color-surface` so cards read as paper |
| `--color-rule` | `#DCE6EC` | Ruled lines on recipe cards (28px rows in the box, 40px on the pull-out) |
| `--color-box` / `--color-box-wood` / `--color-box-lip` | wall / ledge / `#A47A4C` | Inside, front and top edge of the recipe box |
| `--color-brass` / `-edge` / `-ink` | `#D9B77A` / `#A8834B` / `#5A4128` | Name plate on the box |
| `--color-board` | `#F7F4EF` | Fridge board behind the meal plan |
| `--color-day` | `#EDE7DE` | Weekday tiles on the board (today is ink) |
| `--note-breakfast` / `-lunch` / `-dinner` / `-snack` | `#F6E6BE` / `#DCE7EE` / `#F5DCCF` / `#E2EBD6` | Sticky notes, one color per meal row |
| `--color-note-ink` | `#3F3934` | Handwriting on sticky notes |
| `--shadow-card` / `--shadow-lifted` | | Paper cards at rest / a card being held (pull-out, flying) |

### Tasks (bounty board)

| Token | Value | Use |
|---|---|---|
| `--color-bounty` | star `#F4D58D` | *Bounty* tag fill |
| `--color-bounty-edge` | `#E0B24F` | Claimed-bounty card border, star icon on tickets |
| `--color-bounty-tint` | note-breakfast `#F6E6BE` | Icon tile on a claimed-bounty card |
| `--color-bounty-ink` | brass-ink `#5A4128` | Text on the bounty tag, ticket points |

The bounty board itself uses `--color-wall` and `--color-paper`, and the slate kicker marks it as shared, not personal.

**Course colors** reuse the member palette through `data-course`: Breakfast = honey, Dinner = clay, Sweets = plum. Put `data-course={recipe.course}` on an element and use `var(--member)` / `var(--member-tint)` inside it, the same way as `data-color`.

### Artwork colors

Album and playlist art brings its own colors. Components never hard-code them: call `artVars(art)` (in `screens/jukebox/parts.tsx`), which sets `--art-bg` and `--art-fg` on the element, then use `var(--art-bg)` / `var(--art-fg)` in CSS. Now playing, the mini player, the vinyl label and the pick wash are tinted this way. Placeholder swatches in data files are the only other hex values allowed outside `tokens.css`.

Recipe photos follow the same rule: `<FoodPhoto photo={recipe.photo} />` shows `photo.url` when there is one and otherwise draws a plate in `photo.palette`. Store recipe photos resized to 560×392 WebP (the largest size they're shown at).

---

## 3. Typography

Two families, self-hosted with `@fontsource-variable` (no network at runtime):

- **Newsreader** (`--font-display`): page titles, names, big numbers, clocks, recipe titles, step text. Weight 400 (300 on the sleep clock). Never bold.
- **Manrope** (`--font-body`): everything else. Weights 500 / 700 / 800 only (`--weight-regular`, `--weight-bold`, `--weight-heavy`).
- **System monospace** (`--font-mono`): only the technical error detail on the error screen. Not self-hosted.

### Display scale (Newsreader)

| Token | Size | Use |
|---|---|---|
| `--display-sm` | 28px | Avatar initials (md), meal titles on idle |
| `--display-md` | 34px | Column and card names, points |
| `--display-lg` | 44px | Panel titles, dialog titles |
| `--display-xl` | 64px | Page titles (`PageHeader`) |
| `--display-2xl` | 72px | Cooking-mode step text |
| `--display-3xl` | 120px | Timers |
| `--display-hero` | 200px | Idle clock (sleep clock: 280px, weight 300) |

Large serif text gets negative tracking: −1px at 64px, −6px at 200px.

### Text scale (Manrope)

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 13px | Tiny meta (counts under tabs) |
| `--text-sm` | 15px | Captions, chips, secondary lines |
| `--text-md` | 17px | Button labels, body |
| `--text-lg` | 20px | List rows, card titles |
| `--text-xl` | 22px | Large rows, emphasized lines |

Nav labels are 14px; **nothing on the kiosk is smaller than 13px**.

### Eyebrows and labels

- **Page eyebrow** (above the title): 18px, weight 800, uppercase, `--tracking-eyebrow` (2px), `--color-ink-3`. Default content: `Saturday · 9:42 AM · 52° partly sunny`.
- **Section label** (`<Label>`): 14px, weight 800, uppercase, `--tracking-label` (1.5px), `--color-ink-3`. Use it for "INGREDIENTS", "COLOR", "TODAY" and similar.

---

## 4. Spacing, radii, sizes

**Spacing** is a 4px scale: `--space-1` (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 7 (28) · 8 (32) · 10 (40) · 12 (48).

- Page padding: 32 top, 40 sides, 30 bottom.
- Gap between the header and content, and between panels: 24.
- Inside panels: 28 padding (`<Panel pad="md">`), 16–20 between groups, 8–14 between rows.

**Radii** go up as things get bigger:

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 12 | Calendar events, small chips |
| `--radius-md` | 16 | Checkboxes, icon buttons, small inputs |
| `--radius-lg` | 20 | List rows, task rows, search inputs |
| `--radius-xl` | 24 | Cards inside panels |
| `--radius-2xl` | 28 | Top-level panels and task columns |
| `--radius-3xl` | 36 | Dialogs |
| `--radius-pill` | 999 | Header actions, chips, segmented controls, status pills |

**Sizes**

| Token | px | Rule |
|---|---|---|
| `--touch-min` | 56 | The smallest tappable thing anywhere |
| `--touch-kid` | 64 | Default for things kids tap (task check ≥ 60) |
| `--touch-big` | 88 | FAB, the main actions on full-screen modes |
| `--sidebar-width` | 120 | |
| `--column-width` | 412 | Horizontal board columns (4 fit at 1920px) |

---

## 5. Layout

- **Target:** 1920×1080 landscape, 100% zoom. Everything is sized in px for this screen. If the display changes, change the tokens, not the components.
- **Shell:** `<AppShell>` = sidebar (120px, `--color-rail`) + `<main>` (flex column, page padding, 24 gap). Every tab screen uses it. Full-screen modes (Cooking, Idle, Sleep, PIN) render outside it as fixed overlays.
- **Sidebar:** 8 tabs (Calendar, Tasks, Rewards, Meals, Recipes, Photos, Lists, Jukebox), then a spacer, then Sleep and Settings pinned to the bottom. Item 96×80, radius 18. Active item: surface fill, ink, weight 800.
- **Page header** (`<PageHeader>`): eyebrow + 64px serif title on the left; actions bottom-aligned on the right. One header per page.
- **Body patterns:**
  - *Focus + side board:* one person's content on the left, a fixed 476px side board on the right (Tasks: daily/weekly lists + bounty board).
  - *Board:* horizontal columns. Native scroll with `scroll-snap`.
  - *Rail + panel:* a 340–440px list on the left, the main panel on the right (Lists, Rewards, Settings).
  - *Panel + detail:* the main grid on the left, a 400–560px detail panel on the right (Photos, Jukebox).
  - *Grid panel:* one panel holding a grid (Calendar).
  - *Object scene:* a physical metaphor filling the panel area: the record wall (Jukebox), the recipe box (Recipes), the fridge board (Meals). Toolbars stay above it at normal size so filters and search are always one tap away.
- Panels fill the remaining height (`flex: 1; min-height: 0`), and long content scrolls **inside** the panel (`.scroll-y`). The page itself never scrolls.

---

## 6. Components

All in `src/components/`. Import from there; don't restyle them per screen unless you add a variant here.

### Button (`Button.tsx`)
`<Button variant size pill icon iconRight block>`

| Variant | Look | Use |
|---|---|---|
| `primary` | Ink fill, white text | The one main action in a panel (Redeem, Add, Approve with PIN) |
| `secondary` | Sunken fill | Lesser actions on a surface (Not now, Add to meal plan) |
| `surface` | White fill | The selected item inside a `Rail` ("Today") |
| `rail` | Rail fill | Actions on the page background (Edit rewards, Exit) |
| `ghost` | No fill | Items inside a `Rail` (Filter, chevrons) |
| `member` | `--member` fill | Person-specific action inside a `data-color` scope |
| `success` | Moss fill | Forward progress (Next step, Done) |

Sizes: `md` 56px · `lg` 64px · `xl` 88px (cooking nav buttons are 112px). Header actions use `pill`. Panel buttons use the default rounded rectangle.

`<IconButton icon label>`: square or round icon-only button. **`label` is required.**

### Rail (`primitives.tsx`)
A pill-shaped `--color-rail` track grouping header controls: `[‹] [Today] [›]`. Children are `ghost` buttons plus one `surface` button for the current choice.

### Segmented
`<Segmented options value onChange label variant="rail"|"member" block>`
- `rail`: page-level view switches (Day / Week / Month / Agenda).
- `member`: person-colored segmented control (e.g. daily/weekly in the Add sheet). The selected tab fills with `--member`, and an optional `sub` line shows a count.

### Panel
`<Panel as pad>`: white surface, radius 28. `pad`: none / sm (16) / md (28) / lg (32).

### Label
Uppercase section label (see Typography).

### Avatar
`<Avatar initial color size="xs|sm|md|lg" muted>`: a circle in the member's deep color with a serif initial. Sizes 26 / 36 / 58 / 72. `muted` = rail fill (a filtered-out person).

### CheckMark
The visual for completion: a 56px rounded square. Empty = 2.5px `--color-border-strong` outline. Checked = `--member` fill with a white tick and a `pop` animation. **Always inside a larger `<button>`** (the whole row is the target).

### IconTile
A tinted rounded square (28% radius) holding an illustration icon at 62% of the tile. It takes `--member-tint` from `color` or the nearest `data-color`.

### Progress
A thin 8px track with a member or ink fill. Uses `transform: scaleX()`, not width.

### Switch
`role="switch"`, 76×44, moss when on.

### Chip
Filter pill, 52px tall. Rail fill; ink fill when selected.

### StatusPill
Rail pill with a status dot: "Spotify connected", "Live with everyone's phones".

### Fab
The floating 88px ink "+" bottom-right for quick-add. One per screen, only on screens where adding is the main job (Tasks, Calendar).

### SoftKeyboard
`<SoftKeyboard value onChange onDone>`: QWERTY pad docked under the main area (not the sidebar). Chromium in cage has no OS soft keyboard, so search fields open this on focus (`inputMode="none"`). Letter / `123` modes, space, backspace, Clear, Done. Keys are ≥ 72px. Same idea as the PIN number pad.

### ScreenLoading
The `Suspense` fallback for tab screens in `App.tsx`: the real sidebar plus an empty panel that fades in. It shows instantly on tap, so the tab highlight moves before the screen's code has loaded.

### ErrorScreen / ErrorBoundary
`<ErrorScreen title message detail actionLabel onAction>`: a full-screen oat page with a serif title, a short sentence, an optional monospace detail line and one 88px primary button. `ErrorBoundary` wraps the app (in `main.tsx`) and the screen area (in `App.tsx`) and shows it with a **Reload** button. Sign-in failures use it with **Retry**.

---

## 7. Patterns

- **Person switcher (Tasks):** rail of 64px pills (avatar 48 + name + "N left"). The selected pill fills with `--member`, and switching re-keys the page body so it slides in.
- **Person hero (Tasks):** 150px band in `--member-tint`: 96px avatar · greeting + one progress segment per task + "x of y today · x of y this week" · points today (56px serif) and balance with progress to the next reward. People who don't earn points get a note pill instead of the numbers.
- **Daily / weekly lists:** two equal surface panels side by side ("Today" and "This week"), each with an icon tile, kicker, title, count, a + that opens Add with that frequency already chosen, a thin progress bar, and an "all wrapped up" banner when everything's done.
- **Task card:** 84px, 1px border, radius 20: 58px tile · title (20px heavy) with "+N pts" in `--member` and the schedule ("Weekdays", "Every other week") · due pill on weekly tasks (later / *today* in member tint / *late* in alert on clay tint) · 52px check. Done = member-tint fill, checked. A claimed bounty gets a 2px `--color-bounty-edge` border, a bounty-tint tile and a *Bounty* tag. The whole card toggles.
- **Bounty board:** 476px `--color-wall` panel with pinned paper tickets (`--color-paper`, ±1° tilt, a pin dot in the claimer's color or slate): icon tile · title + due line · star points (30px serif) and *Claim for {name}* in the current person's color. Claimed tickets go to the bottom at 75% opacity with a rotated "{Name} claimed" stamp.
- **Add sheet (library picker):** a 950px dialog with a two-column body. Left: *1 · Task*, with "Most used" chips over a bordered combobox (search row, then 72px library rows, then a fjord **Create "…"** row when nothing matches exactly); a picked template becomes a tinted summary card with *Change*; creating opens a name field and an icon grid. Right: *2 · Who* (2×2 cards), *3 · How often* (Daily/Weekly segmented → Repeats switch → day presets + circle day toggles, or Due-by day squares), *4 · Points* stepper. The footer is a plain-sentence summary, then Cancel and the primary action.
- **Up next card (Calendar):** 200px band in the next event's member tint: a 132px countdown ring (fills as the start gets closer) with minutes in the middle · kicker "Up next · {name}" · 32px serif title · time and place · "Leave by …" in the member color when the event has travel time. With nothing left today it reads "Nothing else today" with a moon.
- **Today timeline:** a vertical track with an ink fill down to a "Now · 9:42am" pill. Each event is a 64px row with a time label, a dot in the member color (larger with a tint ring for the next event, grey for past ones), a muted card and an avatar. Past events are struck through at 60% opacity.
- **Countdown chip:** a 56px pill with a 42px tinted badge (number of days over a tiny "days") and the title. At most three, nearest first; past dates drop off.
- **Week grid:** day headers with weekday, date (today in an alert-red circle) and the forecast (stroke weather glyph + high). An all-day row, then 50px hours. Events are member-tint cards (14px heavy title, time only if ≥ 1 hour); past events at 55%. The current event card turns solid while its details are open. Tapping a header zooms into that day (bigger cards with the place).
- **Event details:** a 420px card that grows out of the side of the tapped event: tinted head (avatar, who, day and time, close) · 36px serif title · place · "Leave by" pill · italic note · *Remind me* (ink → tint when set, the bell rings) and *Edit*.
- **Live list:**
  - **Header:** a "Live with … phones" pill with stacked faces and a green dot.
  - **Rail:** list cards with a progress bar and the count left (it pops when it changes), and a "Live from phones" feed below.
  - **Main panel:** an add field that shows its aisle guess ("→ Dairy & eggs") as you type; "Usually on it" chips; aisle groups in store walking order, in two columns, each with a tinted icon.
  - **Cart panel:** a drawn cart that fills with blocks in aisle colors, a count badge, and strikethrough chips you tap to put back.
- **List item:** 64px row, round 44px check, 18px heavy text, qty pill, assignee avatar. Something just added gets the aisle tint for a moment; if it came from a phone it also gets a "New · {name}" badge in that person's color.
- **Star Shop (Rewards):** points are called **stars** in the UI and always shown with the gold star glyph (`<Star>` in `screens/rewards/ProductSheet.tsx`, `--color-star-gold`).
  - **Wallet:** a 176px band in the shopper's tint. It has a star jar (one star per 20), the balance in 88px serif counting up, "+N earned this week", and a **Saving for** goal: the wishlisted reward with a progress bar and "N more stars · about N weeks of chores".
  - **Aisles:** Everything / Treats / Time off / Family fun / I can afford, with counts.
  - **Shelf:** a `--color-wall` panel with 4 items per wooden plank (`--color-ledge`). An item card has a tinted art area with the icon, then the aisle, title, and either "N stars left after" (affordable) or a progress bar with "N more stars". Affordable items get a "You can get this" ribbon. The price hangs on a tag on a string; a deal shows the old price struck through.
  - **Deal of the week:** an ink card with a tilted art tile, the deal price, the struck-through old price and a "Save N" pill.
  - **Approval ticket:** a paper ticket with "{Name} wants · waiting for {other parent}", the reward and its price, then *Not now* and *Approve with PIN*. Once approved, an "Approved" stamp replaces the buttons.
  - **Receipt:** paper with dashed rules and a torn bottom edge, listing this week's ledger (+ in success, − in alert) with the balance at the bottom.
- **Product sheet:** a big tinted art panel with sparkles, plus the aisle, a 60px title and an italic blurb. The maths reads *You have − Price = Left after / Still need*. Then *Save for this* (♥) and *Buy for N stars*. After buying, a paper receipt prints with a "Waiting for {other parent}" stamp.
- **Stock the shop:** PIN-gated sheet to add, edit, or retire rewards. Catalog list on the left style of Add sheet; form has title + blurb (soft keyboard), aisle chips, star-price stepper, color swatches and an icon grid. Retiring sets `active = false` so past redemptions stay intact.
- **List row:** 72px, `CheckMark` (52) · text · qty chip · assignee avatar (sm). Checked items move to an "In the cart" strip of moss-tint chips with a "Clear completed" button.
- **Settings row:** min 84px, label + optional hint on the left; a `Switch` or a `secondary` value button with a chevron on the right; divider between rows.
- **Approval banner:** surface card at the top of the page, with `IconTile` · uppercase eyebrow in the requester's color ("WAITING FOR A PARENT") · sentence · `Not now` (secondary) · `Approve with PIN` (primary, lock icon).
- **Parent-only actions** always go through the PIN dialog (`useNav().requirePin({ title, detail, onSuccess })`). Show a lock icon on any button that will ask for the PIN.
- **Empty slot:** 2px dashed `--color-track` border, "+ Add" in ink-3.
- **Unavailable thing** (asleep speaker): 2px dashed border, transparent fill, clay uppercase state, and a short fix ("Asleep · wake it").
- **Confirmation:** swap the button for a moss-tint pill with a tick and a past-tense message ("Added to Groceries"), using `anim-pop`. When the button has to stay (Add to queue can be tapped again and again), show a short ink **toast** above the bottom bar for 2.4s instead. No alerts or modals for confirmations.
- **Record wall (Jukebox Albums and Playlists):** 230px covers on two wooden ledges, a slight hand-hung tilt (±2.5°), horizontal scroll with snap. Tapping the cover plays it; tapping the caption under the ledge opens its songs.
- **Media row:** 76px row, `#` or equalizer · 56px art + title/artist · album · time · 56px icon buttons. The playing row gets a fjord-tint fill and fjord title.
- **Mini player:** 104px bar under browse views, tinted with the current art (`--art-bg`). The song area opens the full Now playing view.
- **Favorite (♥):** `heart` / `heart-solid` icon button. Saved = clay. Always paired with a toast ("Saved “Harvest” to favorites").
- **Recipe box (Recipes):** quick filters + search in one 64px row above the box. Course dividers (340×640, tinted tab with a count) and recipe cards (340×600, one every 310px so they overlap like index cards, ±1° tilt) in a horizontal scroll, with the wooden box front covering their bottom 90px. Card: course band · 220px photo (★ Family favorite badge) · course eyebrow · 34px serif title · time and serves chips · first three ingredients on ruled lines.
- **Pull-out card:** tapping a recipe card lifts it out of the box, flies it to the centre at 1040×700 and flips it over to the full recipe (ingredients with a servings stepper on the left, numbered steps on the right, ruled paper, then *Add to meal plan* and *Start cooking*). Closing plays it backwards. Use it for any "look closer at one card" moment.
- **Fridge board (Meals):** 100px row labels + 7 day columns × 4 meal rows on `--color-board`. A recipe is a small paper card (course band, 58px photo, title, time) held by a magnet in the course color; anything else is a sticky note in the row color, handwritten (serif italic); an empty slot is the dashed "+ Add" tile. Everything on the board has a slight hand-placed tilt.
- **Pick drawer:** a 400px sheet from the bottom for filling one slot: heading ("Thu · Lunch / Pick a recipe") · search · filter chips · Clear slot · close, then one horizontal strip: quick notes (Leftovers, Eat out) · the write-in sticky · divider · recipe cards (230px, photo + title + course · time). Picking flies a copy onto the slot and the board card lands with a small bounce.
- **Write-in:** a sticky note that turns into a 40-character text field with Cancel / Add, so a slot can hold anything ("Pizza night", "Grandma’s"). Saves as `{ text }` in the meal plan. Needs the on-screen keyboard on the Pi (see §11).
- **Overlays over photos:** solid `--color-scrim` panels or 88–94% white panels. Never blur.

---

## 8. Motion

- Animate **only `transform` and `opacity`**. That covers press feedback, pop, rise and fade.
- Durations: `--dur-fast` 150ms (press, switch), `--dur-base` 300ms (progress, rise), `--dur-slow` 450ms (pop).
- Easing: `--ease-out` for everything.
- Shared keyframes in `base.css`: `.anim-pop` (completion, confirmations), `.anim-rise` (new step text, dialogs), `.anim-fade` (slideshow).
- Press feedback: `:active { transform: scale(0.97) }` on buttons, 0.99 on large rows.
- Celebrations are one short CSS pop. No confetti libraries, no looping animation, no autoplay video.
- `prefers-reduced-motion` turns animations off (already in `base.css`).

### Star Shop motion

The shop is allowed to be a bit showy; everything still plays once.

- **Wallet:** stars drop into the jar 70ms apart, the balance counts up in 12 eased steps (~660ms) and pops when it lands, the star spins in, and the goal bar fills (1s).
- **Shelves:** items rise in 55ms apart; each price tag swings in on its string and settles at its tilt. One light sweep crosses each affordable item.
- **Buy:** 7 stars fly from the wallet number to the buy button (600ms, 55ms apart), the wallet counts down, then the receipt prints (scaleY from the top, 700ms) and the stamp thumps on.
- **Approvals:** a new ticket drops in. Approving stamps it, then it slides off; *Not now* slides it off right away and refunds the stars.
- **Wishlist:** the heart pops, and the wallet's goal updates.

### Calendar motion

- **Week / day change:** the grid slides 60px in the direction you moved, and the title follows at 20px (400ms). Events drop in 12px with a slight overshoot, 14ms apart.
- **Now:** the red line's dot pops in after 600ms. The timeline fill grows down to now (scaleY, 1s). The countdown ring fills once on load (stroke-dashoffset, 1.2s), and then only moves with the minute clock.
- **Filters:** the person's avatar pops and their events leave or arrive with the grid.
- **Details:** grows from the event's side (scale 0.6 → 1, 400ms overshoot) and shrinks away (180ms). *Remind me* rings the bell once.
- **Coming up:** chips rise in 80ms apart.

### Lists motion

- **Check off:** the check fills and pops, a line draws through the text (350ms), the row slides out right (350ms), then a block drops into the cart, the cart bumps and its badge updates.
- **Add:** a suggestion chip shrinks away (220ms) and the new row slides in from the left in the aisle tint, which fades over 900ms. An item from a phone keeps its tint and "New · {name}" badge for 6s, and a feed entry drops in at the top.
- **Clear cart:** blocks fly up and out, chips slide off to the right 40ms apart (700ms total).
- **Meals:** the cart icon wiggles, then the ingredients cascade into Groceries 110ms apart.
- **Switch list:** the title rises and the groups fade up, staggered 70ms.

### Tasks motion

One-shot only; nothing on this screen loops.

- **Switch person:** the body slides in 24px with a fade (350ms) and the title rises 8px. Pills cross-fade color (350ms).
- **Cards:** rise in with a 45ms stagger on load and when switching person.
- **Complete:** the check pops (`anim-pop`), a "+N" in the member color floats up 46px and fades (1s), today's points pop, and the progress segments fill with a slight overshoot (40ms apart). Finished cards stay where they are; they only sink to the bottom on the next visit.
- **Claim a bounty:** the ticket lifts (32% of 820ms), then flies toward the weekly list, shrinks to 0.55 and fades. The new card slides in from the right with an overshoot (500ms).
- **Add sheet:** slides up from the bottom (500ms) over a fading scrim; library rows fade up 30ms apart; day toggles and the points value pop when changed; closing drops the sheet 120px and fades it (300ms).

**CSS Modules note:** keyframe names in a `.module.css` file are scoped to that file, so `animation: rise` there does **not** reach the global `rise` in `base.css`. Either use the `.anim-pop` / `.anim-rise` / `.anim-fade` classes in JSX, or define the keyframes in the module itself.

### Kitchen motion (Recipes + Meals)

One-shot only; nothing here loops except the steam.

- **Drop in:** cards and dividers slide up into the box (500ms, 45ms stagger) on load and whenever the filter changes. Board items stick on from 26px above with a slight overshoot (450ms).
- **Pull-out:** lift 300ms → fly to centre 600ms → flip 650ms; close reverses (flip back, then 450ms back into the slot). The overlay grows out of the card's measured `getBoundingClientRect()` (FLIP), so it works wherever the box is scrolled.
- **Drawer → board:** a copy of the picked card moves with `translate` + `scale` to the slot in 600ms, then the real card lands with a 1.08 → 1 bounce. Never animate width/height.
- **Add ingredients:** the cart wiggles once and a "+14 to Groceries" chip floats up and fades.
- **Steam** over tonight's dinner: three wisps, 3.4s each, 1.1s apart. It's the only loop on these screens; keep it that slow.

### Music motion (Jukebox only)

The only looping animations allowed in the app, and only while music is playing:

- Calm, not rhythmic: the slowest loop sets the mood. Pulse every **3.2s**, rings over **6.4s**, record one turn per **4s**, equalizer bars **1.8–2.6s**. Never under 1.8s per cycle.
- Small: scale changes ≤ 5% (art 2%, glow 5%), ring opacity ≤ 0.3.
- **Pause everything with playback** (`animation-play-state: paused`); hide the rings.
- One-shot transitions (the pick animation) can be bolder but must end in a fade, never a hard cut, and finish in under 2.5s.
- No per-song tempo: Spotify's BPM data isn't available to new apps.

---

## 9. Icons

- One inline-SVG set in `src/components/Icon.tsx`. No icon fonts, no emoji.
- **Illustration icons** (48 grid): tasks, rewards, recipes, nav. **UI icons** (24 grid): chevrons, plus, play, lock and other controls.
- Style: 2.4 stroke (2.2 inside tiles), round caps and joins, `currentColor`, no fills except tiny accents.
- Sizes: nav 28–30 · task tile 40 · reward/recipe hero 72–96 · UI 20–26.
- Icons are decorative (`aria-hidden`) unless they are the only content of a button, in which case the button gets `aria-label`.
- **To add an icon:** draw it on the right grid with the same stroke, add it to `ILLUSTRATION` or `UI`, and the `IconName` type updates automatically.

---

## 10. Accessibility

- Text contrast ≥ 4.5:1 (≥ 3:1 only for display text ≥ 34px). The ink tokens are already checked; don't lighten them.
- Use real elements: `<button>` for actions, `<input>` + `<label>` for fields. Never put an onClick on a div.
- Toggles expose state: `aria-pressed` (tabs, chips, task rows), `role="switch"` + `aria-checked`, `aria-current` (nav, selected list).
- Icon-only buttons need `aria-label`. Progress bars need `aria-label`. Live changes (servings, PIN dots) use `aria-live="polite"`.
- Color is never the only signal: completed items also get a tick, the selected tab also changes weight, an asleep speaker also gets a dashed border and text.
- Focus ring: 3px fjord outline with a 3px offset (`:focus-visible`), already global.
- The mouse cursor is hidden on the Pi production build (`html.hide-cursor` in `base.css`, applied when `import.meta.env.PROD`). Local `pnpm dev` keeps the cursor so laptop work is usable. On the wall touchscreen, the pointer does not follow taps and would otherwise sit in the middle of the screen.

---

## 11. Performance on the Pi 3 B+ (1 GB)

These are rules, not suggestions.

- **Styling:** CSS Modules + CSS custom properties only. Zero runtime CSS-in-JS. No Tailwind or MUI needed.
- **Code splitting:** every screen is `React.lazy` in `App.tsx`. Keep shared code in `components/` small.
- **Infinite animations:** only the Jukebox music motion above (only while playing) and the steam on tonight's dinner, and only on mounted views.
- **Non-transform exceptions:** the Calendar countdown ring animates `stroke-dashoffset` on one 132px SVG, once on load and at most once a minute. Don't use this for anything bigger or more frequent.
- **Text input:** the Pi has no keyboard. Search fields and the meal write-in need an on-screen keyboard: either the compositor's (e.g. `squeekboard` under Wayland) or a small in-app keyboard component that appears when an input is focused. Keep inputs short (the write-in is capped at 40 characters).
- **Forbidden:** `backdrop-filter`/blur, large or stacked `box-shadow` (only `--shadow-float` on the FAB, `--shadow-dialog` on the PIN dialog, and the kitchen paper shadows `--shadow-card` / `--shadow-lifted`, which sit on static cards inside a scroll layer), animating `width/height/top/left/background-color` in loops, autoplay video, big PNGs, JS scroll libraries, icon fonts, chart libraries.
- **Scrolling:** native overflow with `.scroll-x` / `.scroll-y`, plus `scroll-snap` for columns.
- **Images:** serve resized photos (longest side ~1920 for the slideshow, ~400 for thumbnails). Use `loading="lazy" decoding="async"`. Mount only the current slideshow image and preload just the next.
- **Timers:** the clock ticks once a minute (`useClock`). The idle detector uses one timeout. Countdown timers tick only while running.
- **Realtime:** subscribe only to what the current screen shows; unsubscribe on unmount.
- **Fonts:** two variable fonts, `wght` axis only, `font-display: swap`.
- Build with `vite build` (target `safari14`/`es2020` for WPE WebKit). Never build on the Pi.

---

## 12. Writing style

- Sentence case everywhere ("Add to meal plan", not "Add To Meal Plan"). Uppercase only through the eyebrow and label styles.
- Short, warm, plain: "Morning all wrapped up", "Noah's points turn on in Settings once he's ready for chores", "Asleep · wake it".
- Say what happened or what to do next: "Added to Groceries", "Kitchen speaker isn't available — wake it or pick another".
- Numbers: "3/10 done today", "+10 points", "1 hr 15 min", "1½ cups".
- Use names, not roles ("Shelby wants…", not "User requested…").
- Middle dot ` · ` separates meta items.

---

## 13. Code conventions

- One folder per concern: `components/` (shared UI), `screens/` (one file + one `.module.css` per screen), `data/` (mock data, later TanStack Query hooks), `hooks/`, `lib/` (pure helpers), `app/` (App + navigation context).
- Screens get data from hooks or `data/` modules shaped like the Supabase tables (`types.ts`). Swap mock data for queries without changing the JSX.
- Member color flows through `memberColorProps()` → `data-color` for named tokens, or inline `--member` / `--member-tint` for custom hex. Use other inline `style` only for computed geometry (calendar event `top`/`height`, progress `scaleX`).
- Class names: camelCase in modules (`.taskTitle`). Compose with template strings; no classnames library.
- New screen: create `screens/Name.tsx` + `Name.module.css`, wrap it in `<AppShell>` + `<PageHeader>`, add it to `screens` in `App.tsx` and to `TABS` in `AppShell.tsx`.

---

## 14. Checklist before merging UI

- [ ] No raw hex values outside `tokens.css` (except photo placeholders and artwork swatches in data)
- [ ] Every tappable element ≥ 56px and is a `<button>`/`<a>`/`<input>`
- [ ] Icon-only buttons have `aria-label`; toggles expose state
- [ ] Person-colored UI uses `memberColorProps()` and `var(--member)` / `var(--member-tint)`
- [ ] Only `transform`/`opacity` animated; no blur, no heavy shadows
- [ ] Long content scrolls inside a panel, and the page doesn't scroll
- [ ] Copy is sentence case, short, and names people
- [ ] Looks right at 1920×1080 (`npm run dev`, open `#yourscreen`)
