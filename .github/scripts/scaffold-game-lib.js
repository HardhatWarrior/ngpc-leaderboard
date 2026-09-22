#!/usr/bin/env node
/*
 * scaffold-game-lib.js - mirror of NGPC-Admin-Scripts/scaffold-game.js's generation logic, kept
 * here (checked into git) so the scaffold-approved-games GitHub Action can require() it --
 * NGPC-Admin-Scripts itself is a local-only folder, not a git repo, unreachable from CI. Keep the
 * two in sync by hand when one changes; this copy's own main()/CLI block below is unused in CI
 * (only generateAndWrite/findSubmissionAndSlug are required by scaffold-approved-games.js) but is
 * left in place so this file still works standalone if copied back for local use.
 *
 * scaffold-game.js - Generates a DRAFT leaderboard page, in-browser player page, and
 * firestore.rules score validator for an approved game submission, from its own stored payload
 * spec (payloadFields/sortField/sortDirection/totalLength) -- the part of "going live" that was
 * previously always retyped by hand for every single game.
 *
 * This is a SCAFFOLD, not a finished page: it handles the common case (a sequence of fixed-width
 * numeric/A-Z fields, no scorecard reconstruction beyond "print each field as-is") the same way
 * 2048/Tetris/Farkle/Xenon2 already work. It can NOT know about anything bespoke a real game
 * might need -- Bowling's frame-by-frame strike/spare scorecard math, Over Rev's CRC16-checked
 * Base32 data block, Gardenia's per-mode leaderboards. A field whose width isn't a plain integer
 * (e.g. Bowling's "1 x roll count") is left as an explicit TODO in the generated parser instead
 * of guessed at. ALWAYS read the generated files before committing them -- treat this the same
 * way you'd treat a first draft from a junior contributor, not a finished PR.
 *
 * What it does NOT do, on purpose:
 *   - Never touches firestore.rules directly -- the validator snippet is written to its own
 *     review file; pasting it into the real allow-create OR-chain is still a deliberate,
 *     reviewed action (same spirit as every other rules change on this project).
 *   - Never overwrites an existing <slug>/ or play/<slug>/ page -- refuses outright unless
 *     --force is passed, so a real hand-built page can never be clobbered by accident.
 *
 * Usage (takes EITHER a gameSubmissions doc id OR the game's own slug -- same slug
 * reset-game.js/approve-submission.js use, whichever you have on hand):
 *   node scaffold-game.js <submissionId | slug>              dry run -- shows what would be generated
 *   node scaffold-game.js <submissionId | slug> --apply       writes the files
 *   node scaffold-game.js <submissionId | slug> --apply --force   overwrite existing files too
 *
 * Setup: same one-time service-account.json as reset-password.js -- see this folder's README.md.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');
const REPO_ROOT = path.join(__dirname, '..', '..');

function camelCase(name) {
  return String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/^[0-9]/, (c) => '_' + c) || 'field';
}

function isGameCodeField(name) {
  return /game\s*code/i.test(name || '');
}
function isInitialsField(name) {
  return /initial/i.test(name || '');
}
function isAlphaFormat(format) {
  return /a-z/i.test(format || '');
}

// Walks payloadFields in order, skipping the game-code row (consumed separately via the known
// proposedCode length) and building a { ok, fields, code, parserLines, docFields, rulesFields }
// description used by both page templates and the rules snippet below. Fields with a non-integer
// width are kept (so the generated doc/rules shape still lists them) but flagged `manual: true` --
// the generated parser leaves a loud TODO instead of guessing how to slice them.
// A numeric field's own "notes" is often where a developer actually documents what each value
// MEANS ("0=slow, 1=normal, 2=fast (the SPEED menu setting)") -- this was true of Breakout's own
// Difficulty field and got missed entirely the first time this generator shipped, showing a raw
// "1" on the scorecard instead of "normal". Parses "N=label" pairs (comma or slash separated,
// case-insensitive "n" prefix tolerated) out of notes; needs at least 2 matches to count as a
// real enum rather than a false-positive match on an unrelated number in the notes text.
function parseEnumFromNotes(notes) {
  if (!notes) return null;
  const pairs = {};
  const re = /(\d+)\s*=\s*([^,/\n]+)/g;
  let m;
  while ((m = re.exec(notes))) {
    const label = m[2].trim().replace(/\s*\([^)]*\)\s*$/, ''); // trailing "(...)" aside is usually a comment, not part of the label
    pairs[m[1]] = titleCase(label);
  }
  return Object.keys(pairs).length >= 2 ? pairs : null;
}

function planFields(sub) {
  const codeLen = (sub.proposedCode || '').length;
  const fields = [];
  let offset = codeLen;
  for (const f of (sub.payloadFields || [])) {
    if (isGameCodeField(f.name)) continue;
    const width = parseInt(f.width, 10);
    const manual = !Number.isFinite(width) || width <= 0;
    const isAlpha = isAlphaFormat(f.format);
    const prop = isInitialsField(f.name) ? 'initials' : camelCase(f.name);
    const enumMap = !isAlpha ? parseEnumFromNotes(f.notes) : null;
    fields.push({
      rawName: f.name, width: manual ? null : width, manual, isAlpha, enumMap,
      prop, offset: manual ? null : offset, format: f.format, notes: f.notes,
    });
    if (!manual) offset += width;
  }
  return { fields, totalOffset: offset };
}

function pascalCase(name) {
  return camelCase(name).replace(/^[a-z]/, c => c.toUpperCase());
}

function titleCase(s) {
  return String(s || '').replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function generateParseFunction(sub, plan) {
  const code = sub.proposedCode;
  const fnBase = pascalCase(sub.proposedName);
  const lines = [];
  lines.push(`  function parse${fnBase}Payload(text){`);
  const totalLen = parseInt(sub.totalLength, 10);
  if (Number.isFinite(totalLen)) {
    lines.push(`    if(text.length !== ${totalLen}) return {error:"That code is the wrong length — rescan with the whole code in frame."};`);
  }
  for (const f of plan.fields) {
    if (f.manual) {
      lines.push(`    // TODO: "${f.rawName}" has a non-fixed width (${JSON.stringify(f.notes || f.format || '')}) -- scaffold-game.js couldn't`);
      lines.push(`    //   auto-slice this field. Add the real parsing here by hand (see this game's submission`);
      lines.push(`    //   in admin/index.html's All Submissions panel for the developer's own notes/example payloads).`);
      lines.push(`    const ${f.prop} = null; // FIXME`);
      continue;
    }
    const slice = `text.slice(${f.offset},${f.offset + f.width})`;
    if (f.isAlpha) {
      lines.push(`    const ${f.prop} = ${slice};`);
      lines.push(`    if(!/^[A-Z]{${f.width}}$/.test(${f.prop})) return {error:"That code's ${f.rawName.toLowerCase()} didn't look right."};`);
    } else {
      lines.push(`    const ${f.prop}Str = ${slice};`);
      lines.push(`    if(!/^\\d{${f.width}}$/.test(${f.prop}Str)) return {error:"That code has an unreadable ${f.rawName.toLowerCase()}."};`);
      lines.push(`    const ${f.prop} = parseInt(${f.prop}Str,10);`);
    }
  }
  const propList = plan.fields.map(f => f.prop).join(', ');
  lines.push(`    return { game:QR_GAME_CODE, ${propList} };`);
  lines.push(`  }`);
  lines.push('');
  lines.push(`  function parsePayload(text){`);
  lines.push(`    text = (text||'').trim().toUpperCase();`);
  lines.push(`    if(text.length < ${code.length}) return {error:"That code is too short to be a valid score."};`);
  lines.push(`    const code = text.slice(0,${code.length});`);
  lines.push(`    if(code === QR_GAME_CODE) return parse${fnBase}Payload(text);`);
  lines.push(`    return {error:'Unknown game code "'+code+'".'};`);
  lines.push(`  }`);
  return lines.join('\n');
}

function generateScorecardTable(plan) {
  // Any field whose notes parsed out an enum (see parseEnumFromNotes) shows its label instead of
  // the raw stored digit -- the digit is still what's actually in Firestore (see
  // generateParseFunction/generateRulesSnippet, both unaffected), this only changes display.
  const enumFields = plan.fields.filter(f => f.enumMap);
  const enumMapsBlock = enumFields.length
    ? `  const SCORECARD_ENUM_LABELS = {\n` + enumFields.map(f => `    ${f.prop}: ${JSON.stringify(f.enumMap)}`).join(',\n') + `\n  };\n`
    : '';
  const rows = plan.fields
    .filter(f => f.prop !== 'initials')
    .map(f => {
      const valueExpr = f.enumMap
        ? `(SCORECARD_ENUM_LABELS.${f.prop}[data.${f.prop}] || data.${f.prop})`
        : `data.${f.prop}`;
      return `'<tr><td>${titleCase(f.rawName)}</td><td class="tk-val tnum">'+${valueExpr}+'</td></tr>'`;
    })
    .join('+\n      ');
  return `${enumMapsBlock}  function renderScorecardHTML(data){\n    const rows = ${rows || "''"};\n    return '<table class="tk-sheet">'+rows+'</table>';\n  }`;
}

function generateRulesSnippet(sub, plan, slug) {
  const fnName = 'is' + pascalCase(sub.proposedName) + 'Score';
  const keys = ['game', 'initials', ...plan.fields.filter(f => f.prop !== 'initials').map(f => f.prop), 'source', 'submittedAt', 'uid', 'username', 'approved'];
  const checks = plan.fields
    .filter(f => f.prop !== 'initials' && !f.manual)
    .map(f => {
      if (f.isAlpha) return `        && d.${f.prop} is string && d.${f.prop}.matches('^[A-Z]{${f.width}}$')`;
      const max = Math.pow(10, f.width) - 1;
      return `        && d.${f.prop} is int && d.${f.prop} >= 0 && d.${f.prop} <= ${max}`;
    })
    .join('\n');
  return `    // GENERATED DRAFT by scaffold-game.js from gameSubmissions/${sub._id} -- review every bound below
    // (widths are a plain "10^width - 1" guess; tighten or loosen per the developer's real spec)
    // before pasting this into firestore.rules' own OR-chain, same as every other isXScore(). Any
    // "TODO"/manual field noted in the generated ${slug}/index.html parser also needs its own
    // check added here by hand -- this generator only covers fixed-width fields.
    function ${fnName}(d) {
      return d.game == '${sub.proposedCode}'
        && d.keys().hasOnly([${keys.map(k => `'${k}'`).join(', ')}])
        && d.initials is string && d.initials.matches('^[A-Z]{3}$')
${checks}
        && d.source is string && d.source in ['qr', 'capture']
        && d.submittedAt is int
        && d.submittedAt <= request.time.toMillis() + 300000
        && d.submittedAt >= request.time.toMillis() - 300000
        && hasValidIdentity(d);
    }`;
}

function leaderboardTemplate(sub, plan, slug) {
  const title = sub.proposedName;
  const code = sub.proposedCode;
  const sortField = camelCase(sub.sortField || 'score');
  const sortDir = sub.sortDirection === 'asc' ? 'asc' : 'desc';
  const parseBlock = generateParseFunction(sub, plan);
  const scorecardBlock = generateScorecardTable(plan);
  // scorecardFormula is free text a developer wrote specifically to describe something the
  // generic field-by-field scorecard table above can't express on its own (custom math, a
  // display rule, anything) -- never safe to auto-implement from arbitrary prose, but silently
  // dropping it is worse: a developer who wrote a real request in there deserves to see it
  // called out in the code, not have it vanish into a "looks done" page that quietly ignores it.
  const scorecardFormulaNote = (sub.scorecardFormula || '').trim()
    ? `  // TODO -- the submission's own "scorecard reconstruction" field asked for something this\n`
      + `  // generator can't safely auto-implement from free text. The developer's exact request:\n`
      + `  //   "${String(sub.scorecardFormula).replace(/"/g, '\\"').replace(/\n/g, '\n  //   ')}"\n`
      + `  // Implement it by hand (likely inside renderScorecardHTML and/or formatDisplayValue below),\n`
      + `  // then delete this comment.\n\n`
    : '';
  const romDefaultName = (sub.romFileName || 'game.ngp');
  // A named helper instead of an inlined expression -- this gets called from two different
  // scopes below (openConfirm's own `parsed` param, and the submit handler's `pending`), so it
  // can't just reference one fixed local variable name.
  const displayField = plan.fields.find(f => f.prop === sortField) || plan.fields[plan.fields.length - 1];
  const displayBody = displayField && displayField.width
    ? `String(o.${displayField.prop}).padStart(${displayField.width},'0')`
    : `String(o.${sortField})`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} Hiscores</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.11.0/dist/inlined/index.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<style>
  /* GENERATED DRAFT -- palette/layout copied verbatim from 2k/index.html's own template. Swap
     --accent/--accent-ink for this game's own art if you want a distinct color, same as every
     other game page here does. */
  :root{
    --navy:#10162a; --panel:#181f3a; --panel2:#212a4d; --border:#37426e;
    --cream:#f4eedd; --dim:#93a0c9; --accent:#5c8fd6; --accent-ink:#0a1830;
    --accent2:#5c8fd6; --good:#4fbf8b; --danger:#e5615a;
  }
  *{ box-sizing:border-box; } html,body{ height:auto; }
  body{ margin:0; background:var(--navy); color:var(--cream); font-family:"IBM Plex Sans",system-ui,sans-serif; padding-inline:20px; padding-block:28px; display:flex; justify-content:center; }
  .px{ font-family:"Press Start 2P","IBM Plex Mono",monospace; } .tnum{ font-variant-numeric:tabular-nums; }
  #shell{ width:100%; max-width:960px; display:flex; flex-direction:column; gap:22px; }
  header{ background:linear-gradient(180deg,var(--panel2),var(--panel)); border:1px solid var(--border); border-radius:14px; padding:22px 22px 18px; display:flex; flex-direction:column; gap:14px; position:relative; overflow:hidden; }
  .eyebrow{ position:relative; font-size:10px; letter-spacing:.14em; color:var(--accent2); text-transform:uppercase; }
  .header-row{ position:relative; display:flex; flex-direction:row; justify-content:space-between; gap:16px; align-items:flex-start; }
  .title-block{ display:flex; flex-direction:column; align-items:flex-end; text-align:right; gap:5px; min-width:0; }
  .title-block h1{ margin:0; font-size:clamp(18px,5vw,28px); line-height:1.2; color:var(--cream); overflow-wrap:break-word; }
  .created-by{ font-size:11px; color:var(--dim); }
  .created-by a{ color:var(--dim); text-decoration:underline; text-underline-offset:2px; }
  .created-by a:hover{ color:var(--accent2); }
  .rom-link, .play-link{ display:inline-flex; align-items:center; gap:5px; width:auto; font-weight:600; text-decoration:underline; text-underline-offset:2px; }
  .play-link{ color:var(--accent2); font-size:11.5px; margin-top:4px; }
  .play-link:hover{ color:var(--cream); }
  .play-link[hidden]{ display:none; }
  .rom-link{ color:var(--dim); font-size:11px; }
  .rom-link:hover{ color:var(--accent2); }
  /* No max-width on either image below -- a percentage cap here resolves against .art-strip's
     OWN box (its nearest sized ancestor), not .header-row's wider one, so on a narrow viewport it
     collapses the image to a small fraction of 130px instead of just capping it. The @media rule
     further down handles narrow screens instead, by hiding the extras outright. */
  .header-art{ position:relative; width:130px; height:auto; flex:none; aspect-ratio:160/152; image-rendering:pixelated; border-radius:8px; border:1px solid var(--border); box-shadow:0 4px 14px rgba(0,0,0,.35); background:#000; object-fit:contain; }
  /* Up to two extra screenshots/GIFs (games/{slug}.extraScreenshot1Path/2Path, set from
     admin/game/index.html's own art panel) shown right next to the title screen, same size as it
     -- hidden entirely (see the [hidden] rule already in the shared reset) until JS finds one
     set. flex-wrap on the strip lets three same-size images wrap to a second line on a narrow
     screen instead of overflowing; align-items:flex-start (not the flex default of stretch) is
     required so a still-loading/broken image doesn't get its height stretched to match its
     siblings, which reads as a horizontal squish. */
  .art-strip{ display:flex; flex-wrap:wrap; align-items:flex-start; gap:8px; flex:none; }
  .art-col{ display:flex; flex-direction:column; gap:8px; flex:0 1 auto; min-width:0; }
  .game-desc{ font-size:11px; line-height:1.45; color:var(--dim); max-width:100%; min-width:0; overflow-wrap:anywhere; }
  .game-site{ font-size:11px; max-width:100%; min-width:0; }
  .game-site a{ color:var(--accent2); text-decoration:underline; text-underline-offset:2px; overflow-wrap:anywhere; word-break:break-word; }
  .game-site a:hover{ color:var(--cream); }
  .extra-art{ width:130px; height:auto; aspect-ratio:160/152; image-rendering:pixelated; border-radius:8px; border:1px solid var(--border); box-shadow:0 4px 14px rgba(0,0,0,.35); background:#000; object-fit:contain; flex:none; }
  /* Three ~130px images side-by-side in .art-strip (header-art plus both extras) don't leave room
     for .title-block in the same .header-row on a phone-width viewport -- .header-row stays
     row-direction (no stacking breakpoint exists here), so it would otherwise overflow and push
     the panel wider than the screen. Hiding the two optional extras below 600px keeps just the
     title screenshot, which fits. */
  @media (max-width:600px){ .extra-art{ display:none; } }
  main{ display:grid; grid-template-columns:1fr; gap:20px; align-items:start; }
  .panel{ background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:18px 20px; }
  #access-gate{ background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:32px 20px; }
  #page-content{ display:flex; flex-direction:column; gap:22px; }
  .panel h2{ margin:0 0 4px; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent2); }
  .panel .hint{ margin:0 0 16px; color:var(--dim); font-size:12.5px; line-height:1.5; }
  #board-status{ font-size:12px; color:var(--dim); margin-bottom:10px; min-height:1.4em; }
  .row{ display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:12px; padding:10px 8px; border-radius:8px; }
  .row ~ .row{ border-top:1px solid var(--border); }
  .rank{ font-family:"Press Start 2P",monospace; font-size:11px; color:var(--dim); text-align:center; }
  .row.top1 .rank{ color:var(--accent); } .row.top1{ background:rgba(92,143,214,.10); }
  .initials{ font-family:"Press Start 2P",monospace; font-size:14px; letter-spacing:.06em; color:var(--cream); display:flex; align-items:center; gap:8px; }
  .row-avatar{ width:48px; height:48px; border-radius:4px; border:1px solid var(--border); image-rendering:pixelated; flex:none; }
  .score-val{ font-family:"Press Start 2P",monospace; font-size:15px; color:var(--good); }
  .row-meta{ font-size:10.5px; color:var(--dim); grid-column:2; margin-top:2px; }
  .row-meta a{ color:var(--dim); text-decoration:underline; text-underline-offset:2px; }
  .row-meta a:hover{ color:var(--accent2); }
  .empty-state{ color:var(--dim); font-size:13px; padding:18px 4px; text-align:center; }
  .row.has-detail{ cursor:pointer; } .row.has-detail:hover{ background:rgba(92,143,214,.08); }
  .row-detail{ padding:2px 8px 14px; }
  .tk-sheet{ width:100%; border-collapse:collapse; margin:14px 0; font-size:11.5px; }
  .tk-sheet td{ padding:3px 6px; border-bottom:1px solid var(--border); }
  .tk-sheet td.tk-val{ text-align:right; font-family:"IBM Plex Mono",monospace; color:var(--cream); }
  .scan-video-wrap{ position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; background:#000; margin-bottom:10px; }
  #scan-video{ width:100%; height:100%; object-fit:cover; display:block; }
  .scan-frame{ position:absolute; inset:14%; border:2px solid var(--accent2); border-radius:12px; box-shadow:0 0 0 999px rgba(0,0,0,.4); pointer-events:none; }
  .file-btn{ display:block; text-align:center; cursor:pointer; }
  button{ font:inherit; border:none; border-radius:8px; padding:12px 16px; cursor:pointer; font-weight:600; font-size:13.5px; width:100%; }
  button:disabled{ opacity:.5; cursor:not-allowed; }
  .btn-primary{ background:var(--accent); color:var(--accent-ink); } .btn-primary:hover:not(:disabled){ filter:brightness(1.1); }
  .btn-secondary{ background:transparent; border:1px solid var(--border); color:var(--cream); margin-top:8px; }
  .btn-secondary:hover:not(:disabled){ border-color:var(--accent2); }
  #confirm-view, #success-view{ display:none; }
  #confirm-view.show, #success-view.show{ display:block; }
  #idle-view.hide{ display:none; }
  .confirm-score{ text-align:center; padding:18px 0 20px; }
  .confirm-score .who{ font-family:"Press Start 2P",monospace; font-size:22px; letter-spacing:.08em; color:var(--cream); }
  .confirm-score .what{ font-family:"Press Start 2P",monospace; font-size:34px; color:var(--good); margin-top:10px; }
  .confirm-score .src{ margin-top:10px; font-size:11px; color:var(--dim); }
  .msg{ font-size:12.5px; border-radius:8px; padding:10px 12px; margin-top:12px; }
  .msg.err{ background:rgba(229,97,90,.15); color:var(--danger); border:1px solid rgba(229,97,90,.35); }
  .msg.ok{ background:rgba(79,191,139,.15); color:var(--good); border:1px solid rgba(79,191,139,.35); }
  .success-icon{ text-align:center; font-size:40px; margin-bottom:6px; }
  #success-view p{ text-align:center; color:var(--dim); font-size:13px; }
  footer{ text-align:center; color:var(--dim); font-size:11px; padding-top:4px; }
</style>
<!-- Cloudflare Web Analytics -->
<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "33e146de507a4007bb50d3d54f01816b"}'></script>
<!-- End Cloudflare Web Analytics -->
</head>
<body>

<div id="shell">
  <!-- Shown instead of everything below while this game is devStatus 'coming-soon' and the
       viewer isn't the site admin or this game's own assigned developer -- see ACCESS_GATE_UID
       below. A determined visitor could still read the raw games/{slug} doc directly (this is a
       static site, there's no server to actually enforce this), but the real page/board/ROM
       aren't linked or shown to anyone else. -->
  <div id="access-gate" hidden>
    <p class="hint" style="text-align:center;margin:0">This game isn't public yet. Check back once it's live on the main page.</p>
  </div>
  <div id="page-content" hidden>
  <header>
    <span class="eyebrow">Neo Geo Pocket Color &middot; Homebrew</span>
    <div class="header-row">
      <div class="art-col">
      <div class="art-strip">
        <img src="" alt="${title} title screen" class="header-art" id="header-art" width="160" height="152">
        <img src="" alt="${title} extra screenshot 1" class="extra-art" id="extra-art-1" hidden>
        <img src="" alt="${title} extra screenshot 2" class="extra-art" id="extra-art-2" hidden>
      </div>
      <div class="game-desc" id="game-desc" hidden></div>
      <div class="game-site" id="game-site" hidden><a href="#" id="game-site-link" target="_blank" rel="noopener"></a></div>
      </div>
      <div class="title-block">
        <h1>${title}</h1>
        <div class="created-by">Created by: <a href="/user/?u=${sub.submitterUsername || ''}">@${(sub.submitterUsername || '').toUpperCase()}</a></div>
        <a href="#" class="rom-link" id="rom-link" download>&#128190; Download ROM (.ngp)</a>
        <a href="/play/${slug}/" class="play-link" id="play-link" hidden>&#127918; Play ${title} in Browser</a>
      </div>
    </div>
  </header>

  <main>
    <section class="panel">
      <h2>Submit a score</h2>
      <div id="scan-signin-required">
        <button type="button" class="btn-primary" id="scan-signin-btn">Sign In</button>
      </div>
      <div id="idle-view" hidden>
        <button class="btn-primary" id="btn-scan">Scan QR Code</button>
        <div id="scan-live" hidden>
          <div class="scan-video-wrap">
            <video id="scan-video" playsinline muted></video>
            <div class="scan-frame" aria-hidden="true"></div>
          </div>
          <button class="btn-secondary" id="btn-cancel-scan">Cancel</button>
        </div>
        <div id="scan-fallback" hidden>
          <label class="btn-primary file-btn" for="scan-file">Take / choose a photo</label>
          <input type="file" accept="image/*" id="scan-file" hidden>
          <button class="btn-secondary" id="btn-cancel-fallback">Cancel</button>
        </div>
        <div id="form-msg"></div>
      </div>
      <div id="confirm-view">
        <div class="confirm-score">
          <div class="who" id="confirm-initials">AAA</div>
          <div class="what" id="confirm-score">-</div>
          <div class="src" id="confirm-src">From a scanned QR code</div>
        </div>
        <div id="confirm-scorecard"></div>
        <button class="btn-primary" id="btn-confirm">Submit score</button>
        <button class="btn-secondary" id="btn-back">Cancel</button>
        <div id="confirm-msg"></div>
      </div>
      <div id="success-view">
        <div class="success-icon">&#127881;</div>
        <p id="success-text">Score submitted to the leaderboard.</p>
        <button class="btn-secondary" id="btn-again">Back to leaderboard</button>
      </div>
    </section>

    <section class="panel">
      <h2>Leaderboard</h2>
      <div id="board-status"></div>
      <div id="board"></div>
    </section>
  </main>

  <footer>&copy; 2026 Neo Geo Pocket Homebrew - www.ngpc-dev.com</footer>
  </div>
</div>

<script src="/auth.js"></script>
<script>
(function(){
  "use strict";
  const QR_GAME_CODE = '${code}';
  const GAME_SLUG = '${slug}';
  const ADMIN_UID = 'L44BFbmiNkhi2vvLdrPUIxkvmfs2';
  const SUBMIT_SOURCE = new URLSearchParams(location.search).get('src') === 'capture' ? 'capture' : 'qr';

  const el = (id)=>document.getElementById(id);
  const accessGateEl = el('access-gate');
  const pageContentEl = el('page-content');
  const boardEl = el('board'), boardStatusEl = el('board-status');
  const idleView = el('idle-view'), confirmView = el('confirm-view'), successView = el('success-view');
  const formMsg = el('form-msg'), confirmMsg = el('confirm-msg');
  const btnScan = el('btn-scan'), scanLive = el('scan-live'), scanFallback = el('scan-fallback');
  const scanVideo = el('scan-video'), scanFile = el('scan-file');

  let db = null, pending = null, unsubscribeBoard = null;

${parseBlock}

  function lastPathSegment(text){
    const parts = String(text||'').split('/').filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  function payloadFromEntry(){
    const raw = location.hash ? location.hash.slice(1) : lastPathSegment(location.pathname);
    const last = decodeURIComponent(lastPathSegment(raw));
    if(last.length < ${code.length}) return null;
    const result = parsePayload(last);
    return result.error ? null : result;
  }

  function fmtWhen(ts){ if(!ts) return ''; const d = new Date(ts); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }

  function formatDisplayValue(o){ return ${displayBody}; }

${scorecardFormulaNote}${scorecardBlock}

  async function renderBoard(docs){
    if(!docs.length){ boardEl.innerHTML = '<div class="empty-state">No scores yet — be the first on the board.</div>'; return; }
    const uids = docs.map(d=>d.data().uid).filter(Boolean);
    const avatars = (window.NGPC_AUTH && uids.length) ? await NGPC_AUTH.fetchAvatars(uids) : {};
    boardEl.innerHTML = docs.map((d,i)=>{
      const data = d.data();
      const rank = i+1;
      const usernameLine = data.username ? ('<a href="/user/?u='+encodeURIComponent(data.username)+'">@'+escapeHtml(data.username.toUpperCase())+'</a>') : '';
      const meta = [fmtWhen(data.submittedAt), usernameLine].filter(Boolean).join(' · ');
      const hasAvatar = data.uid && avatars[data.uid];
      const avatarHtml = hasAvatar ? '<canvas class="row-avatar" data-avatar-row="'+i+'"></canvas>' : '';
      const rowHtml = '<div class="row'+(rank===1?' top1':'')+' has-detail" data-detail="d'+i+'">'+
        '<div class="rank">'+(rank===1?'🏆':('#'+rank))+'</div>'+
        '<div><div class="initials">'+avatarHtml+escapeHtml(data.initials||'???')+'</div>'+
          '<div class="row-meta">'+meta+'</div></div>'+
        '<div class="score-val tnum">'+(data.${sortField}!=null?String(data.${sortField}):'-')+'</div>'+
      '</div>';
      const detailHtml = '<div class="row-detail" id="d'+i+'" hidden>'+renderScorecardHTML(data)+'</div>';
      return rowHtml + detailHtml;
    }).join('');
    docs.forEach((d,i)=>{
      const data = d.data();
      if(!data.uid || !avatars[data.uid]) return;
      const canvasEl = boardEl.querySelector('[data-avatar-row="'+i+'"]');
      if(canvasEl && window.NGPC_AUTH) NGPC_AUTH.renderAvatarToCanvas(canvasEl, avatars[data.uid], 48/NGPC_AUTH.AVATAR_SIZE);
    });
  }

  boardEl.addEventListener('click', (e)=>{
    const row = e.target.closest('.row.has-detail');
    if(!row) return;
    const detailId = row.dataset.detail;
    if(detailId) el(detailId).hidden = !el(detailId).hidden;
  });

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function friendlyDbError(e){
    const code = e && e.code;
    switch(code){
      case 'quota_exceeded': return "The scoreboard is full right now — ask the owner to clear some old entries.";
      case 'resource_exhausted': return "Too many requests right now — wait a moment and try again.";
      case 'unavailable': return "Leaderboard unavailable right now — try again in a moment.";
      default: return "Couldn't reach the leaderboard right now. Try again in a bit.";
    }
  }

  function subscribeBoard(){
    if(unsubscribeBoard){ unsubscribeBoard(); unsubscribeBoard = null; }
    if(!db) return;
    const q = db.collection('scores').where('game','==',QR_GAME_CODE).where('approved','==',true).orderBy('${sortField}','${sortDir}').limit(25);
    unsubscribeBoard = q.onSnapshot(
      (snap)=>{ renderBoard(snap.docs); },
      (err)=>{ boardStatusEl.textContent = friendlyDbError(err); }
    );
  }

  function initDb(){
    if(!firebase || !firebase.firestore){ boardStatusEl.innerHTML = '<div class="msg err">Firestore module not available</div>'; return; }
    try{
      db = firebase.firestore();
      boardStatusEl.textContent = '';
      subscribeBoard();
    }catch(e){
      boardStatusEl.innerHTML = '<div class="msg err">Firestore init failed: '+escapeHtml(e.message)+'</div>';
    }
  }

  async function writeScore(data){
    if(!db) return {ok:false, error:new Error('db not initialized')};
    try{ await db.collection('scores').add(data); return {ok:true}; }
    catch(e){ return {ok:false, error:e}; }
  }

  function showStage(stage){
    idleView.classList.toggle('hide', stage!=='idle');
    confirmView.classList.toggle('show', stage==='confirm');
    successView.classList.toggle('show', stage==='success');
  }

  function openConfirm(parsed){
    pending = parsed;
    el('confirm-initials').textContent = parsed.initials || '';
    el('confirm-score').textContent = formatDisplayValue(parsed);
    el('confirm-src').textContent = 'From a scanned QR code';
    el('confirm-scorecard').innerHTML = renderScorecardHTML(parsed);
    confirmMsg.innerHTML = '';
    showStage('confirm');
  }

  function handleScanResult(text){
    formMsg.innerHTML = '';
    const result = parsePayload(lastPathSegment(text));
    if(result.error){ formMsg.innerHTML = '<div class="msg err">'+escapeHtml(result.error)+'</div>'; return; }
    resetScanUI();
    openConfirm(result);
  }

  let cameraStream = null, scanRAF = null;
  const scanCanvas = document.createElement('canvas'), scanCtx = scanCanvas.getContext('2d', {willReadFrequently:true});

  function resetScanUI(){
    if(scanRAF){ cancelAnimationFrame(scanRAF); scanRAF = null; }
    if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream = null; }
    scanLive.hidden = true; scanFallback.hidden = true; btnScan.hidden = false;
  }

  function showFallback(msg){
    if(scanRAF){ cancelAnimationFrame(scanRAF); scanRAF = null; }
    if(cameraStream){ cameraStream.getTracks().forEach(t=>t.stop()); cameraStream = null; }
    scanLive.hidden = true; btnScan.hidden = true; scanFallback.hidden = false;
    if(msg) formMsg.innerHTML = '<div class="msg err">'+escapeHtml(msg)+'</div>';
  }

  async function startLiveScan(){
    formMsg.innerHTML = '';
    if(!window.zbarWasm && !getBarcodeDetector() && !window.jsQR){
      formMsg.innerHTML = '<div class="msg err">QR scanning library failed to load — try reloading the page.</div>';
      return;
    }
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      showFallback('Live camera is not supported here.');
      return;
    }
    try{ cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false }); }
    catch(e){ showFallback('Camera access denied: '+escapeHtml(e.message)); return; }
    scanVideo.srcObject = cameraStream;
    try{ await scanVideo.play(); }catch(e){}
    btnScan.hidden = true; scanFallback.hidden = true; scanLive.hidden = false;
    scanLoop();
  }

  let barcodeDetector;
  function getBarcodeDetector(){
    if(barcodeDetector !== undefined) return barcodeDetector;
    if(!('BarcodeDetector' in window)){ barcodeDetector = null; return null; }
    try{ barcodeDetector = new window.BarcodeDetector({formats:['qr_code']}); }catch(e){ barcodeDetector = null; }
    return barcodeDetector;
  }

  async function decodeViaZbarWasm(source, w0, h0){
    if(!window.zbarWasm || !w0 || !h0) return null;
    const scale = Math.min(1, 1000/Math.max(w0,h0));
    const w = Math.round(w0*scale), h = Math.round(h0*scale);
    scanCanvas.width = w; scanCanvas.height = h;
    scanCtx.drawImage(source, 0, 0, w, h);
    try{ const symbols = await window.zbarWasm.scanImageData(scanCtx.getImageData(0, 0, w, h)); if(symbols && symbols.length) return symbols[0].decode(); }catch(e){}
    return null;
  }

  function jsqrFallback(source, w0, h0, scales){
    if(!window.jsQR || !w0 || !h0) return null;
    for(const target of scales){
      const scale = Math.min(1, target/Math.max(w0,h0));
      const w = Math.round(w0*scale), h = Math.round(h0*scale);
      scanCanvas.width = w; scanCanvas.height = h;
      scanCtx.drawImage(source, 0, 0, w, h);
      const code = window.jsQR(scanCtx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts:'attemptBoth'});
      if(code && code.data) return code.data;
    }
    return null;
  }

  async function decodeSource(source, w0, h0, scales){
    const viaZbar = await decodeViaZbarWasm(source, w0, h0);
    if(viaZbar) return viaZbar;
    const bd = getBarcodeDetector();
    if(bd){ try{ const r = await bd.detect(source); if(r && r.length) return r[0].rawValue; }catch(e){} }
    return jsqrFallback(source, w0, h0, scales);
  }

  const LIVE_SCALES = [500, 900];
  let liveBusy = false;
  async function scanLoop(){
    scanRAF = requestAnimationFrame(scanLoop);
    if(scanVideo.readyState !== scanVideo.HAVE_ENOUGH_DATA) return;
    if(liveBusy) return;
    const w = scanVideo.videoWidth, h = scanVideo.videoHeight;
    if(!w || !h) return;
    liveBusy = true;
    try{ const v = await decodeSource(scanVideo, w, h, LIVE_SCALES); if(v) handleScanResult(v); }finally{ liveBusy = false; }
  }

  function loadViaImageElement(file){
    return new Promise((r,x)=>{
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = ()=>{ URL.revokeObjectURL(url); r(img); };
      img.onerror = ()=>{ URL.revokeObjectURL(url); x(new Error('img failed')); };
      img.src = url;
    });
  }

  async function loadImage(file){
    if(window.createImageBitmap){ try{ return await createImageBitmap(file); }catch(e){} }
    return loadViaImageElement(file);
  }

  const FILE_SCALES = [350, 500, 700, 900, 1200];

  async function scanFromFile(file){
    formMsg.innerHTML = '<div class="msg ok">Reading code…</div>';
    let img;
    try{ img = await loadImage(file); }catch(e){
      formMsg.innerHTML = '<div class="msg err">Could not read that photo — try again or use JPG/PNG.</div>';
      return;
    }
    if(!img.width || !img.height){ formMsg.innerHTML = '<div class="msg err">That photo came back empty — try again.</div>'; return; }
    const v = await decodeSource(img, img.width, img.height, FILE_SCALES);
    if(v){ handleScanResult(v); }else{
      formMsg.innerHTML = '<div class="msg err">No QR code found in that photo — make sure the whole code is in frame and try again.</div>';
    }
  }

  btnScan.addEventListener('click', startLiveScan);
  el('btn-cancel-scan').addEventListener('click', resetScanUI);
  el('btn-cancel-fallback').addEventListener('click', resetScanUI);
  scanFile.addEventListener('change', (e)=>{ const f = e.target.files[0]; e.target.value = ''; if(f) scanFromFile(f); });

  el('btn-back').addEventListener('click', ()=>{ pending = null; showStage('idle'); });

  el('btn-confirm').addEventListener('click', async ()=>{
    if(!pending) return;
    if(!db){ confirmMsg.innerHTML = '<div class="msg err">Database not initialized</div>'; return; }
    if(window.NGPC_AUTH) await NGPC_AUTH.authReady;
    const authedUser = window.NGPC_AUTH && NGPC_AUTH.currentUser;
    if(!authedUser || !authedUser.username){
      confirmMsg.innerHTML = '<div class="msg err">Sign in to submit a score.'
        +' <button type="button" class="btn-secondary" id="confirm-signin-btn" style="width:auto;display:inline;margin:0 0 0 6px;padding:4px 10px">Sign In</button></div>';
      const signinBtn = el('confirm-signin-btn');
      if(signinBtn) signinBtn.addEventListener('click', ()=>{ if(window.NGPC_AUTH) NGPC_AUTH.openSignInModal('signin'); });
      return;
    }
    const btn = el('btn-confirm');
    btn.disabled = true;
    confirmMsg.innerHTML = '<div class="msg ok">Submitting…</div>';
    const record = Object.assign({}, pending, {
      source: SUBMIT_SOURCE,
      submittedAt: Date.now(),
      uid: authedUser.uid,
      username: authedUser.username,
      approved: !!authedUser.approved,
    });
    try{
      const res = await writeScore(record);
      btn.disabled = false;
      if(res.ok){
        el('success-text').textContent = (pending.initials||'') + ' — ' + formatDisplayValue(pending) + ' submitted to the leaderboard.';
        pending = null;
        showStage('success');
      } else {
        confirmMsg.innerHTML = '<div class="msg err">Write failed: '+escapeHtml(res.error?.message || 'unknown')+'</div>';
      }
    }catch(e){
      btn.disabled = false;
      confirmMsg.innerHTML = '<div class="msg err">Submit error: '+escapeHtml(e.message)+'</div>';
    }
  });

  el('btn-again').addEventListener('click', ()=>{ pending = null; showStage('idle'); });

  // Gates the WHOLE page (board, submit form, ROM download, art) behind devStatus !== 'coming-soon'
  // OR the viewer being this game's own assigned developer or the site admin -- see access-gate's
  // own markup comment. gameData is fetched once and reused both for this and for the ROM/art
  // links below, instead of two separate reads of the same doc. This is enforcement in the loosest
  // sense (a static site with no server can't truly hide a public Firestore doc from a determined
  // visitor), but it does mean nobody else is ever shown or linked to this page's real content.
  let gameData = null;
  let gateInitialized = false;
  function isAuthorizedViewer(user){
    if(!gameData || gameData.devStatus !== 'coming-soon') return true;
    return !!user && (user.uid === ADMIN_UID || user.uid === gameData.developerUid);
  }
  function applyAccessGate(user){
    const authorized = isAuthorizedViewer(user);
    if(accessGateEl) accessGateEl.hidden = authorized;
    if(pageContentEl) pageContentEl.hidden = !authorized;
    if(!authorized || gateInitialized) return;
    gateInitialized = true;
    initDb();
    const fromEntry = payloadFromEntry();
    if(fromEntry){
      openConfirm(fromEntry);
      history.replaceState(null, '', location.pathname);
    }
  }

  if(window.NGPC_AUTH){
    var romLinkEl = el('rom-link');
    var artEl = el('header-art');
    var extraArtEls = [el('extra-art-1'), el('extra-art-2')];
    if(romLinkEl) romLinkEl.addEventListener('click', function(){ if(window.NGPC_AUTH) NGPC_AUTH.trackRomDownload(GAME_SLUG); });

    const gameDocPromise = NGPC_AUTH.db
      ? NGPC_AUTH.db.collection('games').doc(GAME_SLUG).get().then(function(doc){
          gameData = doc.exists ? doc.data() : {};
          if(romLinkEl && gameData.romPath) romLinkEl.href = gameData.romPath;
          if(artEl && gameData.titleImage) artEl.src = gameData.titleImage;
          [gameData.extraScreenshot1Path, gameData.extraScreenshot2Path].forEach(function(url, i){
            if(!url) return;
            extraArtEls[i].src = url;
            extraArtEls[i].hidden = false;
          });
        var descEl = el('game-desc');
        if(descEl){ if(gameData.description){ descEl.textContent = gameData.description; descEl.hidden = false; } else descEl.hidden = true; }
        var siteEl = el('game-site'), siteLinkEl = el('game-site-link');
        if(siteEl && siteLinkEl){ if(gameData.siteUrl){ siteLinkEl.href = gameData.siteUrl; siteLinkEl.textContent = gameData.siteUrl; siteEl.hidden = false; } else siteEl.hidden = true; }
        }).catch(function(){ gameData = {}; /* fail open -- an unreadable doc isn't grounds to lock the page */ })
      : Promise.resolve();

    NGPC_AUTH.onAuthChange((user)=>{
      el('play-link').hidden = !user;
      el('idle-view').hidden = !user;
      el('scan-signin-required').hidden = !!user;
      if(!user) resetScanUI();
      gameDocPromise.then(()=>applyAccessGate(user));
    });
    el('scan-signin-btn').addEventListener('click', ()=>NGPC_AUTH.openSignInModal('signin'));
  } else {
    // auth.js itself failed to load -- none of this page's other gating works either in that
    // case, so there's nothing to meaningfully lock; show the page rather than a dead end.
    gameData = { devStatus: 'final' };
    applyAccessGate(null);
  }
})();
</script>

