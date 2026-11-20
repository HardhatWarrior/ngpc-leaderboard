/* Neo Turf Masters saved replays (tm_replays/{uid}, up to 5) + public gallery (tm_gallery/{uid}_{slot}) + video download.
 * Needs firebase compat + /auth.js (window.NGPC_AUTH). Exposes window.TMReplays. */
(function () {
  'use strict';
  const RENDER = 'https://tm-replay-743782972200.us-central1.run.app/render';
  const COURSE = ['U.S.A.', 'Germany', 'Japan', 'Australia', 'Scotland'];
  const MAX = 5, GALLERY_MAX = 2;
  const db = () => NGPC_AUTH.db;

  function scoreLabel(slot) {
    if (slot.result !== 'holed' || !slot.strokes) return 'Unfinished';
    const d = slot.strokes - slot.par;
    if (slot.strokes === 1) return 'Hole in one';
    return ({ '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' })[d]
      || (d > 0 ? '+' + d : String(d));
  }
  function title(slot) { return COURSE[slot.course] + ' · Hole ' + (slot.hole + 1); }
  // gallery links carry ?g so opening someone else's hole doesn't land in the viewer's own history
  function replayHref(code, gallery) { return '/tm/replay/' + (gallery ? '?g' : '') + '#' + code; }

  // every hole the player opens from a QR: tm_replays/{uid}/history/{code} (the payload is the doc id, so each
  // hole is kept once, forever). The video can be made again from it at any time.
  const histCol = (uid) => db().collection('tm_replays').doc(uid).collection('history');
  async function record(user, slot) {
    const ref = histCol(user.uid).doc(slot.code);
    if ((await ref.get()).exists) return false;
    await ref.set({ code: slot.code, course: slot.course, hole: slot.hole, strokes: slot.strokes | 0, par: slot.par | 0,
                    result: String(slot.result || ''), scannedAt: Date.now() });
    return true;
  }
  async function history(uid) {
    const q = await histCol(uid).orderBy('scannedAt', 'desc').get();
    return q.docs.map(d => d.data());
  }

  async function load(uid) {
    const doc = await db().collection('tm_replays').doc(uid).get();
    const slots = doc.exists ? (doc.data().slots || []) : [];
    // first version: shared === true with the gallery doc keyed by the slot index -> keep that doc, store its id number
    slots.forEach((s, i) => { if (s.shared === true) s.shared = i; });
    return slots;
  }
  async function store(uid, slots) {
    await db().collection('tm_replays').doc(uid).set({ uid, slots, updatedAt: Date.now() });
  }
  // a slot's `shared` is false, or its gallery position (0 or 1): tm_gallery/{uid}_{pos}, so at most GALLERY_MAX per player
  const isShared = (s) => typeof s.shared === 'number';
  const galDoc = (uid, pos) => db().collection('tm_gallery').doc(uid + '_' + pos);
  // save: replaceIndex = null to append (returns {full} when MAX are saved)
  async function save(user, slot, replaceIndex) {
    const slots = await load(user.uid);
    if (slots.some(s => s.code === slot.code)) return { already: true, slots };
    const clean = { code: slot.code, course: slot.course, hole: slot.hole, strokes: slot.strokes | 0, par: slot.par | 0,
                    result: String(slot.result || ''), savedAt: Date.now(), shared: false };
    if (replaceIndex == null) {
      if (slots.length >= MAX) return { full: true, slots };
      slots.push(clean);
    } else {
      if (slots[replaceIndex] && isShared(slots[replaceIndex])) await galDoc(user.uid, slots[replaceIndex].shared).delete().catch(() => {});
      slots[replaceIndex] = clean;
    }
    await store(user.uid, slots);
    return { saved: true, slots };
  }
  async function remove(user, index) {
    const slots = await load(user.uid);
    if (slots[index] && isShared(slots[index])) await galDoc(user.uid, slots[index].shared).delete().catch(() => {});
    slots.splice(index, 1);
    await store(user.uid, slots);
    return slots;
  }
  // share: takeDown = index of a shared slot to pull from the gallery when both places are taken (else returns {full})
  async function share(user, index, takeDown) {
    const slots = await load(user.uid);
    const s = slots[index];
    if (!s || isShared(s)) return { slots };
    if (takeDown != null && slots[takeDown] && isShared(slots[takeDown])) {
      await galDoc(user.uid, slots[takeDown].shared).delete().catch(() => {});
      slots[takeDown].shared = false;
    }
    const used = slots.filter(isShared).map(x => x.shared);
    const pos = [0, 1].find(p => !used.includes(p));
    if (used.length >= GALLERY_MAX || pos === undefined) return { full: true, slots };
    await galDoc(user.uid, pos).set({
      uid: user.uid, username: user.username, code: s.code, course: s.course, hole: s.hole, strokes: s.strokes | 0,
      par: s.par | 0, result: String(s.result || ''), sharedAt: Date.now() });
    s.shared = pos; await store(user.uid, slots);
    videoUrl(s.code).catch(() => {});            // render it now so gallery viewers get it straight away
    return { slots };
  }
  async function unshare(user, index) {
    const slots = await load(user.uid);
    if (slots[index] && isShared(slots[index])) { await galDoc(user.uid, slots[index].shared).delete().catch(() => {}); slots[index].shared = false; }
    await store(user.uid, slots);
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

  window.TMReplays = { MAX, GALLERY_MAX, isShared, COURSE, RENDER, scoreLabel, title, replayHref, load, save, remove, share, unshare, gallery, videoUrl, download, record, history };
})();
