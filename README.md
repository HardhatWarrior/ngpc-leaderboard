# NGPC Leaderboard

Hosted at [ngpc-dev.com](https://www.ngpc-dev.com) — live public hiscore leaderboards for Neo Geo
Pocket Color homebrew games. A game generates a QR code on-device after a completed run; the
player scans it with their phone, and the score gets uploaded and compared against everyone
else's. Several of the games can also be played directly in the browser (PC or mobile), no
hardware required.

No backend of its own: this is a static site (GitHub Pages) backed entirely by Firebase
(Firestore for data, Firebase Auth for accounts, Firebase Storage for ROM/screenshot uploads).
There is no server-side code anywhere in this repo except two small GitHub Actions automations —
everything else is plain HTML/CSS/JS talking to Firebase directly from the browser, with
`firestore.rules`/`storage.rules` doing all the access control.

See [about/index.html](about/index.html) (live at `/about/`) for the project's own write-up —
why it exists, how the QR flow works, and what's next.

## Games currently on the site

| Slug | Game | Notes |
|---|---|---|
| `bw` | Neo Bowling | First game shipped; folder used to be `lb/` (its QR still encoded `LB`-adjacent) |
| `tt` | Tetris | |
| `yz` | Neo Yahtzee | |
| `fk` | Farkle | Score display is "N rounds", not a raw score |
| `2k` | 2048 | |
| `overrev` | Over Rev | Sorted ascending (lowest time wins) — the only game here that is |
| `gd` | Gardenia | Third-party (Ahchay); scoped to one of 3 modes at a time |
| `sd` | Sudoku | Score display is a formatted time (`M:SS`), scoped to one difficulty at a time; no on-device initials, identified by account username only |
| `xn` | Xenon 2 | Third-party (Napomex); raw QR text has no URL wrapper at all, unlike every other game here |

Each game's own on-device QR encodes a 2-character routing code first (`BW`, `TT`, `OV`, ...) —
`index.html`'s scan flow and `firestore.rules`' per-game score validators both key off that code.
Most leaderboard folders are just that code lowercased (`/bw/`, `/tt/`, `/sd/`...); `overrev/` is
the one exception, kept as its full name rather than `/ov/`. `bw/`, `tt/`, `yz/`, `fk/`, `2k/`, `gd/` used to live at
different folder names (`lb/`, `tetris/`, `yahtzee/`, `farkle/`, `2048/`, `gardenia/`) before being
shortened to their 2-char codes; those old folders are kept as one-line redirect stubs (see
**Legacy redirect stubs** below) so an old bookmark, shared link, or a cartridge that never got its
firmware updated still lands somewhere real.

## Structure

### Public pages
- **`index.html`** — the landing page: a live grid of game tiles (built from Firestore, not
  hardcoded), a recent-activity ticker, sort/search, and the QR scan entry point for submitting a
  score. Also carries `meta/siteSettings.hideGamesGrid`, an admin-only kill switch that can hide
  the whole grid site-wide for testing.
- **`<slug>/index.html`** (`bw/`, `tt/`, `yz/`, `fk/`, `2k/`, `overrev/`, `gd/`, `sd/`, `xn/`) —
  one leaderboard page per game: QR scan/decode (camera or photo upload), score submission,
  ranked board with per-game scorecard detail, ROM download, and (where available) a link into
  that game's in-browser player.
- **`play/<slug>/index.html`** (folder names don't all match the leaderboard slug — e.g. `bw`'s
  player is at `play/bowling/`) — an in-browser NGPC player built on
  [EmulatorJS](https://emulatorjs.org/) (vendored under `play/emulatorjs/`), gated behind sign-in.
  Captures a frame straight off the emulator's own canvas to decode the in-game QR code and feeds
  it into that game's normal submit flow. Shows a public "Played N times" counter.
- **`about/index.html`** — the project write-up (see above).
- **`account/index.html`** — a signed-in user's own settings: username, optional recovery email
  (not yet wired to a real password-reset email flow), a 32×32 pixel-art avatar editor (same
  RGB444 color model as the NGPC Tile Editor, every pixel independent — no per-tile palette limit
  since this isn't real tile hardware), and a paginated "Your Submissions" list with delete.
- **`user/index.html?u=<username>`** — a public read-only profile: avatar, stats, and that
  player's own submissions.
- **`dev/submit/index.html`** — lets an account flagged `isDeveloper` (admin-granted) propose a
  new game (ROM + screenshot + a structured payload-format spec). Sends the admin an email on
  submit (see **Admin email alerts** below).
- **`404.html`** — GitHub Pages' catch-all. QR alphanumeric-mode encoding is uppercase-only, so a
  QR-embedded URL always 404s against the real lowercase folder GitHub serves; this file
  lowercases the first path segment and redirects with the remainder moved into the URL **hash**
  (never reaches the server) so the retry is a guaranteed single hop, no risk of 404ing again.
- **`tile_editor/`** — a separate but linked tool (2bpp tile/sprite editor, tilemap builder, and a
  true-color variant) a developer can use to design their avatar or game art, with an
  "Import from Tile Editor" path into the avatar editor.
- **`games/index.html`** — an inert, hand-written, **not linked from anywhere on the live site**
  placeholder (hardcoded to 7 of the 9 current games). Predates the real Firestore-backed grid on
  `index.html`; likely safe to delete, kept for now in case it's a work-in-progress redesign.

### Admin-only pages (gated on a single hardcoded admin UID, both client-side UI and
`firestore.rules`' `isAdmin()`)
- **`admin/index.html`** — player approval, the pending-new-game-submission review queue, a
  site-wide **All Submissions** panel (every score, paginated, with delete and a manual per-game
  **NEW badge** toggle), the **Games** table (dev status, developer, ROM-download/play counts), the
  homepage grid-hide toggle, and a collapsible **Site Stats** panel (page views: total/today/last-
  7-days/top pages).
- **`admin/game/index.html`** — shared by the admin and a game's own assigned developer: dev
  status (`coming-soon` / `dev` / `beta` / `final`), ROM upload, and a read-only payload-format
  reference per game.

### Shared code
- **`auth.js`** — loaded by every single page via one `<script src="/auth.js">` tag. Owns:
  - Username/password auth (Firebase Auth's email/password provider under the hood — a username
    maps to a deterministic, never-delivered synthetic `@users.ngpc-dev.com` address so nobody
    ever needs a real email to sign up).
  - The account status bar injected at the top of `#shell` on every page, and its sign-in/sign-up
    modal.
  - Avatar packing/rendering (`packColor`/`unpackColor`/`renderAvatarToCanvas`), shared by every
    page that shows one so they can never render it differently from each other.
  - Per-game score display helpers (`scoreValueDisplay`/`scoreHasDetail`/`scoreDetailHTML`/
    `scoreInlineMeta`) — the one place that knows Sudoku shows a time, Farkle shows "N rounds",
    Over Rev shows a formatted race time, and everything else shows a plain score, so no page
    (including the homepage ticker) can drift out of sync with that per-game shape again.
  - Site-wide page-view tracking (`pageViews`/`pageViewsDaily` in Firestore) and admin email
    alerts (`notifyAdmin`, see below) — both fire automatically, no per-page wiring needed.
- **`firestore.rules`** — all Firestore access control, deployed **by hand** via the Firebase
  console (Firestore Database → Rules); this project has no Firebase CLI/service-account wired up
  for automatic rule deploys, so this file is the version-controlled source of truth, not
  something a push applies on its own. **Whenever this file changes, it has to be manually copied
  into the Firebase console and published, or the change does nothing live.** See its own
  extensive inline comments for the reasoning behind each collection's rules — several are
  deliberately non-obvious (e.g. why a `list()`-breaking rule shape had to be avoided twice).
- **`storage.rules`** — same deal, for Firebase Storage (ROM files, submission uploads). Requires
  the project's Blaze plan to actually use Storage.

### Legacy redirect stubs
`lb/`, `2048/`, `farkle/`, `gardenia/`, `tetris/`, `yahtzee/` are each a ~28-line page that does
nothing but `location.replace()` to that game's current 2-char-code folder, carrying any URL hash
straight through. Not stale duplicates — kept deliberately so an old bookmark, shared link, or a
cartridge whose firmware still encodes the old prefix keeps working.

### Automation (`.github/`)
- **`workflows/flag-rom-updated.yml`** + **`scripts/flag-rom-updated.js`** — runs whenever a ROM
  under `play/*/*.ngp` changes on `main`; bumps that game's `games/{slug}.romUpdatedAt` /
  `updatedUntil` in Firestore via the Admin SDK (`FIREBASE_SERVICE_ACCOUNT` repo secret), so
  pushing a new in-browser-player ROM gets the **UPDATED** badge for free instead of needing a
  manual re-upload through `/admin/game/`.
- GitHub Pages' own zero-config deploy workflow (not a committed file — auto-generated by GitHub
  when Pages' source is set to "Deploy from a branch") builds and deploys `main` on every push. It
  needs the repo's **Settings → Actions → General → Workflow permissions** set to allow
  `id-token: write`, or every deploy fails at the `deploy` step with a permissions error.

## Firestore data model (high level)

| Collection | What it holds | Who can write |
|---|---|---|
| `users/{uid}` | username, avatar, `approved`, `isDeveloper`, `wantsDev` | owner (limited fields) + admin |
| `users/{uid}/private/contact` | optional recovery email | owner + admin only (never public) |
| `usernames/{lower}` | uniqueness reservation, `{uid}` | create-once, owner |
| `scores/{id}` | one submitted score, shape validated per-game | owner (on create) + admin (approve/delete) |
| `games/{slug}` | tile metadata, dev status, ROM path, `newUntil`/`updatedUntil`, `romDownloads` | admin (all fields) + assigned developer (status/ROM fields only) + public (download-count +1 only) |
| `gameSubmissions/{id}` | a pending new-game proposal | submitter (while pending) + admin |
| `pageViews/{pathKey}` + `pageViewsDaily/{pathKey_date}` | site-wide traffic counters | public, increment-only |
| `meta/siteStats` | homepage's own visible page-view counter | public, increment-only |
| `meta/siteSettings` | `hideGamesGrid` testing toggle | admin only |
| `mail/{id}` | outbound admin notification emails | signed-in, recipient hardcoded in the rule itself |

A recurring pattern worth knowing before touching `firestore.rules`: a rule clause that compares
`request.auth.uid` against a **per-document field** (e.g. `resource.data.uid`) breaks Firestore's
ability to prove an unfiltered `list()` query safe, and fails the *whole* query with
`permission-denied` — even for documents that clause would've allowed. Every collection here that
needs a public or admin-wide list works around that either by depending only on `request.auth`
(`isAdmin()`, hardcoded UID) or by denormalizing an `approved`-style field onto the document itself
so a `.where()` filter can do the real work instead of the security rule.

## Admin email alerts

`auth.js`'s `notifyAdmin()` writes a doc to `mail/{id}` on every new signup and every new game
submission. That collection is watched by the Firebase **Trigger Email** extension (installed
separately via the Firebase console → Extensions, requires the Blaze plan and an SMTP
provider/app-password configured at install time) — it turns each doc into a real email, sent to a
single hardcoded recipient address, and writes delivery status back onto the doc.
`firestore.rules`' `mail/{id}` rule re-hardcodes that same recipient so a client can never redirect
a notification to an arbitrary address; the constant in `auth.js` alone is not a security boundary.

## Analytics

Two independent, non-overlapping layers:
- **Cloudflare Web Analytics** — a single JS beacon dropped into every page's `<head>`. Real
  visitor analytics (country, device, referrer) in the Cloudflare dashboard; no cookies, no
  consent banner needed, and no DNS/proxy change to this GitHub-Pages-hosted domain required.
- **Firestore-backed page views** (`pageViews`/`pageViewsDaily`, written by `auth.js` on every
  page load) — feeds admin's own **Site Stats** panel (total/today/last-7-days/top pages) and each
  play page's public "Played N times" readout, entirely independent of Cloudflare.

## Adding a new game

1. On-device QR payload starts with that game's own 2-char routing code (own choice, unique).
2. New leaderboard page at `<slug>/index.html` — copy an existing one close to its own shape
   (`sd/index.html` if it has no on-device initials, `overrev/index.html` if sorted ascending,
   otherwise any of the others) as the starting point: Firebase wiring, QR scan/decode stack
   (zbar-wasm → `BarcodeDetector` → jsQR, in that order), `payloadFromEntry()`/`boot()` for
   direct link-taps, and `lastPathSegment()` to strip a URL prefix the same way every page does.
3. Add a `is<Game>Score()` validator function to `firestore.rules`, OR it into the `scores`
   collection's `allow create`, and re-publish the rules file by hand via the Firebase console.
4. Add the game to `GAME_ROUTES`/`GAME_NAMES` in `index.html` (and anywhere else those tables are
   duplicated — `account/index.html`, `admin/index.html`, `user/index.html`, each play page's own
   scan handler) and a `games/{slug}` Firestore doc (admin-only write) so it shows up in the
   homepage grid.
5. If it should be playable in-browser, add a `play/<folder>/index.html` following an existing
   one, and reference its ROM under `play/<folder>/`.

A developer can independently mark their own approved game `coming-soon` from `/admin/game/` at
any point — the homepage shows a bottom banner and suppresses the NEW/UPDATED corner ribbon
entirely while set, and the tile becomes unclickable (no `href` at all) until they move it to a
real status, at which point the NEW ribbon starts a fresh 30-day countdown from that moment.