</body>
</html>
`;
}

function playPageTemplate(sub, slug) {
  const title = sub.proposedName;
  const romDefaultName = sub.romFileName || (slug + '.ngp');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} Web Player</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.11.0/dist/inlined/index.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<style>
  /* GENERATED DRAFT -- copied verbatim from play/2048/index.html's own template (identical across
     every game's play page already; nothing here is game-specific except the title/ROM/slug). */
  :root{
    --navy:#10162a; --panel:#181f3a; --panel2:#212a4d; --border:#37426e;
    --cream:#f4eedd; --dim:#93a0c9; --accent:#5c8fd6; --accent-ink:#0a1830;
    --accent2:#5c8fd6; --good:#4fbf8b; --danger:#e5615a;
  }
  *{ box-sizing:border-box; } html,body{ height:auto; }
  body{ margin:0; background:var(--navy); color:var(--cream); font-family:"IBM Plex Sans",system-ui,sans-serif; padding-inline:20px; padding-block:32px; display:flex; justify-content:center; }
  html.maximizing, html.maximizing body{ height:100%; overflow:hidden; }
  .px{ font-family:"Press Start 2P",monospace; }
  #shell{ width:100%; max-width:520px; display:flex; flex-direction:column; gap:18px; align-items:center; }
  header{ text-align:center; display:flex; flex-direction:column; gap:8px; }
  header h1{ font-size:15px; margin:0; letter-spacing:1px; color:var(--accent2); }
  header p{ margin:0; color:var(--dim); font-size:13px; }
  #player-panel{ width:100%; max-width:480px; aspect-ratio:160/152; position:relative; background:#000; border:1px solid var(--border); border-radius:14px; overflow:hidden; }
  #game{ width:100%; height:100%; }
  #player-panel.maximized{ position:fixed; inset:0; z-index:9999; width:100vw; height:100vh; max-width:none; aspect-ratio:auto; border-radius:0; border:none; }
  #btn-maximize{ position:absolute; left:10px; top:10px; z-index:5; width:34px; height:34px; border:none; border-radius:8px; cursor:pointer; background:rgba(0,0,0,.55); color:#fff; font-size:16px; line-height:1; display:flex; align-items:center; justify-content:center; }
  @media (max-width: 600px){ body{ padding-inline:10px; padding-block:20px; } }
  #btn-submit{ font:inherit; border:none; border-radius:8px; padding:13px 20px; cursor:pointer; font-weight:600; font-size:13.5px; width:100%; max-width:480px; background:var(--accent); color:var(--accent-ink); }
  #btn-submit:hover:not(:disabled){ filter:brightness(1.1); }
  #btn-submit:disabled{ opacity:.5; cursor:not-allowed; }
  #submit-msg{ width:100%; max-width:480px; }
  .msg{ font-size:12.5px; border-radius:8px; padding:10px 12px; text-align:center; }
  .msg.err{ background:rgba(229,97,90,.15); color:var(--danger); border:1px solid rgba(229,97,90,.35); }
  .msg.ok{ background:rgba(79,191,139,.15); color:var(--good); border:1px solid rgba(79,191,139,.35); }
  .msg.info{ background:rgba(92,143,214,.12); color:var(--dim); border:1px solid var(--border); }
  #signin-gate{ width:100%; max-width:480px; text-align:center; padding:24px; }
  #player-content{ width:100%; display:flex; flex-direction:column; gap:18px; align-items:center; }
  #player-content[hidden], #signin-gate[hidden]{ display:none; }
  footer{ text-align:center; color:var(--dim); font-size:11px; }
  #play-count{ text-align:center; color:var(--dim); font-size:11px; margin-top:-6px; }
</style>
<!-- Cloudflare Web Analytics -->
<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "33e146de507a4007bb50d3d54f01816b"}'></script>
<!-- End Cloudflare Web Analytics -->
</head>
<body>

<div id="shell">
  <header>
    <h1 class="px">${title.toUpperCase()} WEB PLAYER</h1>
    <p>Testing build &mdash; not linked from the site yet. Play in the window below, then hit
      Submit Score once the in-game QR code is on screen.</p>
  </header>

  <div id="play-count"></div>

  <div id="signin-gate">&#128274; Sign in (top right) to use the in-browser player.</div>

  <div id="player-content" hidden>
    <div id="player-panel">
      <button type="button" id="btn-maximize" title="Full screen">&#10530;</button>
      <div id="game"></div>
    </div>

    <button type="button" id="btn-submit">Submit Score</button>
    <div id="submit-msg"></div>

    <footer>Reads the in-game QR code directly from the emulator, then submits it the same way a real scan does.</footer>
  </div>
</div>

<script src="/auth.js"></script>
<script>
(function(){
  "use strict";
  let GAME_ROUTES = null;
  async function getGameRoutes(){
    if(GAME_ROUTES) return GAME_ROUTES;
    const routes = {};
    try{
      if(window.NGPC_AUTH && NGPC_AUTH.db){
        const snap = await NGPC_AUTH.db.collection('games').get();
        snap.forEach(doc=>{ const d = doc.data(); if(d.code) routes[d.code] = doc.id; });
      }
    }catch(e){ /* leave whatever was found */ }
    GAME_ROUTES = routes;
    return routes;
  }
  const el = (id)=>document.getElementById(id);
  (function(){
    const countEl = el('play-count');
    if(!countEl || !window.NGPC_AUTH || !NGPC_AUTH.db) return;
    NGPC_AUTH.db.collection('pageViews').doc(NGPC_AUTH.pathKeyFromLocation()).get().then(doc=>{
      const total = (doc.exists && doc.data().total) || 0;
      countEl.textContent = 'Played ' + total.toLocaleString() + ' time' + (total===1?'':'s');
    }).catch(()=>{});
  })();
  const gateEl = el('signin-gate');
  const contentEl = el('player-content');
  const btnSubmit = el('btn-submit');
  const msgEl = el('submit-msg');

  let emulatorRequested = false;
  async function loadEmulator(){
    if(emulatorRequested) return;
    emulatorRequested = true;
    let gameUrl = '${romDefaultName}';
    try{
      if(window.NGPC_AUTH && NGPC_AUTH.db){
        const doc = await NGPC_AUTH.db.collection('games').doc('${slug}').get();
        if(doc.exists && doc.data().romPath) gameUrl = doc.data().romPath;
      }
    }catch(e){}
    window.EJS_player = '#game';
    window.EJS_gameUrl = gameUrl;
    window.EJS_pathtodata = '../emulatorjs/data/';
    window.EJS_core = 'ngp';
    const loaderScript = document.createElement('script');
    loaderScript.src = '../emulatorjs/data/loader.js';
    document.body.appendChild(loaderScript);
    const pollId = setInterval(()=>{ if(injectFullscreenButton()) clearInterval(pollId); }, 300);
    setTimeout(()=>clearInterval(pollId), 30000);
  }

  let fsBtn = null;
  function injectFullscreenButton(){
    const gameEl = document.getElementById('game');
    if(!gameEl || !gameEl.querySelector('.ejs_canvas_parent')) return false;
    if(fsBtn) return true;
    fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.textContent = 'Submit Score';
    fsBtn.style.cssText = 'display:none; position:absolute; z-index:2147483647;'
      + 'font:600 13.5px "IBM Plex Sans",system-ui,sans-serif; padding:10px 16px; border:none;'
      + 'border-radius:8px; cursor:pointer; background:var(--accent); color:var(--accent-ink);'
      + 'box-shadow:0 2px 10px rgba(0,0,0,.5); white-space:nowrap;';
    gameEl.appendChild(fsBtn);
    fsBtn.addEventListener('click', ()=>captureAndSubmit());
    return true;
  }

  const NATIVE_ASPECT = 160 / 152;
  function positionFsBtn(){
    if(!fsBtn) return;
    const gameEl = document.getElementById('game');
    if(!gameEl) return;
    const gameRect = gameEl.getBoundingClientRect();
    if(!gameRect.width || !gameRect.height) return;
    const visibleHeight = Math.min(gameRect.height, gameRect.width / NATIVE_ASPECT);
    const visibleWidth = visibleHeight * NATIVE_ASPECT;
    const offsetX = (gameRect.width - visibleWidth) / 2;
    fsBtn.style.top = (visibleHeight + 12) + 'px';
    fsBtn.style.left = (offsetX + visibleWidth / 2) + 'px';
    fsBtn.style.right = 'auto';
    fsBtn.style.transform = 'translateX(-50%)';
  }

  const btnMaximize = el('btn-maximize');
  const playerPanel = el('player-panel');
  let isMaximized = false;
  function setMaximized(on){
    isMaximized = on;
    playerPanel.classList.toggle('maximized', on);
    document.documentElement.classList.toggle('maximizing', on);
    btnMaximize.innerHTML = on ? '&times;' : '&#10530;';
    btnMaximize.title = on ? 'Exit full screen' : 'Full screen';
    if(fsBtn) fsBtn.style.display = on ? 'block' : 'none';
    btnSubmit.style.display = on ? 'none' : '';
    msgEl.style.display = on ? 'none' : '';
    if(window.EJS_emulator && typeof EJS_emulator.handleResize === 'function'){
      requestAnimationFrame(()=>{ EJS_emulator.handleResize(); requestAnimationFrame(positionFsBtn); });
    } else if(on){ requestAnimationFrame(positionFsBtn); }
  }
  btnMaximize.addEventListener('click', ()=>setMaximized(!isMaximized));
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && isMaximized) setMaximized(false); });
  window.addEventListener('resize', ()=>{ if(isMaximized) positionFsBtn(); });

  // Same access-gate concept as the leaderboard page (bk/index.html's own access-gate comment) --
  // while this game is devStatus 'coming-soon', only the site admin or its own assigned developer
  // gets the real player; everyone else (signed in or not) sees a "not public yet" message instead
  // of the sign-in prompt. gameData is fetched once, independent of loadEmulator()'s own later
  // games/{slug} read (that one's lazy, only for romPath, and would run too late to gate on).
  const ADMIN_UID = 'L44BFbmiNkhi2vvLdrPUIxkvmfs2';
  let gameData = null;
  const gameDocPromise = (window.NGPC_AUTH && NGPC_AUTH.db)
    ? NGPC_AUTH.db.collection('games').doc('${slug}').get()
        .then(doc=>{ gameData = doc.exists ? doc.data() : {}; })
        .catch(()=>{ gameData = {}; })
    : Promise.resolve();
  function isAuthorizedViewer(user){
    if(!gameData || gameData.devStatus !== 'coming-soon') return true;
    return !!user && (user.uid === ADMIN_UID || user.uid === gameData.developerUid);
  }
  function applyAuthState(user){
    gameDocPromise.then(()=>{
      if(!isAuthorizedViewer(user)){
        gateEl.hidden = false;
        gateEl.textContent = 'This game isn’t public yet — check back once it’s live on the main page.';
        contentEl.hidden = true;
        return;
      }
      gateEl.hidden = !!user;
      gateEl.textContent = '\u{1F512} Sign in (top right) to use the in-browser player.';
      contentEl.hidden = !user;
      if(user) loadEmulator();
    });
  }
  if(window.NGPC_AUTH){ NGPC_AUTH.onAuthChange(applyAuthState); } else { applyAuthState(null); }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function showMsg(cls, text){
    msgEl.innerHTML = '<div class="msg '+cls+'">'+escapeHtml(text)+'</div>';
    if(fsBtn) fsBtn.textContent = text.length > 34 ? text.slice(0, 31)+'…' : text;
  }

  function lastPathSegment(text){
    const parts = String(text||'').split('/').filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  const scanCanvas = document.createElement('canvas');
  const scanCtx = scanCanvas.getContext('2d', {willReadFrequently:true});

  let barcodeDetector;
  function getBarcodeDetector(){
    if(barcodeDetector !== undefined) return barcodeDetector;
    if(!('BarcodeDetector' in window)){ barcodeDetector = null; return null; }
    try{ barcodeDetector = new window.BarcodeDetector({formats:['qr_code']}); }
    catch(e){ barcodeDetector = null; }
    return barcodeDetector;
  }

  async function decodeViaZbarWasm(source, w0, h0){
    if(!window.zbarWasm || !w0 || !h0) return null;
    const scale = Math.min(1, 1000/Math.max(w0,h0));
    const w = Math.round(w0*scale), h = Math.round(h0*scale);
    scanCanvas.width = w; scanCanvas.height = h;
    scanCtx.drawImage(source, 0, 0, w, h);
    try{
      const symbols = await window.zbarWasm.scanImageData(scanCtx.getImageData(0, 0, w, h));
      if(symbols && symbols.length) return symbols[0].decode();
    }catch(e){}
    return null;
  }

  function jsqrFallback(source, w0, h0, scales){
    if(!window.jsQR || !w0 || !h0) return null;
    for(const target of scales){
      const scale = Math.min(1, target/Math.max(w0,h0));
      const w = Math.round(w0*scale), h = Math.round(h0*scale);
      scanCanvas.width = w; scanCanvas.height = h;
      scanCtx.drawImage(source, 0, 0, w, h);
      const frame = scanCtx.getImageData(0, 0, w, h);
      const code = window.jsQR(frame.data, w, h, {inversionAttempts:'attemptBoth'});
      if(code && code.data) return code.data;
    }
    return null;
  }

  async function decodeSource(source, w0, h0, scales){
    const viaZbar = await decodeViaZbarWasm(source, w0, h0);
    if(viaZbar) return viaZbar;
    const bd = getBarcodeDetector();
    if(bd){
      try{
        const results = await bd.detect(source);
        if(results && results.length && results[0].rawValue) return results[0].rawValue;
      }catch(e){}
    }
    return jsqrFallback(source, w0, h0, scales);
  }

  function grabGameFrame(){
    const canvas = window.EJS_emulator && EJS_emulator.canvas;
    if(!canvas || !canvas.width || !canvas.height) return Promise.resolve(null);
    return new Promise(resolve=>{
      requestAnimationFrame(()=>{
        const visH = Math.min(canvas.height, canvas.width / NATIVE_ASPECT);
        const visW = Math.min(canvas.width, canvas.height * NATIVE_ASPECT);
        const out = document.createElement('canvas');
        out.width = visW; out.height = visH;
        out.getContext('2d', {alpha:false}).drawImage(canvas, 0, 0, visW, visH, 0, 0, visW, visH);
        resolve(out);
      });
    });
  }

  let captureBusy = false;
  function setBusy(busy){
    captureBusy = busy;
    btnSubmit.disabled = busy;
    if(fsBtn) fsBtn.disabled = busy;
  }

  async function captureAndSubmit(){
    if(captureBusy) return;
    if(!window.EJS_emulator || !EJS_emulator.canvas){
      showMsg('err', 'The game isn’t ready yet — make sure it’s running, then try again.');
      return;
    }
    setBusy(true);
    showMsg('info', 'Looking for a QR code…');
    try{
      const frame = await grabGameFrame();
      if(!frame) throw new Error('screenshot was empty');
      const w = frame.width, h = frame.height;
      const value = await decodeSource(frame, w, h, [700, 1100, 1500, 2000]);
      if(!value){
        showMsg('err', 'No QR code found on screen — make sure the in-game QR code is fully visible and try again.');
        setBusy(false);
        return;
      }
      const payload = lastPathSegment(value).toUpperCase();
      const routes = await getGameRoutes();
      const sortedCodes = Object.keys(routes).sort((a,b)=>b.length-a.length);
      const code = sortedCodes.find(c=>payload.startsWith(c)) || null;
      const slug = code ? routes[code] : null;
      if(!slug){
        showMsg('err', 'Unrecognized game code — that leaderboard might not be set up yet.');
        setBusy(false);
        return;
      }
      showMsg('ok', 'Found it — opening the leaderboard…');
      location.href = '/'+slug+'/?v='+Date.now()+'&src=capture#'+payload;
    }catch(e){
      showMsg('err', 'Capture failed: '+escapeHtml(e.message||'unknown error'));
      setBusy(false);
    }
  }

  btnSubmit.addEventListener('click', captureAndSubmit);
})();
</script>
</body>
</html>
`;
}

