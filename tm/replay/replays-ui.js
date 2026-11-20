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
    .tmr-more{ font-size:12.5px; margin-top:10px; } .tmr-more button{ font:inherit; background:none; border:none; color:var(--accent); cursor:pointer; padding:0; }`;
  document.head.appendChild(css);

  function scoreHtml(s) {
    const under = s.result === 'holed' && s.strokes && s.strokes < s.par;
    return '<span class="tmr-score' + (under ? ' tmr-under' : '') + '">' + esc(R.scoreLabel(s)) + '</span>' +
      (s.result === 'holed' && s.strokes ? ' &middot; ' + s.strokes + ' stroke' + (s.strokes === 1 ? '' : 's') : '') + ' &middot; par ' + (s.par | 0);
  }
  function row(s, detail) {
    const r = document.createElement('div'); r.className = 'tmr-row';
    r.innerHTML = '<div class="tmr-info"><div class="tmr-t"><a href="' + R.replayHref(s.code) + '">' + esc(R.title(s)) + '</a>' +
      (R.isShared(s) && !detail.gallery ? '<span class="tmr-chip">In gallery</span>' : '') + '</div><div class="tmr-d">' + detail.text + '</div></div>';
    const acts = document.createElement('div'); acts.className = 'tmr-acts'; r.appendChild(acts);
    return { r, acts };
  }

  // ---- the signed-in player's saves. onCount(n) lets the page hide the panel when there is nothing to show.
  function mountMine(box) {
    let me = null, busy = false, slots = [];
    const list = document.createElement('div'); list.className = 'tmr-list';
    const msg = document.createElement('div'); msg.className = 'tmr-msg';
    box.append(list, msg);
    const say = (t) => { msg.textContent = t || ''; };

    function render() {
      list.innerHTML = '';
      if (!slots.length) {
        list.innerHTML = '<div class="tmr-empty">No saved replays yet. Scan a hole replay QR (scorecard, OPTION), then press &ldquo;Save to my replays&rdquo;.</div>';
        return;
      }
      slots.forEach((s, i) => {
        const { r, acts } = row(s, { text: scoreHtml(s) + ' &middot; saved ' + date(s.savedAt) });
        const btn = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = () => run(fn); acts.appendChild(b); };
        btn('Download video', () => R.download(s.code, s, say));
        if (R.isShared(s)) btn('Remove from gallery', async () => { slots = await R.unshare(me, i); });
        else btn('Share to gallery', () => doShare(i, null));
        btn('Delete', async () => {
          if (!confirm('Delete ' + R.title(s) + ' (' + R.scoreLabel(s) + ') from your replays?' + (R.isShared(s) ? ' It also leaves the gallery.' : ''))) return;
          slots = await R.remove(me, i);
        }, 'tmr-del');
        list.appendChild(r);
      });
      const n = document.createElement('div'); n.className = 'tmr-empty';
      n.textContent = slots.length + ' of ' + R.MAX + ' saved · ' + slots.filter(R.isShared).length + ' of ' + R.GALLERY_MAX + ' in the gallery';
      list.appendChild(n);
    }
    async function doShare(i, takeDown) {
      const res = await R.share(me, i, takeDown);
      slots = res.slots;
      if (res.full) {                         // both gallery places taken: ask which one comes down
        const pick = document.createElement('div'); pick.className = 'tmr-pick';
        pick.innerHTML = '<div>You can have ' + R.GALLERY_MAX + ' replays in the gallery. Take one down to share ' + esc(R.title(slots[i])) + ':</div>';
        slots.forEach((s, k) => {
          if (!R.isShared(s)) return;
          const b = document.createElement('button'); b.textContent = 'Replace ' + R.title(s) + ' (' + R.scoreLabel(s) + ')';
          b.onclick = () => run(() => doShare(i, k)); pick.appendChild(b);
        });
        const c = document.createElement('button'); c.textContent = 'Cancel'; c.onclick = () => { pick.remove(); }; pick.appendChild(c);
        render(); list.appendChild(pick);
        return 'keep';
      }
    }
    async function run(fn) {
      if (busy) return; busy = true; say('');
      box.querySelectorAll('button').forEach(b => b.disabled = true);
      let keep;
      try { keep = await fn(); } catch (e) { say('Something went wrong (' + e.message + ').'); }
      busy = false;
      if (keep !== 'keep') render();
      box.querySelectorAll('button').forEach(b => b.disabled = false);
      if (window.TMReplaysUI.onGalleryChange && keep !== 'keep') window.TMReplaysUI.onGalleryChange();
    }
    return {
      async setUser(u) {
        me = u || null; slots = [];
        if (!me) { list.innerHTML = ''; return; }
        list.innerHTML = '<div class="tmr-empty">Loading&hellip;</div>';
        try { slots = await R.load(me.uid); render(); }
        catch (e) { list.innerHTML = '<div class="tmr-empty">Could not load your replays (' + esc(e.message) + ').</div>'; }
      }
    };
  }

  // ---- public gallery: newest first, `show` at a time with a "show more"
  function mountGallery(box, show) {
    show = show || 6;
    const list = document.createElement('div'); list.className = 'tmr-list'; box.appendChild(list);
    let items = [], n = show;
    function render() {
      list.innerHTML = '';
      if (!items.length) { list.innerHTML = '<div class="tmr-empty">Nothing shared yet. Save a hole replay and share it to start the gallery.</div>'; return; }
      for (const s of items.slice(0, n)) {
        const { r, acts } = row(s, { gallery: true, text: esc(s.username) + ' &middot; ' + scoreHtml(s) + ' &middot; ' + date(s.sharedAt) });
        const a = document.createElement('a'); a.href = R.replayHref(s.code); a.innerHTML = '<button>Watch</button>'; acts.appendChild(a);
        list.appendChild(r);
      }
      if (items.length > n) {
        const m = document.createElement('div'); m.className = 'tmr-more';
        const b = document.createElement('button'); b.textContent = 'Show more (' + (items.length - n) + ')';
        b.onclick = () => { n += show * 2; render(); }; m.appendChild(b); list.appendChild(m);
      }
    }
    async function reload() {
      try { items = await R.gallery(60); render(); }
      catch (e) { list.innerHTML = '<div class="tmr-empty">Could not load the gallery (' + esc(e.message) + ').</div>'; }
    }
    list.innerHTML = '<div class="tmr-empty">Loading&hellip;</div>';
    reload();
    return { reload };
  }

  window.TMReplaysUI = { mountMine, mountGallery, onGalleryChange: null };
})();
