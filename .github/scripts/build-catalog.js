#!/usr/bin/env node
// Builds catalog.json (repo root, served at https://www.ngpc-dev.com/catalog.json) for the NGPC cartridge store:
// the Wi-Fi adapter on the link port reads this one static file to list games, spot updates and download ROMs.
// Spec: NGPC_STORE_SPEC.md (from Napomex). Runs from .github/workflows/build-catalog.yml; the workflow commits
// whatever this writes.
//
// A game is listed only when its developer ticked "List this game in the cartridge store" (games/{slug}.storeAllowed)
// AND it is ready: has a ROM, a 32x32 icon and a blurb, and is out of coming-soon (and not hidden). Anything
// else stays off the cartridge, so an unfinished or unreleased game never leaks into the file.
//
// `rev` goes up by one on every change that matters to the adapter. The download counter changes constantly and
// the spec says it must not bump rev, so it is left out of the comparison (it is still refreshed in the file).
//
//   node build-catalog.js                     real run: FIREBASE_SERVICE_ACCOUNT env var, writes ../../catalog.json
//   node build-catalog.js --preview [slug..]  local test: treats every public game (or just the slugs given) as
//                                             opted in, writes nothing in the repo, prints the result
'use strict';
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(REPO_ROOT, 'catalog.json');
const PREVIEW = process.argv.includes('--preview');
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('--'));

// Where the adapter fetches a ROM. The raw Storage link today; becomes the counted link (spec: /dl/<slug>) once that
// endpoint exists, with no other change here.
function downloadUrl(slug, game) { return game.romPath; }

const isPng = (url) => { try { return /\.png$/i.test(decodeURIComponent(new URL(url).pathname)); } catch (e) { return false; } };
const isoDate = (ms) => (typeof ms === 'number' && ms > 0) ? new Date(ms).toISOString().slice(0, 10) : '';

async function sha256Of(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('ROM download failed (' + res.status + ')');
  const buf = Buffer.from(await res.arrayBuffer());
  return { sha: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length };
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT env var not set'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const db = admin.firestore();

  let prev = { rev: 0, games: [] };
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }
  const prevBy = {};
  (prev.games || []).forEach(g => { prevBy[g.slug] = g; });

  const snap = await db.collection('games').get();
  const nameCache = {};
  const games = [];
  for (const doc of snap.docs.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const slug = doc.id, g = doc.data();
    if (PREVIEW) { if (ONLY.length && !ONLY.includes(slug)) continue; }
    else if (g.storeAllowed !== true) continue;
    if (!g.romPath || g.devStatus === 'coming-soon' || g.visibility === 'hidden') continue;
    if (!PREVIEW && (!g.iconPath || !String(g.storeBlurb || '').trim())) continue;

    // ROM facts: stored at upload time; older games get them filled in here once (and written back so the next run
    // does not download the ROM again).
    let sha = g.romSha256, size = g.romSize;
    if (!sha || !size) {
      const was = prevBy[slug];
      if (was && was.download_url === downloadUrl(slug, g) && was.rom_sha256 && was.rom_size) { sha = was.rom_sha256; size = was.rom_size; }
      else {
        const got = await sha256Of(g.romPath);
        sha = got.sha; size = got.size;
      }
      if (!PREVIEW) await doc.ref.update({ romSha256: sha, romSize: size, romRev: g.romRev || 1 });
    }

    let author = '';
    if (g.developerUid) {
      if (!(g.developerUid in nameCache)) {
        const u = await db.collection('users').doc(g.developerUid).get();
        nameCache[g.developerUid] = (u.exists && u.data().username) ? String(u.data().username).toUpperCase() : '';
      }
      author = nameCache[g.developerUid];
    }

    games.push({
      slug: slug,
      name: g.name || slug,
      author: author,
      version: g.version || '',
      rom_rev: g.romRev || 1,
      rom_size: size,
      rom_sha256: sha,
      download_url: downloadUrl(slug, g),
      icon_url: g.iconPath || null,
      screenshots: [g.titleImage, g.extraScreenshot1Path, g.extraScreenshot2Path].filter(u => u && isPng(u)),   // 160x152 PNGs only (no GIFs)
      blurb: String(g.storeBlurb || '').trim(),
      description: g.description || '',
      save_compatible_since: g.saveCompatibleSince || 1,
      store_allowed: true,
      downloads: g.romDownloads || 0,
      added: isoDate(g.addedAt),
    });
  }

  const strip = (list) => JSON.stringify(list.map(x => { const c = Object.assign({}, x); delete c.downloads; return c; }));
  const changed = strip(games) !== strip(prev.games || []);
  const rev = changed ? (prev.rev || 0) + 1 : (prev.rev || 1);
  const out = JSON.stringify({ rev: rev, games: games }, null, 2) + '\n';

  if (PREVIEW) { console.log(out); console.log('(preview: ' + games.length + ' game(s), nothing written)'); return; }
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old === out) { console.log('catalog.json unchanged (rev ' + rev + ', ' + games.length + ' game(s)).'); return; }
  fs.writeFileSync(OUT, out);
  console.log('catalog.json written: rev ' + rev + (changed ? ' (bumped)' : ' (downloads only)') + ', ' + games.length + ' game(s).');
}
main().catch(e => { console.error(e); process.exit(1); });
