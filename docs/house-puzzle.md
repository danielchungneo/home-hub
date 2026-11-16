# House Puzzle — Design Doc

A living doc for the hub's **Games** section: a story-driven scavenger hunt that starts by scanning a QR code on the kiosk and sends players around the house solving riddles and puzzles on their phone and the kiosk, ending in a real reward.

---

## 1. Core Concept

- **Start:** Kiosk shows a QR code → phone opens a web page (`/hunt/join?session=…`). No app install needed, so guests can play.
- **Loop:** Kiosk shows story + clue → players find a spot / solve a puzzle → NFC tap or puzzle solve advances the step → kiosk updates.
- **Reward:** Each solved step reveals one digit of a physical lockbox code. Finale = open the lockbox.

### Kiosk vs. phone
| Kiosk (Pi 3 B+, 1GB) | Phone |
|---|---|
| Story panels, clue display, progress, hints, celebrations | Puzzles, mini-games, mic input, NFC tap landing pages |
| Keep light: CSS transforms/opacity only, no WebGL, no `backdrop-filter`, lazy-load per step | Can handle heavier stuff (canvas games, audio analysis) |

---

## 2. Hunt #1 — "The Great Bone Heist"

**Premise:** Moose has stolen the Golden Bone and hidden it somewhere in the house. He's a good boy but a terrible criminal, so he left a trail of clues. Follow it, crack his lockbox code, and catch him.

**Progress UI:** Row of paw prints on the kiosk that fill in as steps are solved. Each solve shows a short "Moose confession" panel and reveals a code digit.

**Estimated time:** 20–30 min

| # | Step | Type | Where it happens | Reward |
|---|---|---|---|---|
| 0 | Intro cutscene + QR join | `intro` | Kiosk | Story setup |
| 1 | First riddle → find tag | `riddle_tag` | Kiosk clue → NFC tag | Digit 1 + next riddle |
| 2 | Close-up photo → find object | `zoom_photo` | Kiosk image → NFC tag | Digit 2 + next clue |
| 3 | Slide puzzle: get the bone out of the crate | `slide` | Phone | Photo/riddle → ukulele |
| 4 | Play 3 chords on the ukulele | `chords` | Phone mic | Digit 3 + kiosk jingle |
| 5 | Catch Moose — tap his collar | `tag_collar` | NFC tag on Moose | Digit 4 + lockbox location |
| 6 | Open the lockbox | physical | Lockbox | Prize + a real bone for Moose |

### Step details

**1. First riddle**
- Moose's voice. Draft: *"I eat here twice a day, but I never do the dishes. Look where my dinner waits."* → tag under food bowl / on food bin.

**2. Close-up photo**
- Extreme close-up of a household object (dryer knob, lamp texture, book spine).
- Hints zoom the photo out progressively (CSS `transform: scale()` animation — cheap on the Pi).

**3. Slide puzzle**
- Block-escape style (like a sliding-key puzzle): slide blocks to free the Golden Bone from the crate.
- Solve reveals photo of next location or a riddle pointing to the ukulele.

**4. Ukulele chords**
- Tag on ukulele opens "Moose's Lullaby" — 3 chord diagrams shown (e.g. C → G → Am).
- Phone mic listens for the chords in order. Diagrams are shown, so anyone can play it.

**5. Catch Moose**
- Clue: *"I hid the last secret somewhere I can never lose it. Come find me."*
- Moving target — players have to track down Moose and tap his collar tag.
- Kiosk hint button if he's napping somewhere hidden ("Moose was last seen near something soft").
- Reveals final digit + *"The bone is locked in [location]."* → confetti on kiosk.

---

## 3. Step Library (reusable puzzle types)

Ideas for this hunt and future ones. Add freely.

### Physical + NFC
- [x] **Riddle → tag** — core loop.
- [x] **Zoomed / close-up photo → tag** — hints zoom out.
- [ ] **Sequence tags** — visit tags in a specific order (Simon-style); wrong tag resets.
- [ ] **Hot/cold decoy tags** — decoys respond "warmer"/"colder."
- [x] **Moose's collar** — moving-target tag.
- [x] **Lockbox finale** — digits collected across steps.