// A freshly-scaffolded game's board query (games/{slug}'s own sortField/sortDirection, filtered
// on game+approved) almost always needs its own Firestore composite index the very first time --
// confirmed the hard way with Minesweeper's own launch, where the leaderboard just showed a
// generic "couldn't reach the leaderboard right now" until the index was created by hand from the
// Firebase Console. Firestore's own error for this (FAILED_PRECONDITION) always embeds a
// pre-filled console link that creates EXACTLY the missing index in one click -- this runs the
// same query the live page will run (via Admin SDK, so it sees the same FAILED_PRECONDITION a
// browser would) immediately after scaffolding, and if it's missing, emails that link to the site
// admin (via the 'mail' collection the Firebase Trigger Email extension already watches -- same
// mechanism as auth.js's own notifyAdmin()) so it can be created with one tap, from anywhere,
// instead of only being discovered later when someone actually tries to submit a score.
async function checkScoreIndexAndNotify(db, sub, slug) {
  const code = sub.proposedCode;
  const sortField = camelCase(sub.sortField || 'score');
  const sortDir = sub.sortDirection === 'asc' ? 'asc' : 'desc';
  try {
    await db.collection('scores').where('game', '==', code).where('approved', '==', true).orderBy(sortField, sortDir).limit(1).get();
    return { ok: true };
  } catch (e) {
    const m = /https:\/\/console\.firebase\.google\.com\S+/.exec(e.message || '');
    if (!m) return { ok: false, notified: false, error: e.message };
    const link = m[0];
    try {
      await db.collection('mail').add({
        to: ['darekdavis@gmail.com'],
        message: {
          subject: sub.proposedName + ' needs a one-time Firestore index before its leaderboard will load',
          text: 'The scaffolded leaderboard for "' + sub.proposedName + '" (/' + slug + '/) can\'t query its scores yet --'
            + ' Firestore needs a composite index for game="' + code + '" + approved==true, sorted by '
            + sortField + ' (' + sortDir + ').\n\n'
            + 'Tap to create it (pre-filled, one tap, works from your phone):\n' + link + '\n\n'
            + 'It takes a minute or two to finish building after you tap Create Index. Until then the'
            + ' leaderboard shows "Couldn\'t reach the leaderboard right now."',
        },
      });
      return { ok: false, notified: true, link };
    } catch (mailErr) {
      return { ok: false, notified: false, link, mailError: mailErr.message };
    }
  }
}

