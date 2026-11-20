/* Neo Turf Masters saved replays (tm_replays/{uid}, up to 5) + public gallery (tm_gallery/{uid}_{slot}) + video download.
 * Needs firebase compat + /auth.js (window.NGPC_AUTH). Exposes window.TMReplays. */
(function () {
  'use strict';
  const RENDER = 'https://tm-replay-743782972200.us-central1.run.app/render';
  const COURSE = ['U.S.A.', 'Germany', 'Japan', 'Australia', 'Scotland'];
  const MAX = 5;
  const db = () => NGPC_AUTH.db;

  function scoreLabel(slot) {
    if (slot.result !== 'holed' || !slot.strokes) return 'Unfinished';
    const d = slot.strokes - slot.par;
    if (slot.strokes === 1) return 'Hole in one';
    return ({ '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' })[d]
      || (d > 0 ? '+' + d : String(d));
  }
  function title(slot) { return COURSE[slot.course] + ' · Hole ' + (slot.hole + 1); }
  function replayHref(code) { return '/tm/replay/#' + code; }

  async function load(uid) {
    const doc = await db().collection('tm_replays').doc(uid).get();
    return doc.exists ? (doc.data().slots || []) : [];
  }
  async function store(uid, slots) {
    await db().collection('tm_replays').doc(uid).set({ uid, slots, updatedAt: Date.now() });
  }
  // save: replaceIndex = null to append (fails with 'full' when 5 are saved)
  async function save(user, slot, replaceIndex) {
    const slots = await load(user.uid);
    if (slots.some(s => s.code === slot.code)) return { already: true, slots };
    const clean = { code: slot.code, course: slot.course, hole: slot.hole, strokes: slot.strokes | 0, par: slot.par | 0,
                    result: String(slot.result || ''), savedAt: Date.now(), shared: false };
    if (replaceIndex == null) {
      if (slots.length >= MAX) return { full: true, slots };
      slots.push(clean);
    } else {
      if (slots[replaceIndex] && slots[replaceIndex].shared) await unshare(user, replaceIndex, slots, false);
      slots[replaceIndex] = clean;
    }
    await store(user.uid, slots);
    return { saved: true, slots };
  }
  async function remove(user, index) {
    const slots = await load(user.uid);
    if (slots[index] && slots[index].shared) await db().collection('tm_gallery').doc(user.uid + '_' + index).delete().catch(() => {});
    // shared entries are keyed by slot number: re-key the ones that move down
    const moved = slots.slice(index + 1).map((s, k) => ({ s, from: index + 1 + k }));
    slots.splice(index, 1);
    for (const { s, from } of moved) if (s.shared) {
      await db().collection('tm_gallery').doc(user.uid + '_' + from).delete().catch(() => {});
      await shareDoc(user, from - 1, s);
    }
    await store(user.uid, slots);
    return slots;
  }
  function shareDoc(user, index, s) {
    return db().collection('tm_gallery').doc(user.uid + '_' + index).set({
      uid: user.uid, username: user.username, code: s.code, course: s.course, hole: s.hole, strokes: s.strokes | 0,
      par: s.par | 0, result: String(s.result || ''), sharedAt: Date.now() });
  }
  async function share(user, index) {
    const slots = await load(user.uid);
    if (!slots[index]) return slots;
    await shareDoc(user, index, slots[index]);
    slots[index].shared = true; await store(user.uid, slots);
    return slots;
  }
  async function unshare(user, index, slotsIn, write = true) {
    const slots = slotsIn || await load(user.uid);
    await db().collection('tm_gallery').doc(user.uid + '_' + index).delete().catch(() => {});
    if (slots[index]) slots[index].shared = false;
    if (write) await store(user.uid, slots);
    return slots;
  }
  async function gallery(limit) {
    const q = await db().collection('tm_gallery').orderBy('sharedAt', 'desc').limit(limit || 60).get();
    return q.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  // the real-game video: rendered on first request (about a minute), cached after that
  async function videoUrl(code) {
    const r = await fetch(RENDER + '?code=' + encodeURIComponent(code));
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || ('error ' + r.status));
    return j.url;
  }
  async function download(code, slot, onStatus) {
    onStatus && onStatus('Preparing the video… the first time takes about a minute.');
    const url = await videoUrl(code);
    onStatus && onStatus('Downloading…');
    const blob = await (await fetch(url)).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'TurfMasters_' + (slot ? (COURSE[slot.course] || '').replace(/\W/g, '') + '_Hole' + (slot.hole + 1) : 'replay') + '.mp4';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    onStatus && onStatus('');
  }

  window.TMReplays = { MAX, COURSE, RENDER, scoreLabel, title, replayHref, load, save, remove, share, unshare, gallery, videoUrl, download };
})();
