/* Neo Turf Masters replay lists for the leaderboard page: a player's own saves (mountMine) and the public gallery
 * (mountGallery). Needs /auth.js (NGPC_AUTH) + replays.js (TMReplays). Uses the page's --navy/--panel2/... tokens. */
(function () {
  'use strict';
  const R = window.TMReplays;
  const esc = (s) => NGPC_AUTH.escapeHtml(String(s == null ? '' : s));
  const date = (t) => t ? new Date(t).toLocaleDateString() : '';

  const css = document.createElement('style');
  css.textContent = `
    .tmr-list{ display:flex; flex-direction:column; gap:8px; }
    .tmr-row{ display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--panel2); }
    .tmr-info{ flex:1 1 220px; min-width:0; }
    .tmr-t{ font-size:14px; font-weight:600; } .tmr-t a{ color:var(--cream); text-decoration:none; } .tmr-t a:hover{ color:var(--accent); }
    .tmr-d{ font-size:12px; color:var(--dim); margin-top:2px; }
    .tmr-acts{ display:flex; flex-wrap:wrap; gap:6px; }
    .tmr-acts button, .tmr-pick button{ font:inherit; font-size:12.5px; background:transparent; color:var(--cream); border:1px solid var(--border); border-radius:8px; padding:6px 11px; cursor:pointer; }
    .tmr-acts button:hover, .tmr-pick button:hover{ border-color:var(--accent); }
    .tmr-acts button.tmr-del:hover{ border-color:var(--danger); color:var(--danger); }
    .tmr-acts button:disabled{ opacity:.5; cursor:default; }
    .tmr-score{ font-weight:600; } .tmr-under{ color:var(--good); }
    .tmr-chip{ font-size:11px; border:1px solid var(--good); color:var(--good); border-radius:999px; padding:1px 8px; margin-left:6px; font-weight:500; }
    .tmr-empty{ font-size:13px; color:var(--dim); padding:4px 2px; }
    .tmr-msg{ font-size:12.5px; color:var(--dim); margin-top:8px; }
    .tmr-pick{ margin-top:8px; padding:10px 12px; border:1px solid var(--accent); border-radius:10px; font-size:13px; display:flex; flex-direction:column; gap:6px; }
    .tmr-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
    .tmr-card{ margin:0; background:var(--panel2); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    .tmr-frame{ position:relative; aspect-ratio:160/152; background:#000; }
    .tmr-frame video{ display:block; width:100%; height:100%; object-fit:contain; image-rendering:pixelated; }
    .tmr-wait{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--dim); pointer-events:none; }
    .tmr-card figcaption{ padding:8px 10px 10px; }
    .tmr-card .tmr-t{ font-size:13.5px; }
    .tmr-card a{ color:var(--accent); }
    .tmr-sub{ font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--dim); margin:12px 0 6px; } .tmr-sub:first-child{ margin-top:0; }
    .tmr-link{ font:inherit; font-size:inherit; background:none; border:none; color:var(--accent); cursor:pointer; padding:0; }
    .tmr-more{ font-size:12.5px; margin-top:10px; } .tmr-more a{ color:var(--accent); } .tmr-more button{ font:inherit; background:none; border:none; color:var(--accent); cursor:pointer; padding:0; }`;
  document.head.appendChild(css);

  function scoreHtml(s) {
    const under = s.result === 'holed' && s.strokes && s.strokes < s.par;
    return '<span class="tmr-score' + (under ? ' tmr-under' : '') + '">' + esc(R.scoreLabel(s)) + '</span>' +
      (s.result === 'holed' && s.strokes ? ' &middot; ' + s.strokes + ' stroke' + (s.strokes === 1 ? '' : 's') : '') + ' &middot; par ' + (s.par | 0);
  }
  function row(s, detail) {
    const r = document.createElement('div'); r.className = 'tmr-row';
    r.innerHTML = '<div class="tmr-info"><div class="tmr-t"><a href="' + R.replayHref(s.code, detail.gallery) + '">' + esc(R.title(s)) + '</a>' +
      (detail.shared ? '<span class="tmr-chip">In gallery</span>' : '') + '</div><div class="tmr-d">' + detail.text + '</div></div>';
    const acts = document.createElement('div'); acts.className = 'tmr-acts'; r.appendChild(acts);
    return { r, acts };
  }

  // ---- make a video for a hole, asking which of the player's videos to overwrite when all MAX are used.
  // holes: the player's hole list (titles for the picker). Resolves to the video URL, or null when cancelled.
  function makeVideoFlow(code, box, say, holes) {
    const meta = (c) => (holes || []).find(h => h.code === c);
    return new Promise((resolve, reject) => {
      const go = async (replace) => {
        say('Making the video in the real game… the first time takes about a minute.');
        try {
          const j = await R.makeVideo(code, replace);
          if (!j.full) { say(''); resolve(j.url); return; }
          const pick = document.createElement('div'); pick.className = 'tmr-pick';
          pick.innerHTML = '<div>You have ' + R.MAX + ' videos, the most an account can keep. Choose one to overwrite (its video is deleted; the hole itself stays in your list and can get a video again later):</div>';
          say('');
          j.slots.forEach((s, i) => {
            const m = meta(s.code);
            const b = document.createElement('button');
            b.textContent = 'Overwrite ' + (m ? R.title(m) + ' (' + R.scoreLabel(m) + ')' : 'video ' + (i + 1));
            b.onclick = () => { pick.remove(); go(i); };
            pick.appendChild(b);
          });
          const c = document.createElement('button'); c.textContent = 'Cancel';
          c.onclick = () => { pick.remove(); resolve(null); }; pick.appendChild(c);
          box.appendChild(pick);
        } catch (e) { say(''); reject(e); }
      };
      go(null);
    });
  }

  // ---- the signed-in player's videos (up to MAX) and every hole they have opened from a QR
  function mountMine(box, show) {
    show = show || 10;
    let me = null, busy = false, hist = [], vids = [], mine = [], n = show;
    const vhead = document.createElement('div'); vhead.className = 'tmr-sub';
    const vlist = document.createElement('div'); vlist.className = 'tmr-list';
    const hhead = document.createElement('div'); hhead.className = 'tmr-sub';
    const hlist = document.createElement('div'); hlist.className = 'tmr-list';
    const msg = document.createElement('div'); msg.className = 'tmr-msg';
    box.append(vhead, vlist, msg, hhead, hlist);
    const say = (t) => { msg.textContent = t || ''; };
    const meta = (code) => hist.find(h => h.code === code) || { code, course: 0, hole: 0, result: '', strokes: 0, par: 0 };
    const sharedIn = (code) => mine.some(g => g.code === code);
    const hasVideo = (code) => vids.some(v => v.code === code);

    function render() {
      vhead.textContent = 'My videos (' + vids.length + ' of ' + R.MAX + ')';
      vlist.innerHTML = '';
      if (!vids.length) vlist.innerHTML = '<div class="tmr-empty">No videos yet. Press &ldquo;Make video&rdquo; on any of your holes below (or &ldquo;Watch in the real game&rdquo; on a replay).</div>';
      vids.forEach(v => {
        const h = meta(v.code);
        const { r, acts } = row(h, { shared: sharedIn(v.code), text: scoreHtml(h) + ' &middot; video made ' + date(v.at) });
        const btn = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = () => run(fn); acts.appendChild(b); };
        btn('Watch', () => { window.open(v.key ? 'https://storage.googleapis.com/ngpc-leaderboard-tm-replays/' + v.key : R.replayHref(v.code), '_blank'); return 'keep'; });
        btn('Download', async () => { const j = await R.makeVideo(v.code); await R.saveFile(j.url, h, say); return 'keep'; });
        if (sharedIn(v.code)) btn('Remove from gallery', () => R.unshare(me, v.code));
        else btn('Share to gallery', () => doShare(h, null));
        btn('Delete video', async () => {
          if (!confirm('Delete the video of ' + R.title(h) + '? The hole stays in your list and can get a video again later.' + (sharedIn(v.code) ? ' It also leaves the gallery.' : ''))) return 'keep';
          await R.deleteVideo(v.code);
        }, 'tmr-del');
        vlist.appendChild(r);
      });
      hhead.textContent = 'All my holes (' + hist.length + ')';
      hlist.innerHTML = '';
      if (!hist.length) {
        hlist.innerHTML = '<div class="tmr-empty">No holes yet. Scan a hole replay QR (scorecard, OPTION) while signed in and it is kept here for good.</div>';
        return;
      }
      hist.slice(0, n).forEach(h => {
        const { r, acts } = row(h, { text: scoreHtml(h) + ' &middot; ' + date(h.scannedAt) + (hasVideo(h.code) ? ' &middot; has a video' : '') });
        if (!hasVideo(h.code)) {
          const b = document.createElement('button'); b.textContent = 'Make video';
          b.onclick = () => run(async () => { if (await makeVideoFlow(h.code, hlist, say, hist) === null) return; });
          acts.appendChild(b);
        }
        hlist.appendChild(r);
      });
      if (hist.length > n) {
        const b = document.createElement('button'); b.className = 'tmr-link'; b.textContent = 'Show ' + Math.min(show, hist.length - n) + ' more';
        b.onclick = () => { n += show; render(); }; hlist.appendChild(b);
      }
    }
    async function doShare(h, takeDownId) {
      const res = await R.share(me, h, takeDownId);
      mine = res.mine;
      if (res.full) {                         // both gallery places taken: ask which one comes down
        const pick = document.createElement('div'); pick.className = 'tmr-pick';
        pick.innerHTML = '<div>You can have ' + R.GALLERY_MAX + ' videos in the gallery. Take one down to share ' + esc(R.title(h)) + ':</div>';
        mine.forEach(g => {
          const b = document.createElement('button'); b.textContent = 'Replace ' + R.title(g) + ' (' + R.scoreLabel(g) + ')';
          b.onclick = () => run(() => doShare(h, g.id)); pick.appendChild(b);
        });
        const c = document.createElement('button'); c.textContent = 'Cancel'; c.onclick = () => { pick.remove(); }; pick.appendChild(c);
        vlist.appendChild(pick);
        return 'keep';
      }
    }
    async function refresh() { [vids, mine] = await Promise.all([R.myVideos(me.uid), R.myGallery(me.uid)]); }
    async function run(fn) {
      if (busy) return; busy = true; say('');
      box.querySelectorAll('button').forEach(b => b.disabled = true);
      let keep;
      try { keep = await fn(); if (keep !== 'keep') await refresh(); } catch (e) { say('Something went wrong (' + e.message + ').'); }
      busy = false;
      box.querySelectorAll('button').forEach(b => b.disabled = false);
      if (keep !== 'keep') {
        render();
        if (window.TMReplaysUI.onGalleryChange) window.TMReplaysUI.onGalleryChange();
      }
    }
    return {
      async setUser(u) {
        me = u || null; hist = []; vids = []; mine = []; n = show;
        vhead.textContent = ''; hhead.textContent = ''; hlist.innerHTML = '';
        if (!me) { vlist.innerHTML = ''; return; }
        vlist.innerHTML = '<div class="tmr-empty">Loading&hellip;</div>';
        try { [hist] = await Promise.all([R.history(me.uid), refresh()]); render(); }
        catch (e) { vlist.innerHTML = '<div class="tmr-empty">Could not load your holes (' + esc(e.message) + ').</div>'; }
      }
    };
  }

  // ---- public gallery: the real-game videos in a grid, ready to play. The shown cards ask the render service for
  // their videos one at a time (cached ones answer in a couple of seconds; sharing pre-renders them).
  // moreHref: instead of "Show more", link to the full gallery page when there are more than `show`
  function mountGallery(box, show, moreHref) {
    show = show || 6;
    const grid = document.createElement('div'); grid.className = 'tmr-grid'; box.appendChild(grid);
    const more = document.createElement('div'); more.className = 'tmr-more'; box.appendChild(more);
    let items = [], n = show;
    function card(s) {
      const c = document.createElement('figure'); c.className = 'tmr-card';
      const v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.preload = 'metadata';
      const wait = document.createElement('div'); wait.className = 'tmr-wait'; wait.textContent = 'Loading video…';
      const frame = document.createElement('div'); frame.className = 'tmr-frame'; frame.append(v, wait);
      v.addEventListener('play', () => grid.querySelectorAll('video').forEach(o => { if (o !== v) o.pause(); }));
      const cap = document.createElement('figcaption');
      cap.innerHTML = '<div class="tmr-t">' + esc(s.username) + '</div><div class="tmr-d">' + esc(R.title(s)) + ' &middot; ' + scoreHtml(s) +
        '</div><div class="tmr-d">' + date(s.sharedAt) + ' &middot; <a href="' + R.replayHref(s.code, true) + '">shot map</a></div>';
      c.append(frame, cap);
      c._load = async () => {
        try { v.src = (await R.galleryVideo(s.code)) + '#t=0.5'; wait.remove(); }
        catch (e) { wait.textContent = 'Video unavailable right now.'; }
      };
      return c;
    }
    function render() {
      grid.innerHTML = ''; more.innerHTML = '';
      if (!items.length) { grid.innerHTML = '<div class="tmr-empty">Nothing shared yet. Save a hole replay and share it to start the gallery.</div>'; return; }
      const cards = items.slice(0, n).map(card);
      cards.forEach(c => grid.appendChild(c));
      (async () => { for (const c of cards) await c._load(); })();
      if (items.length > n && moreHref) {
        more.innerHTML = '<a href="' + moreHref + '">See all ' + items.length + ' public replays &rarr;</a>';
      } else if (items.length > n) {
        const b = document.createElement('button'); b.textContent = 'Show more (' + (items.length - n) + ')';
        b.onclick = () => { n += show; render(); }; more.appendChild(b);
      }
    }
    async function reload() {
      try { items = await R.gallery(60); render(); }
      catch (e) { grid.innerHTML = '<div class="tmr-empty">Could not load the gallery (' + esc(e.message) + ').</div>'; }
    }
    grid.innerHTML = '<div class="tmr-empty">Loading&hellip;</div>';
    reload();
    return { reload };
  }

  window.TMReplaysUI = { mountMine, mountGallery, makeVideoFlow, onGalleryChange: null };
})();
