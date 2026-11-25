/* Puzzle Link careers (PL1C / PL2C): ONE doc per player (scores/<GAME>_<uid>), like the Metal Slugs' MS1M / MS2M.
   Every code from the _03 patches (PL12 / PL22) is merged in by the page:
     PL1C: best Normal score (+ its difficulty / start stage / level), plays, the card collection (cardSet: 19 chars,
           5 cards each, 0-9A-V; union of every code) and owned (its popcount, of 91).
     PL2C: best per board [Card Game, Endless 2 / 3 / 4 targets] (+ that run's level/round, stage, Power UP, time),
           plays per board, cardSet (20 chars, 100 cards), owned; score = the highest of the four (for the ticker).
     codes: the last 300 merged codes, so a rescan never counts twice.
   firestore.rules (isPuzzleLinkCareer*) checks the shape and that bests and the code list never shrink.
   Also renders the career panel: stats, the card grid (whole CARD DATA screens from /plN/cards.png) and badges. */
(function(){
"use strict";
const A32 = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
const esc = (s)=>String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zeros = (n)=>Array.from({length:n}, ()=>0);
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function check(body){ let s = 0; for(let i=0;i<body.length;i++) s += ALNUM.indexOf(body[i]); s %= 1296; return ALNUM[Math.floor(s/36)] + ALNUM[s%36]; }

// ---- codes
function parsePL12(t){
  if(t.length !== 42) return {error: t.length < 42 ? "That code is too short — rescan with the whole code in frame." : "That code is too long — rescan just the one code."};
  if(!/^[0-9A-Z]{3}$/.test(t.slice(4,7)) || !/^\d{14}$/.test(t.slice(7,21)) || !/^[0-9A-V]{19}$/.test(t.slice(21,40))) return {error:"That code has an unreadable value."};
  if(t.slice(40) !== check(t.slice(0,40))) return {error:"That code didn't scan cleanly (check mismatch) — rescan it."};
  const n = (a,b)=>parseInt(t.slice(a,b),10);
  const r = { game:'PL1C', initials:t.slice(4,7), score:n(7,15), difficulty:n(15,16), startStage:n(16,17), level:n(17,19), owned:n(19,21), cardSet:t.slice(21,40) };
  if(r.score < 1 || r.difficulty > 2 || r.startStage > 8 || r.owned > 91) return {error:"That code doesn't look like a finished game."};
  if(r.difficulty < 1) return {error:"That game was played on EASY. Only AVE or HARD counts for the leaderboard."};
  return r;
}
function parsePL22(t){
  if(t.length !== 46) return {error: t.length < 46 ? "That code is too short — rescan with the whole code in frame." : "That code is too long — rescan just the one code."};
  if(!/^[0-9A-Z]{3}$/.test(t.slice(4,7)) || !/^\d{17}$/.test(t.slice(7,24)) || !/^[0-9A-V]{20}$/.test(t.slice(24,44))) return {error:"That code has an unreadable value."};
  if(t.slice(44) !== check(t.slice(0,44))) return {error:"That code didn't scan cleanly (check mismatch) — rescan it."};
  const n = (a,b)=>parseInt(t.slice(a,b),10);
  const r = { game:'PL2C', initials:t.slice(4,7), mode:n(7,8), score:n(8,16), targets:n(16,17), powerUp:n(17,18), stage:n(18,19), level:n(19,21), owned:n(21,24), cardSet:t.slice(24,44) };
  if(r.mode > 1 || r.score < 1 || r.targets < 2 || r.targets > 4 || r.powerUp > 1 || r.stage > 4 || r.owned > 100) return {error:"That code doesn't look like a finished game."};
  r.board = r.mode === 0 ? 0 : r.targets - 1;   // 0 Card Game, 1-3 Endless 2/3/4 targets
  return r;
}

// ---- merge
const bitsOf = (ch)=>A32.indexOf(ch);
function unionSet(a, b, n){
  let out = '';
  for(let i=0;i<n;i++) out += A32[((a && a[i] ? bitsOf(a[i]) : 0) | (b && b[i] ? bitsOf(b[i]) : 0)) & 31];
  return out;
}
function popSet(s){ let n = 0; for(const ch of s){ let v = bitsOf(ch); while(v){ n += v & 1; v >>= 1; } } return n; }
function codeKey(sub){ return (sub.board != null ? sub.board + '_' : '') + sub.score + '_' + sub.level + '_' + sub.cardSet; }
function merge(old, sub, extra){
  const key = codeKey(sub);
  if(old && Array.isArray(old.codes) && old.codes.indexOf(key) >= 0) return { dup:true };
  const o = old || {}, codes = (Array.isArray(o.codes) ? o.codes : []).concat([key]).slice(-300);
  if(sub.game === 'PL1C'){
    const cardSet = unionSet(o.cardSet, sub.cardSet, 19);
    const better = !old || sub.score > o.score || (sub.score === o.score && sub.difficulty > o.difficulty);
    const run = better ? sub : o;
    return { dup:false, better:better, data: Object.assign({ game:'PL1C', initials: sub.initials, score: run.score, difficulty: run.difficulty,
      startStage: run.startStage, level: run.level, bestAt: better ? Date.now() : o.bestAt, plays: (o.plays||0) + 1,
      cardSet: cardSet, owned: popSet(cardSet), codes: codes }, extra) };
  }
  const cardSet = unionSet(o.cardSet, sub.cardSet, 20);
  const arr = (a)=>Array.isArray(a) && a.length === 4 ? a.slice() : zeros(4);
  const best = arr(o.best), bLevel = arr(o.bLevel), bStage = arr(o.bStage), bPower = arr(o.bPower), bAt = arr(o.bAt), plays = arr(o.plays);
  const b = sub.board, better = sub.score > best[b];
  plays[b] += 1;
  if(better){ best[b] = sub.score; bLevel[b] = sub.level; bStage[b] = sub.stage; bPower[b] = sub.powerUp; bAt[b] = Date.now(); }
  return { dup:false, better:better, data: Object.assign({ game:'PL2C', initials: sub.initials, score: Math.max(...best), best: best, bLevel: bLevel,
    bStage: bStage, bPower: bPower, bAt: bAt, plays: plays, cardSet: cardSet, owned: popSet(cardSet), codes: codes }, extra) };
}

// ---- card data + grid
const cardCache = {};
function loadCards(slug){
  if(!cardCache[slug]) cardCache[slug] = fetch('/'+slug+'/cards.json?v=1').then(r=>r.json());
  return cardCache[slug];
}
function owns(set, i){ return !!(set && set[Math.floor(i/5)] && (bitsOf(set[Math.floor(i/5)]) >> (i%5)) & 1); }
const CSS = `
.plc-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; margin-top:6px; }
.plc-card{ border:1px solid var(--border); border-radius:6px; padding:4px; background:var(--navy); cursor:pointer; text-align:center; }
.plc-card .img{ width:80px; height:76px; margin:0 auto; background-repeat:no-repeat; image-rendering:pixelated; }
.plc-card.off .img{ filter:grayscale(1); opacity:.45; }
.plc-card small{ display:block; font-size:10px; color:var(--dim); margin-top:3px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.plc-card.on small{ color:var(--cream, #eee); }
.plc-stage{ font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); margin:14px 0 2px; }
.plc-big{ margin:10px 0; text-align:center; }
.plc-big .img{ width:320px; height:304px; max-width:100%; margin:0 auto; background-repeat:no-repeat; image-rendering:pixelated; }
.plc-big .note{ font-size:12px; color:var(--dim); margin-top:4px; }
`;
function injectCss(){ if(document.getElementById('plc-css')) return; const s = document.createElement('style'); s.id = 'plc-css'; s.textContent = CSS; document.head.appendChild(s); }
function sprite(slug, meta, i, scale){
  const col = i % meta.cols, row = Math.floor(i / meta.cols), w = meta.w * scale, h = meta.h * scale;
  return 'background-image:url(/'+slug+'/cards.png?v=1);background-size:'+(meta.cols*w)+'px auto;background-position:-'+(col*w)+'px -'+(row*h)+'px';
}
async function cardGrid(slug, set, box){
  injectCss();
  const meta = await loadCards(slug);
  const stages = slug === 'pl2';
  let html = '<div id="plc-big"></div>', grp = null;
  meta.cards.forEach((c, i)=>{
    if(stages && c.stage !== grp){ html += (grp !== null ? '</div>' : '') + '<div class="plc-stage">'+esc(c.stage)+' cards</div><div class="plc-grid">'; grp = c.stage; }
    else if(!stages && i === 0) html += '<div class="plc-grid">';
    const on = owns(set, i);
    html += '<div class="plc-card '+(on?'on':'off')+'" data-card="'+i+'" title="'+esc(on ? c.name : '?')+'">'+
      '<div class="img" style="'+sprite(slug, meta, i, 0.5)+'"></div><small>'+(stages ? c.no : i+1)+' '+esc(on ? c.name : '???')+'</small></div>';
  });
  box.innerHTML = html + '</div>';
  box.onclick = (e)=>{
    const t = e.target.closest('.plc-card'); if(!t) return;
    const i = +t.dataset.card, c = meta.cards[i], on = owns(set, i), big = box.querySelector('#plc-big');
    if(!on){ big.innerHTML = '<div class="plc-big"><div class="note">Not collected yet.</div></div>'; return; }
    const extra = slug === 'pl2' ? c.pts + ' Pts · stage ' + c.stage : (c.h + ' cm · ' + c.w + ' kg');
    big.innerHTML = '<div class="plc-big"><div class="img" style="'+sprite(slug, meta, i, 2)+'"></div><div class="note">'+esc(c.name)+' — '+esc(extra)+' — “'+esc(c.note)+'”</div></div>';
    big.scrollIntoView({behavior:'smooth', block:'nearest'});
  };
}

window.PL_CAREER = { parsePL12: parsePL12, parsePL22: parsePL22, merge: merge, owns: owns, popSet: popSet, cardGrid: cardGrid, loadCards: loadCards, esc: esc };
})();
