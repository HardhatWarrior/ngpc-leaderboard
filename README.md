# NGPC Leaderboard

Hosted at [ngpc-dev.com](https://www.ngpc-dev.com) — public hiscore leaderboards for NGPC homebrew
games, fed by QR codes generated on-device after a completed game.

## Structure

- `index.html` — the landing page: a grid of game tiles, each linking to that game's own
  leaderboard folder.
- `lb/index.html` — Neo Bowling's leaderboard page. Backed by Firebase Firestore. (Folder name is
  a holdover from before multi-game support — the Bowling QR encoder already ships with
  `/LB/<payload>` baked in, so it wasn't renamed to `/bowling/` to avoid re-touching an
  already-verified on-device build. New games should use a folder name that matches their own
  natural slug, e.g. `/tetris/`.)
- `404.html` — GitHub Pages' catch-all for any unmatched path. QR alphanumeric-mode encoding is
  uppercase-only, so a QR-embedded URL like `https://www.ngpc-dev.com/LB/<payload>` always 404s
  against the real lowercase `/lb/` folder GitHub actually serves. This file lowercases just the
  first path segment and redirects there, leaving the rest of the path untouched — generic across
  every game, so a new game's QR works through here with zero changes to this file as long as its
  folder name is the lowercase of whatever uppercase segment its own QR encodes.
- `assets/` — shared static images (currently just each game's title-screen capture for its
  landing-page tile, taken from the real emulator via `ngpc_emu_screenshot`, not mocked up).
- `firestore.rules` — the Firestore security rules, version-controlled here since this project has
  no Firebase CLI/service-account wired up; deploy by hand via the Firebase console (Firestore
  Database > Rules). Validates each game's score schema separately, keyed off the `game` field, so
  one game's rules can't be satisfied by another game's differently-shaped data.
- `CNAME` — GitHub Pages custom domain config.

## Adding a new game

1. Give the on-device QR encoder a full-URL payload: `https://www.ngpc-dev.com/<slug>/<payload>`,
   same raw payload format as today (routing 2-char game code first).
2. Create `<slug>/index.html` for that game's leaderboard page (Bowling's `lb/index.html` is the
   reference implementation — Firebase wiring, QR scan/decode stack, `payloadFromPath()`/`boot()`
   for direct link-taps, and `lastPathSegment()` so the in-page photo/camera scan strips a URL
   prefix the same way).
3. Add that game's score-schema validator function to `firestore.rules` and re-publish via the
   Firebase console.
4. Add a tile to `index.html`'s grid (art via a real `ngpc_emu_screenshot` capture, not placeholder
   art) linking to `/<slug>/`.

## QR payload format

`<2-char game code><3-char initials><2-digit weight lbs><2-digit roll count><one char per roll>`
— game code `BW` routes to Bowling. See `lb/index.html`'s own `parsePayload()` for the exact
parsing, and the Bowling project's `src/core/ngpc_qr.c` for the on-device encoder. Other games are
expected to define their own payload shape after their game code — the site routes purely on the
game code + URL folder, not on any fixed payload layout.
