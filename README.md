# NGPC Leaderboard

Hosted at [ngpc-dev.com](https://www.ngpc-dev.com) — public hiscore leaderboards for NGPC homebrew
games, fed by QR codes generated on-device after a completed game.

## Structure

- `lb/index.html` — the leaderboard page (currently: Neo Bowling). Backed by Firebase Firestore.
- `404.html` — identical copy of `lb/index.html`, serving as GitHub Pages' catch-all for any
  unmatched path. This is what lets a QR code encode a full URL
  (`https://www.ngpc-dev.com/lb/<payload>`) whose payload rides in the path rather than a query
  string — necessary because QR codes in the efficient "alphanumeric" encoding mode can't contain
  `?`, `=`, or `&`. The page reads `location.pathname` itself either way, so this works whether
  GitHub finds a literal file match or falls through to the 404 handler.
- `CNAME` — GitHub Pages custom domain config.

## QR payload format

`<2-char game code><3-char initials><2-digit weight lbs><2-digit roll count><one char per roll>`
— game code `BW` routes to Bowling. See `lb/index.html`'s own `parsePayload()` for the exact
parsing, and the Bowling project's `src/core/ngpc_qr.c` for the on-device encoder.