### Kiosk + phone together
- [ ] **Split clue** — half a symbol grid on kiosk, half on phone; hold phone up to line them up.
- [ ] **Tilt maze** — phone tilt rolls a ball on the kiosk via Realtime broadcast (keep it slow-paced for latency).
- [ ] **"Bomb defusal" mode (2+ players)** — kiosk is the bomb, each phone shows a different manual page; must talk it out.
- [ ] **Morse / flash** — kiosk flashes or beeps a code; phone decoder pad.

### Phone puzzles
- [x] **Slide / block-escape puzzle**
- [x] **Ukulele chord detection (mic)**
- [ ] Sliding tile (15-puzzle) revealing a photo
- [ ] Jigsaw of the next hiding spot (headbreaker)
- [ ] Mini sudoku / crossword with themed answers

### Using my own stuff
- [ ] **Engraved decoder wheel / coaster** hidden in the house; kiosk shows a cipher only it can decode.
- [ ] **3D-printed pieces** that fit together one way, with the answer or a tag inside.
- [ ] **Jukebox clue** — song snippet through the speakers; title hints the location.
- [ ] **Hub tabs as clues** — e.g., a hidden Calendar event reveals a digit.

---

## 4. Tech Notes

### Architecture
- **Supabase Realtime** syncs kiosk ↔ phones. DB changes for progress; Realtime *broadcast* for fast events (tilt input).
- **NFC tags hold URLs, not data:** `https://<hub>/t/<tagId>`. iPhone XS+ and Android open NDEF URLs natively (don't rely on Web NFC — Chrome Android only). Server checks "is this tag the answer to this session's current step?" Tags stay generic and reusable.
- Tags: NTAG213/215.

### Data model (Supabase)
- `hunts` — id, title, intro text
- `hunt_steps` — hunt_id, order, type (`riddle_tag`, `zoom_photo`, `slide`, `chords`, `tag_collar`, …), config JSON, digit reward, hints[]
- `tags` — tag_id → label (e.g. `7f3a` → "Moose collar")
- `sessions` — hunt_id, current_step, started_at, hints_used, players

A new hunt (birthday, Christmas) = new rows, no new code.

### Libraries
**Kiosk:** XState (hunt state machine), uqr/qrcode (join QR), canvas-confetti, Howler.js (sound cues).
**Phone:** dnd-kit (drag puzzles), headbreaker (jigsaw), Meyda (chord detection), Kaplay/Phaser (mini-games), DeviceOrientation API (tilt — iOS needs a permission tap).

### Chord detection
- Pitch libs (e.g., Pitchy) are single-note only — chords need **Meyda** `chroma` (12-note energy vector).
- Compare against chord templates: C = C·E·G, G = G·B·D, Am = A·C·E, F = F·A·C.
- Cosine similarity; count a chord once it matches for ~400–600ms.
- C/Am/F share notes — prefer C → G → Am, or tune thresholds.
- Mic needs HTTPS + user tap to start. Show a "listening…" meter.

### Slide puzzle
- Hand-roll (~200 lines): pieces `{id, x, y, w, h}` on a grid; pointer-event dragging constrained to empty cells along a row/column.
- Offline BFS solver to verify layouts are solvable, tune difficulty by min moves, and power a "show me one move" hint.

### Moose's collar tag
- Engraved acrylic/wood tag with an inlaid NTAG215, sealed in epoxy (waterproof, scratch-proof).
- Keep it light; test read range through fur and at collar angles.

---

## 5. Open Decisions
- [ ] Real tag spots + riddles for Hunt #1 (pick 4–5 objects/spots)
- [ ] Who's the prize for (guests, kids, Shelby)?
- [ ] Lockbox: cheap 4-digit cash box vs. 3D-printed puzzle box
- [ ] Final chord progression for "Moose's Lullaby"

---

## 6. Idea Inbox
_Drop new step ideas here, sort later._

-