// Exported for scaffold-game.test.js -- lets the generator logic be exercised with a synthetic
// submission object, no live Firestore/service-account needed, since main() below is the only
// part that actually touches the network.
module.exports = { camelCase, pascalCase, planFields, generateParseFunction, generateScorecardTable, generateRulesSnippet, leaderboardTemplate, playPageTemplate, generateAndWrite, printScaffoldNextSteps, findSubmissionAndSlug, checkScoreIndexAndNotify };

// Looks up the submission + slug from EITHER a gameSubmissions doc id OR a games/{slug} slug --
// reset-game.js and approve-submission.js both key off a slug, so accepting one here too avoids
// the "which id did this script want again" mixup between the three.
async function findSubmissionAndSlug(db, arg) {
  const subDoc = await db.collection('gameSubmissions').doc(arg).get();
  if (subDoc.exists) {
    const sub = Object.assign({ _id: arg }, subDoc.data());
    const gamesSnap = await db.collection('games').where('code', '==', sub.proposedCode).limit(1).get();
    if (gamesSnap.empty) {
      console.log('No games/{slug} doc found for code "' + sub.proposedCode + '" -- approve the submission first.');
      process.exit(1);
    }
    return { sub, slug: gamesSnap.docs[0].id };
  }

  // Not a submission id -- try it as a slug instead (same lookup reset-game.js already does).
  const gameDoc = await db.collection('games').doc(arg).get();
  if (!gameDoc.exists) {
    console.log('No such submission and no such games/{slug}: "' + arg + '"');
    process.exit(1);
  }
  const game = gameDoc.data();
  let subsSnap = await db.collection('gameSubmissions').where('reviewNote', '==', 'Approved as games/' + arg).get();
  if (subsSnap.empty && game.code) {
    subsSnap = await db.collection('gameSubmissions').where('proposedCode', '==', game.code).get();
  }
  if (subsSnap.empty) {
    console.log('games/' + arg + ' exists but no matching gameSubmissions doc was found for it.');
    process.exit(1);
  }
  const doc = subsSnap.docs[0];
  return { sub: Object.assign({ _id: doc.id }, doc.data()), slug: arg };
}

