/* Neo Turf Masters hole replays: every hole a player opens from a QR is kept for good (tm_replays/{uid}/history/{code}).
 * Real-game videos: up to 5 per player (tm_videos/{uid}, managed by the render service; making a 6th overwrites one the
 * player picks, and its MP4 is deleted). Up to 2 videos can be shared to the public gallery (tm_gallery/{uid}_{0|1}),
 * where anyone can watch them.
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

  // ---- the player's holes: the payload is the doc id, so each hole is kept once, for good; the video can be
  // made again from it at any time
  const histCol = (uid) => db().collection('tm_replays').doc(uid).collection('history');
  async function record(user, slot) {
    const ref = histCol(user.uid).doc(slot.code);
    if ((await ref.get()).exists) return false;
    await ref.set({ code: slot.code, course: slot.course, hole: slot.hole, strokes: slot.strokes | 0, par: slot.par | 0,
                    result: String(slot.result || ''), scannedAt: slot.scannedAt || Date.now() });
    return true;
  }
  async function history(uid) {
    const q = await histCol(uid).orderBy('scannedAt', 'desc').get();
    const list = q.docs.map(d => d.data());
    // the first version kept up to 5 "saved" replays in tm_replays/{uid}.slots: fold any of those in
    try {
      const doc = await db().collection('tm_replays').doc(uid).get();
      const slots = doc.exists ? (doc.data().slots || []) : [];
      for (const s of slots) if (!list.some(h => h.code === s.code)) {
        const h = { code: s.code, course: s.course, hole: s.hole, strokes: s.strokes | 0, par: s.par | 0, result: s.result || '', scannedAt: s.savedAt || Date.now() };
        if (await record({ uid }, h)) list.push(h);
      }
      list.sort((a, b) => b.scannedAt - a.scannedAt);
    } catch (e) {}
    return list;
  }

  // ---- videos: up to MAX per player (tm_videos/{uid}, kept by the render service, which also deletes overwritten MP4s)
  const SERVICE = RENDER.replace(/\/render$/, '');
  async function myVideos(uid) {
    const doc = await db().collection('tm_videos').doc(uid).get();
    return doc.exists ? (doc.data().slots || []) : [];
  }
  async function call(path, body) {
    const u = NGPC_AUTH.auth.currentUser;
    if (!u) throw new Error('sign in first');
    const r = await fetch(SERVICE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await u.getIdToken() },
                                            body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.full) return j;
    if (!r.ok) throw new Error(j.error || ('error ' + r.status));
    return j;
  }
  // makeVideo: {url} (rendered the first time, about a minute), or {full, slots} when all MAX are used and replace is unset
  function makeVideo(code, replace) { return call('/render', replace == null ? { code } : { code, replace }); }
  function deleteVideo(code) { return call('/delete', { code }); }
  // anyone: the video of a gallery hole
  async function galleryVideo(code) {
    const r = await fetch(SERVICE + '/video?code=' + encodeURIComponent(code));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || ('error ' + r.status));
    return j.url;
  }

  // ---- gallery: the player's entries are found by uid (ids are {uid}_0 / {uid}_1)
  async function myGallery(uid) {
    const q = await db().collection('tm_gallery').where('uid', '==', uid).get();
    return q.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }
  // share: takeDownId = one of the player's gallery doc ids to pull first when both places are taken (else {full})
  async function share(user, h, takeDownId) {
    if (takeDownId) await db().collection('tm_gallery').doc(takeDownId).delete();
    const mine = await myGallery(user.uid);
    if (mine.some(g => g.code === h.code)) return { mine };
    const pos = [0, 1].find(p => !mine.some(g => g.id === user.uid + '_' + p));
    if (mine.length >= GALLERY_MAX || pos === undefined) return { full: true, mine };
    await db().collection('tm_gallery').doc(user.uid + '_' + pos).set({
      uid: user.uid, username: user.username, code: h.code, course: h.course, hole: h.hole, strokes: h.strokes | 0,
      par: h.par | 0, result: String(h.result || ''), sharedAt: Date.now() });
    return { mine: await myGallery(user.uid) };
  }
  async function unshare(user, code) {
    for (const g of await myGallery(user.uid)) if (g.code === code) await db().collection('tm_gallery').doc(g.id).delete();
  }
  async function gallery(limit) {
    const q = await db().collection('tm_gallery').orderBy('sharedAt', 'desc').limit(limit || 60).get();
    return q.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  async function saveFile(url, slot, onStatus) {
    onStatus && onStatus('Downloading…');
    const blob = await (await fetch(url)).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'TurfMasters_' + (slot ? (COURSE[slot.course] || '').replace(/\W/g, '') + '_Hole' + (slot.hole + 1) : 'replay') + '.mp4';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    onStatus && onStatus('');
  }

  window.TMReplays = { MAX, GALLERY_MAX, COURSE, scoreLabel, title, replayHref, record, history,
                       myVideos, makeVideo, deleteVideo, galleryVideo, saveFile, myGallery, share, unshare, gallery };
})();