// The actual generate-and-write step, factored out so approve-submission.js can call it directly
// (see that script's own --scaffold flag) instead of shelling out to this one as a second step --
// "part of the approval push" means one script run produces both the games/{slug} doc AND a
// working draft page to commit together, not two separate invocations on two separate days.
// Returns { manualFields, lbPath, playPath, rulesSnippetPath, skipped } -- skipped is true (no
// files touched) when the submission has no payloadFields to generate from at all.
function generateAndWrite(sub, slug, { apply, force } = {}) {
  if (!sub.payloadFields || !sub.payloadFields.length) {
    return { skipped: true };
  }

  const plan = planFields(sub);
  const manualFields = plan.fields.filter(f => f.manual).map(f => f.rawName);
  const hasScorecardNote = !!(sub.scorecardFormula || '').trim();

  const lbPath = path.join(REPO_ROOT, slug, 'index.html');
  const playPath = path.join(REPO_ROOT, 'play', slug, 'index.html');
  const rulesSnippetPath = path.join(REPO_ROOT, slug + '-rules-snippet.txt');

  if (!apply) {
    return { skipped: false, manualFields, hasScorecardNote, lbPath, playPath, rulesSnippetPath, written: false };
  }

  for (const p of [lbPath, playPath]) {
    if (fs.existsSync(p) && !force) {
      throw new Error('Refusing to overwrite existing file: ' + p + ' (pass --force to overwrite).');
    }
  }

  fs.mkdirSync(path.dirname(lbPath), { recursive: true });
  fs.mkdirSync(path.dirname(playPath), { recursive: true });
  fs.writeFileSync(lbPath, leaderboardTemplate(sub, plan, slug));
  fs.writeFileSync(playPath, playPageTemplate(sub, slug));
  fs.writeFileSync(rulesSnippetPath, generateRulesSnippet(sub, plan, slug) + '\n');

  return { skipped: false, manualFields, hasScorecardNote, lbPath, playPath, rulesSnippetPath, written: true };
}

function printScaffoldNextSteps(slug) {
  console.log('\nNext steps:');
  console.log('  1. Read both generated pages -- fix any TODO/FIXME, adjust colors/art, add a real');
  console.log('     scorecard if this game needs one beyond "print each field".');
  console.log('  2. Review ' + slug + '-rules-snippet.txt and paste it into firestore.rules\' own');
  console.log('     isXScore() OR-chain (allow create for scores/{scoreId}), then run');
  console.log('     deploy-firestore-rules.js --apply (or paste into the Firebase console).');
  console.log('  3. Delete ' + slug + '-rules-snippet.txt once it\'s pasted in -- it\'s a scratch file.');
  console.log('  4. git add/commit/push -- devStatus stays "coming-soon" until you\'re happy, but');
  console.log('     the page is live at that URL immediately once pushed, for the developer to');
  console.log('     confirm against.');
  console.log('  5. Flip devStatus off "coming-soon" from /admin/game/ once it\'s ready to launch.');
}

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  const force = process.argv.includes('--force');
  const [arg] = args;
  if (!arg) {
    console.log('Usage: node scaffold-game.js <submissionId | slug> [--apply] [--force]');
    process.exit(1);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const { sub, slug } = await findSubmissionAndSlug(db, arg);

  let result;
  try {
    result = generateAndWrite(sub, slug, { apply, force });
  } catch (e) {
    console.log('\n' + e.message);
    process.exit(1);
  }
  if (result.skipped) {
    console.log('This submission has no payloadFields recorded -- nothing to generate from.');
    process.exit(1);
  }

  console.log((apply ? 'GENERATED' : 'DRY RUN --') + ' scaffold for "' + sub.proposedName + '" [' + sub.proposedCode + '] -> /' + slug + '/');
  console.log('  ' + result.lbPath);
  console.log('  ' + result.playPath);
  console.log('  ' + result.rulesSnippetPath + ' (review file, never auto-pasted into firestore.rules)');
  if (result.manualFields.length) {
    console.log('\n  NEEDS HAND-EDITING -- these fields have a non-fixed width and were left as TODOs:');
    result.manualFields.forEach(n => console.log('    - ' + n));
  }
  if (result.hasScorecardNote) {
    console.log('\n  NEEDS HAND-EDITING -- the submission\'s own scorecardFormula asked for something');
    console.log('    this generator can\'t auto-implement -- see the TODO left in ' + slug + '/index.html.');
  }

  if (!apply) {
    console.log('\nRe-run with --apply to write these files.');
    return;
  }

  printScaffoldNextSteps(slug);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
