/*
 * auth.js - shared username/password auth, loaded by every page (index.html, lb/index.html,
 * tetris/index.html, and any future game page) via a plain <script src="/auth.js"> tag placed
 * right before that page's own inline <script>, after #shell already exists in the DOM.
 *
 * Firebase Auth's email/password provider has no native username login -- it needs SOME string
 * shaped like an email as the account identifier. Rather than build real auth from scratch (a bad
 * idea -- password hashing/session security is exactly what Firebase Auth is for), this maps a
 * username to a deterministic, never-delivered synthetic email (bob -> bob@users.ngpc-dev.com)
 * that Firebase's own bookkeeping uses internally; the person only ever sees/types their username.
 * A real, optional recovery email (if given) is stored as plain profile data in Firestore, NOT
 * wired into Firebase's built-in "forgot password" email flow -- that flow emails whatever address
 * is on the Auth account, which is the synthetic one here, so it'd go nowhere useful. Automating
 * real recovery needs a Cloud Function (server-side), which needs the Firebase project on the paid
 * Blaze plan -- deferred until actually needed; for now the address is just collected and stored.
 *
 * Injects its own DOM (an account status bar at the top of #shell, and a sign-in/up modal on
 * document.body) and CSS (reusing each page's own --navy/--panel/etc. tokens, already defined
 * identically on every page that loads this file), so integrating a new page requires nothing
 * beyond the Firebase SDK script tags + this file's own <script> tag -- no markup to copy/paste.
 */
window.NGPC_AUTH = (function(){
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDdywSkX8eagOhxtOJulsL9P8KbUGDtqqM",
    authDomain: "ngpc-leaderboard.firebaseapp.com",
    projectId: "ngpc-leaderboard",
    storageBucket: "ngpc-leaderboard.firebasestorage.app",
    messagingSenderId: "743782972200",
    appId: "1:743782972200:web:36b586c7b3b73affb06e1d"
  };

  if(!window.firebase){
    return null; // firebase-app-compat.js failed to load -- caller checks for this
  }
  if(!firebase.apps.length){
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();

  const EMAIL_DOMAIN = 'users.ngpc-dev.com';
  const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

  function usernameToEmail(usernameLower){
    return usernameLower + '@' + EMAIL_DOMAIN;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function signUp(usernameRaw, password, recoveryEmailRaw){
    const username = (usernameRaw||'').trim();
    if(!USERNAME_RE.test(username)){
      throw {code:'invalid-username', message:'Usernames are 3-16 characters: letters, numbers, underscore only.'};
    }
    const usernameLower = username.toLowerCase();
    const email = usernameToEmail(usernameLower);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    // approved:false always -- an account can sign in and submit scores right away, but stays
    // off the public boards until the admin approves it (see firestore.rules' submitterApproved()
    // on the scores collection). Only isAdmin() can ever flip this bit; a client can't self-approve.
    const profile = { username, usernameLower, createdAt: Date.now(), avatar: DEFAULT_AVATAR, approved: false };
    const recoveryEmail = (recoveryEmailRaw||'').trim();
    if(recoveryEmail) profile.recoveryEmail = recoveryEmail;
    try{
      // One atomic batch, not a transaction -- there's no read to make a decision from here, the
      // uniqueness guarantee comes entirely from the security rules (a usernames/{uname} doc can
      // only ever be CREATEd, never updated, so a second claim on the same username is evaluated
      // as a denied update, which fails this whole batch and leaves nothing partially written).
      const batch = db.batch();
      batch.set(db.collection('usernames').doc(usernameLower), {uid});
      batch.set(db.collection('users').doc(uid), profile);
      await batch.commit();
    }catch(e){
      // The auth account exists at this point even though the profile/reservation didn't get
      // written -- delete it rather than leave an orphan with no username pointing at it (which
      // would be permanently unreachable, since sign-in only ever looks accounts up by username).
      try{ await cred.user.delete(); }catch(_e){ /* best effort */ }
      if(e && e.code === 'permission-denied'){
        throw {code:'username-taken', message:'That username is already taken.'};
      }
      throw e;
    }
    return cred.user;
  }

  function signIn(usernameRaw, password){
    const email = usernameToEmail((usernameRaw||'').trim().toLowerCase());
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signOutNow(){ return auth.signOut(); }

  // ---- profile updates (account page) ----

  async function updateUsername(newUsernameRaw){
    const user = auth.currentUser;
    if(!user) throw {code:'not-signed-in', message:'Sign in first.'};
    const newUsername = (newUsernameRaw||'').trim();
    if(!USERNAME_RE.test(newUsername)){
      throw {code:'invalid-username', message:'Usernames are 3-16 characters: letters, numbers, underscore only.'};
    }
    const newLower = newUsername.toLowerCase();
    const oldLower = currentUser && currentUser.usernameLower;
    if(oldLower === newLower){
      throw {code:'same-username', message:'That’s already your username.'};
    }
    try{
      // Same all-or-nothing batch approach as signUp: release the old reservation, claim the
      // new one, and update the profile in one shot. The new claim is what can actually fail
      // (already taken by someone else), and a batch failure leaves the old reservation intact
      // -- no window where the account has no username pointing at it.
      const batch = db.batch();
      if(oldLower) batch.delete(db.collection('usernames').doc(oldLower));
      batch.set(db.collection('usernames').doc(newLower), {uid:user.uid});
      batch.update(db.collection('users').doc(user.uid), {username:newUsername, usernameLower:newLower});
      await batch.commit();
    }catch(e){
      if(e && e.code === 'permission-denied'){
        throw {code:'username-taken', message:'That username is already taken.'};
      }
      throw e;
    }
  }

  // Lives at users/{uid}/private/contact, NOT on the public profile doc -- see firestore.rules'
  // own comment on why recovery email has to be split out into a separately-gated location
  // (only the owner and the admin can ever read it; the parent users/{uid} doc is public).
  async function updateRecoveryEmail(emailRaw){
    const user = auth.currentUser;
    if(!user) throw {code:'not-signed-in', message:'Sign in first.'};
    const email = (emailRaw||'').trim();
    // Firestore rejects `undefined`, and there's no user-facing way to fully clear a field via
    // .set()/merge with a plain value -- FieldValue.delete() is the documented way to remove one.
    const value = email ? email : firebase.firestore.FieldValue.delete();
    await db.collection('users').doc(user.uid).collection('private').doc('contact')
      .set({recoveryEmail: value}, {merge:true});
  }

  // Reads the signed-in user's OWN recovery email (only they, or the admin, can read this at
  // all -- see firestore.rules). Separate from loadProfile() below, which only ever reads the
  // public profile doc, since folding this into every profile load would mean every leaderboard
  // page attempts a read that's denied for anyone browsing someone else's stats.
  async function fetchOwnRecoveryEmail(){
    const user = auth.currentUser;
    if(!user) return null;
    try{
      const snap = await db.collection('users').doc(user.uid).collection('private').doc('contact').get();
      return snap.exists ? (snap.data().recoveryEmail || null) : null;
    }catch(e){ return null; }
  }

  const AVATAR_SIZE = 32;
  const AVATAR_CELLS = AVATAR_SIZE * AVATAR_SIZE;

  // -1 is a sentinel for "transparent" -- outside the 0..4095 range a real packed RGB444 word
  // can ever take, so it can't collide with any actual color. Mirrors the tile editor's own
  // index-0-is-transparent convention (see its "Preview index 0 as transparent" toggle), just
  // via a dedicated value instead of a reserved palette slot, since this editor has no palette.
  const TRANSPARENT = -1;
  function isTransparent(word){ return word === TRANSPARENT; }
  function packColor(r,g,b){ return (r&0xF) | ((g&0xF)<<4) | ((b&0xF)<<8); }
  function unpackColor(word){ return { r: word&0xF, g: (word>>4)&0xF, b: (word>>8)&0xF }; }
  // Same RGB444->CSS scaling the tile editor uses (17 = 255/15, exact even steps 0..255).
  function css255FromWord(word){ const c = unpackColor(word); return 'rgb('+(c.r*17)+','+(c.g*17)+','+(c.b*17)+')'; }

  // Default avatar for a brand-new signup -- the classic NEO GEO logo mark, chroma-keyed off its
  // flat white background and hand-packed to this same 32x32 RGB444 format (not generated at
  // runtime, so a fresh signup never depends on canvas/image-decoding work succeeding). Existing
  // accounts are untouched -- this only ever gets set at the moment signUp() creates a profile.
  const DEFAULT_AVATAR = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,815,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,557,831,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,814,559,-1,-1,-1,1184,1440,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,551,815,558,-1,-1,-1,1456,1456,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,554,831,-1,-1,-1,1184,1456,880,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,551,556,-1,-1,1456,1472,1152,-1,-1,-1,3472,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,272,-1,-1,-1,1168,1168,-1,-1,-1,3744,4000,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,815,815,-1,-1,546,-1,-1,3472,4000,3744,3200,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,559,815,815,815,815,815,559,-1,-1,3216,4016,3472,2145,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,558,815,559,554,551,550,553,558,815,558,-1,1073,2673,1073,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,559,815,815,554,550,548,-1,-1,530,549,558,815,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,558,815,558,555,550,-1,557,815,559,815,815,-1,553,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,553,815,555,-1,-1,-1,558,558,557,814,557,-1,549,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,547,558,559,-1,-1,555,815,557,547,547,-1,-1,550,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,553,815,558,-1,558,815,558,-1,-1,-1,-1,556,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,547,558,559,-1,554,559,558,-1,-1,-1,-1,559,815,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,553,815,556,272,553,559,815,558,-1,558,815,557,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,548,558,815,-1,272,551,559,815,558,815,557,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,553,815,558,-1,272,549,557,815,554,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,548,558,558,-1,-1,-1,547,549,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,553,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,548,558,559,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,554,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,548,558,559,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,554,815,558,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,548,559,815,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,554,554,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,529,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];

  // Draws one avatar cell at grid position (gx,gy) -- a flat color for opaque pixels.
  // Transparent cells are left untouched, allowing the background behind the canvas to show through.
  function drawAvatarCell(ctx, word, gx, gy, cellPx){
    if(isTransparent(word)) return;
    const x = gx*cellPx, y = gy*cellPx;
    ctx.fillStyle = css255FromWord(word);
    ctx.fillRect(x, y, cellPx, cellPx);
  }

  async function updateAvatar(packedWords){
    const user = auth.currentUser;
    if(!user) throw {code:'not-signed-in', message:'Sign in first.'};
    if(!Array.isArray(packedWords) || packedWords.length !== AVATAR_CELLS){
      throw {code:'invalid-avatar', message:'Avatar must be a '+AVATAR_SIZE+'x'+AVATAR_SIZE+' grid.'};
    }
    await db.collection('users').doc(user.uid).update({avatar: packedWords});
  }

  // Batched avatar lookup for a leaderboard render -- one query per up-to-30 uids (Firestore's
  // own cap on an `in` clause) rather than one read per row, and always fresh rather than
  // denormalized onto the score doc (which would go stale the moment someone repaints their
  // avatar after already having scores on the board). Returns {uid: packedWords}, silently
  // omitting any uid with no profile or no avatar saved.
  async function fetchAvatars(uids){
    const unique = Array.from(new Set(uids)).filter(Boolean);
    const map = {};
    if(!unique.length) return map;
    const chunks = [];
    for(let i=0;i<unique.length;i+=30) chunks.push(unique.slice(i,i+30));
    await Promise.all(chunks.map(async (chunk)=>{
      try{
        const snap = await db.collection('users').where(firebase.firestore.FieldPath.documentId(),'in',chunk).get();
        snap.forEach(doc=>{
          const d = doc.data();
          if(Array.isArray(d.avatar) && d.avatar.length===AVATAR_CELLS) map[doc.id]=d.avatar;
        });
      }catch(e){ /* board still renders fine without avatars on a lookup failure */ }
    }));
    return map;
  }

  // Draws a packed avatar (or a flat placeholder color if avatar is null/wrong length) onto a
  // <canvas> at cellPx-per-pixel -- used by the account bar chip, the leaderboard row chip, and
  // the account page's own preview, so all three always render identically off the exact same
  // packed data.
  function renderAvatarToCanvas(canvas, packedWords, cellPx){
    const size = AVATAR_SIZE;
    canvas.width = Math.round(size*cellPx);
    canvas.height = Math.round(size*cellPx);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if(!Array.isArray(packedWords) || packedWords.length !== AVATAR_CELLS){
      ctx.fillStyle = '#37426e'; // matches the shared --border token; canvas can't resolve CSS vars
      ctx.fillRect(0,0,canvas.width,canvas.height);
      return;
    }
    // Render at native 1:1 (one canvas pixel per avatar cell) first, THEN scale up via drawImage
    // -- fillRect()'s own edges anti-alias at non-integer coordinates no matter what
    // imageSmoothingEnabled is set to (that flag only governs drawImage's interpolation, not
    // path/rect fills), so drawing cells directly at a fractional cellPx (e.g. the leaderboard
    // row chip's 28/16 = 1.75px) blended adjacent colors at every cell boundary instead of
    // staying crisp. Compositing through a native-resolution buffer sidesteps that entirely,
    // at any cellPx, integer or not.
    const native = document.createElement('canvas');
    native.width = size; native.height = size;
    const nctx = native.getContext('2d');
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        drawAvatarCell(nctx, packedWords[y*size+x], x, y, 1);
      }
    }
    ctx.drawImage(native, 0, 0, size, size, 0, 0, canvas.width, canvas.height);
  }

  function friendlyAuthError(e){
    const code = e && e.code;
    switch(code){
      case 'invalid-username': return e.message;
      case 'username-taken': return e.message;
      case 'same-username': return e.message;
      case 'not-signed-in': return e.message;
      case 'invalid-avatar': return e.message;
      case 'auth/email-already-in-use': return 'That username is already taken.';
      case 'auth/weak-password': return 'Password needs to be at least 6 characters.';
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-credential': return 'Incorrect username or password.';
      case 'auth/too-many-requests': return 'Too many attempts — wait a moment and try again.';
      case 'auth/operation-not-allowed':
      case 'auth/configuration-not-found': return 'Sign-up isn’t available right now — try again later.';
      case 'auth/network-request-failed': return 'Couldn’t reach the server — check your connection and try again.';
      // Firestore's own codes (hyphenated, distinct vocabulary from the auth/* codes above) --
      // profile/avatar/username updates go through Firestore, not just the Auth SDK.
      case 'permission-denied': return 'That was rejected by the site’s access rules — try again later.';
      case 'resource-exhausted': return 'Too many requests right now — wait a moment and try again.';
      case 'unavailable': return 'Couldn’t reach the server right now. Try again in a bit.';
      default: return 'Something went wrong — try again.';
    }
  }

  // ---- shared score-detail rendering -- the account page's Submissions list and the public
  // player-stats page both need every game's own per-row click-to-expand detail (or, for Tetris,
  // its own inline meta text), matching each game's own leaderboard exactly. Centralized here
  // (rather than duplicated a 3rd/4th time across account/index.html and user/index.html, the way
  // each *leaderboard* page's own QR-scan code is duplicated per game) since both pages need every
  // game's renderer at once, not just one. Ported verbatim from each game's own leaderboard page --
  // see lb/index.html's computeScores/frameMarks, yahtzee/index.html's computeYahtzeeTotals, etc.
  // for the reference implementations this was copied from.
  const SCORE_MAX_FRAMES = 10;

  function bowlingMarkChar(pins){
    if(pins===10) return 'X';
    if(pins===0) return '-';
    return String(pins);
  }
  function bowlingComputeScores(rolls){
    const scores = new Array(SCORE_MAX_FRAMES).fill(null);
    let ri = 0, running = 0;
    for(let frame=0; frame<SCORE_MAX_FRAMES; frame++){
      if(frame < 9){
        if(ri >= rolls.length) break;
        if(rolls[ri] === 10){
          if(ri+2 >= rolls.length) break;
          running += 10 + rolls[ri+1] + rolls[ri+2];
          ri += 1;
        } else {
          if(ri+1 >= rolls.length) break;
          if(rolls[ri] + rolls[ri+1] === 10){
            if(ri+2 >= rolls.length) break;
            running += 10 + rolls[ri+2];
          } else {
            running += rolls[ri] + rolls[ri+1];
          }
          ri += 2;
        }
      } else {
        const remaining = rolls.length - ri;
        if(remaining < 2) break;
        const needThree = rolls[ri]===10 || (rolls[ri]+rolls[ri+1]===10);
        if(needThree && remaining < 3) break;
        let frameTotal = rolls[ri] + rolls[ri+1];
        if(needThree) frameTotal += rolls[ri+2];
        running += frameTotal;
        ri += needThree ? 3 : 2;
      }
      scores[frame] = running;
    }
    return scores;
  }
  function bowlingFrameMarks(rolls){
    const marks = Array.from({length:SCORE_MAX_FRAMES}, ()=>[]);
    let ri = 0;
    for(let frame=0; frame<SCORE_MAX_FRAMES; frame++){
      if(ri >= rolls.length) break;
      if(frame < 9){
        const r1 = rolls[ri];
        if(r1 === 10){ marks[frame]=['X']; ri+=1; continue; }
        const m1 = bowlingMarkChar(r1);
        if(ri+1 >= rolls.length){ marks[frame]=[m1]; break; }
        const r2 = rolls[ri+1];
        marks[frame] = [m1, (r1+r2===10)?'/':bowlingMarkChar(r2)];
        ri += 2;
      } else {
        const r1 = rolls[ri];
        const m1 = bowlingMarkChar(r1);
        if(ri+1 >= rolls.length){ marks[frame]=[m1]; break; }
        const r2 = rolls[ri+1];
        let m2, needThird;
        if(r1===10){ m2=bowlingMarkChar(r2); needThird=true; }
        else if(r1+r2===10){ m2='/'; needThird=true; }
        else { m2=bowlingMarkChar(r2); needThird=false; }
        marks[frame] = [m1, m2];
        if(!needThird) break;
        if(ri+2 >= rolls.length) break;
        marks[frame].push(bowlingMarkChar(rolls[ri+2]));
        break;
      }
    }
    return marks;
  }
  function renderBowlingScorecardHTML(rolls){
    const scores = bowlingComputeScores(rolls);
    const marks = bowlingFrameMarks(rolls);
    let html = '<div class="scorecard-grid">';
    for(let f=0; f<SCORE_MAX_FRAMES; f++){
      const m = marks[f] || [];
      html += '<div class="sc-frame">'+
        '<div class="sc-marks">'+m.map(c=>'<span>'+escapeHtml(c)+'</span>').join('')+'</div>'+
        '<div class="sc-total tnum">'+(scores[f]!=null ? scores[f] : '')+'</div>'+
      '</div>';
    }
    return html + '</div>';
  }

  const YZ_CATS = ['Ones','Twos','Threes','Fours','Fives','Sixes','3-Kind','4-Kind','House','Small','Large','Yahtzee','Chance'];
  const YZ_UPPER_COUNT = 6, YZ_BONUS_THRESHOLD = 63, YZ_BONUS_AMOUNT = 35;
  function yahtzeeComputeTotals(scores){
    let upper = 0;
    for(let i=0;i<YZ_UPPER_COUNT;i++) upper += scores[i];
    const bonus = upper >= YZ_BONUS_THRESHOLD ? YZ_BONUS_AMOUNT : 0;
    const upperTotal = upper + bonus;
    let lower = 0;
    for(let i=YZ_UPPER_COUNT;i<YZ_CATS.length;i++) lower += scores[i];
    const grand = upperTotal + lower;
    return {upper, bonus, upperTotal, lower, grand};
  }
  function renderYahtzeeScorecardHTML(scores){
    const t = yahtzeeComputeTotals(scores);
    let rows = '';
    for(let i=0;i<YZ_CATS.length;i++){
      if(i === YZ_UPPER_COUNT){
        rows += '<tr class="yz-total"><td>Bonus (63+)</td><td class="yz-val tnum">'+t.bonus+'</td></tr>';
        rows += '<tr class="yz-total"><td>Upper total</td><td class="yz-val tnum">'+t.upperTotal+'</td></tr>';
      }
      rows += '<tr><td>'+escapeHtml(YZ_CATS[i])+'</td><td class="yz-val tnum">'+scores[i]+'</td></tr>';
    }
    rows += '<tr class="yz-total"><td>Lower total</td><td class="yz-val tnum">'+t.lower+'</td></tr>';
    rows += '<tr class="yz-grand"><td>Grand total</td><td class="yz-val tnum">'+t.grand+'</td></tr>';
    return '<table class="yz-sheet">'+rows+'</table>';
  }

  function renderFarkleScorecardHTML(data){
    const badgeClass = data.resultDisplay === 'WIN' ? 'win' : data.resultDisplay === 'LOSS' ? 'loss' : data.resultDisplay === 'DRAW' ? 'draw' : 'solo';
    const rows = '<tr><td>Score</td><td class="fk-val tnum">'+data.score+'</td></tr>'+
      '<tr><td>Rounds</td><td class="fk-val tnum">'+data.rounds+'</td></tr>'+
      '<tr><td>Opened</td><td class="fk-val tnum">'+data.opened+'</td></tr>'+
      '<tr><td>Farkles</td><td class="fk-val tnum">'+data.farkles+'</td></tr>'+
      '<tr><td colspan="2"><div class="fk-badge '+badgeClass+'">'+(data.resultDisplay||'')+'</div></td></tr>';
    return '<table class="fk-sheet">'+rows+'</table>';
  }

  function render2048ScorecardHTML(data){
    const rows = '<tr><td>Score</td><td class="tk-val tnum">'+data.score+'</td></tr>'+
      '<tr><td>Moves</td><td class="tk-val tnum">'+data.moves+'</td></tr>';
    return '<table class="tk-sheet">'+rows+'</table>';
  }

  // Over Rev's own catalog data, same convention every game page uses for its small constant
  // lookup tables (e.g. YZ_CATS above) -- mirrors overrev/index.html's embedded copy, which in
  // turn mirrors overrev-leaderboard-kit/catalog.json (rules revision 1).
  const OV_COURSES = ['CYPRESS LANE','CITY CIRCUIT','CANYON RUN','COAST ROAD','NIGHT WORKS','VOLCANO PASS','RICE FIELDS','AUTUMN WOODS','SAKURA TEMPLE','SNOW PASS'];
  const OV_CARS = ['COMET','PROTO','GT','TURBO','WEDGE','BIKE','FORMULA','STINGER'];
  // Kept for a future re-enable, but not rendered anywhere right now -- see renderOverRevScorecardHTML.
  const OV_UPGRADE_NAMES = ['TOP SPEED','HANDLING','ACCELERATION','BRAKING'];
  const OV_DIFFICULTY_NAMES = ['EASY','MEDIUM','HARD','ULTRA'];
  // ticks are 60/sec (same NGP-style frame counter overrev/index.html's own ticker formats).
  function formatOvTicks(ticks){
    const seconds = Math.floor(ticks/60);
    return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'.'+String(Math.floor((ticks%60)*100/60)).padStart(2,'0');
  }
  // Only game/initials/rules/course/car/tune/mode/difficulty/transmission/ticks/won/localRecord/
  // event/sequence/raw/source/submittedAt actually get written to the score doc (see overrev/
  // index.html's own submit handler) -- upgrades and the display name/time strings only exist by
  // re-decoding the stored raw QR payload, same as overrev/index.html's own board rendering does.
  function renderOverRevScorecardHTML(data){
    // Upgrade levels (top speed/handling/acceleration/braking) are deliberately not shown --
    // the data's still in data.upgrades/Firestore, just turned off site-wide for now.
    const rows = '<tr><td>Track</td><td class="ov-val">'+escapeHtml(OV_COURSES[data.course]||'?')+'</td></tr>'+
      '<tr><td>Car</td><td class="ov-val">'+escapeHtml(OV_CARS[data.car]||'?')+'</td></tr>'+
      '<tr><td>Difficulty</td><td class="ov-val">'+escapeHtml(OV_DIFFICULTY_NAMES[data.difficulty]||'?')+'</td></tr>'+
      '<tr><td>Transmission</td><td class="ov-val">'+escapeHtml(data.transmission)+'</td></tr>'+
      '<tr><td colspan="2">'+
        (data.won ? '<div class="ov-badge won">FINISHED</div>' : '')+
        (data.localRecord ? '<div class="ov-badge record">LOCAL RECORD</div>' : '')+
      '</td></tr>';
    return '<table class="ov-sheet">'+rows+'</table>';
  }

  // True for a game whose row expands into a click-to-reveal detail (Bowling/Yahtzee/Farkle/
  // 2048/Over Rev); false for Tetris, whose own leaderboard shows lines/level as plain inline
  // meta text instead -- scoreInlineMeta() covers that case.
  function scoreHasDetail(data){
    switch(data.game){
      case 'BW': return Array.isArray(data.rolls) && data.rolls.length>0;
      case 'YZ': return Array.isArray(data.categoryScores) && data.categoryScores.length===YZ_CATS.length;
      case 'FK': return data.resultDisplay !== undefined && data.rounds !== undefined;
      case '2K': return data.moves !== undefined;
      case 'OV':
        // Same "skip rather than crash" stance overrev/index.html's own board rendering takes on
        // a corrupted/legacy stored doc -- OverRevProtocol comes from overrev/protocol.js, which
        // isn't loaded on every page, so this fails closed (no expand affordance) if it's missing.
        if(!data.raw || !window.OverRevProtocol) return false;
        try{ OverRevProtocol.decode(data.raw); return true; }catch(e){ return false; }
      default: return false;
    }
  }
  function scoreDetailHTML(data){
    switch(data.game){
      case 'BW': return renderBowlingScorecardHTML(data.rolls);
      case 'YZ': return renderYahtzeeScorecardHTML(data.categoryScores);
      case 'FK': return renderFarkleScorecardHTML(data);
      case '2K': return render2048ScorecardHTML(data);
      case 'OV':
        try{ return renderOverRevScorecardHTML(Object.assign({}, data, OverRevProtocol.decode(data.raw))); }
        catch(e){ return ''; }
      default: return '';
    }
  }
  function scoreInlineMeta(data){
    if(data.game==='BW'){
      // Matches lb/index.html's own leaderboard row exactly (ball weight is the one extra field
      // Bowling's own board surfaces beyond date, same gap Over Rev's missing track name was).
      return data.weight ? (data.weight+' lb ball') : '';
    }
    if(data.game==='TT'){
      return [data.level!=null?('Lv '+data.level):null, data.lines!=null?(data.lines+' lines'):null]
        .filter(Boolean).join(' · ');
    }
    if(data.game==='OV'){
      // Unlike the fuller detail view, this doesn't need OverRevProtocol -- course is one of the
      // fields written directly to the score doc (see renderOverRevScorecardHTML's comment above).
      return data.course!=null ? (OV_COURSES[data.course]||'') : '';
    }
    return '';
  }
  // The one place besides scoreHasDetail/scoreDetailHTML a page needs to special-case Over Rev:
  // its score doc has no `score` field at all (ticks/course instead -- see index.html's own
  // recent-activity ticker, which hit this same gap first). Farkle has a `score` field, but its
  // own leaderboard (farkle/index.html) ranks and headlines `rounds` instead -- shown here too,
  // so a Farkle run's "main" number matches what its own board actually shows for it.
  function scoreValueDisplay(data){
    if(data.game === 'OV') return data.ticks!=null ? formatOvTicks(data.ticks) : '-';
    if(data.game === 'FK') return data.rounds!=null ? (data.rounds+' rounds') : '-';
    return data.score!=null ? data.score : '-';
  }

  // ---- current-user state, kept live for any page's own inline script to read synchronously
  // (e.g. "attach my username to this score doc, if I happen to be signed in right now") ----
  let currentUser = null;
  const listeners = [];
  async function loadProfile(uid){
    let data = {};
    try{
      const snap = await db.collection('users').doc(uid).get();
      if(snap.exists) data = snap.data();
    }catch(e){ /* leave defaults -- bar shows a generic signed-in state */ }
    // recoveryEmail no longer lives on this doc (see firestore.rules) -- a separate read against
    // the caller's own private/contact subdoc, which only they (or the admin) can read.
    const recoveryEmail = await fetchOwnRecoveryEmail();
    currentUser = {
      uid,
      username: data.username || null,
      usernameLower: data.usernameLower || null,
      recoveryEmail,
      avatar: Array.isArray(data.avatar) ? data.avatar : null,
      // Accounts created before this field existed have no `approved` key at all -- treat that
      // as approved (grandfathered in), same stance the one-time backfill script takes so a
      // pre-existing player's history doesn't vanish from the boards.
      approved: data.approved === undefined ? true : !!data.approved,
    };
    listeners.forEach(cb=>cb(currentUser));
  }
  // Resolves once currentUser has settled after page load (signed-out, or signed-in AND its
  // profile/username fetched) -- auth.onAuthStateChanged() resolving the persisted session and
  // loadProfile()'s own Firestore read are both async, so a caller that reads `currentUser`
  // synchronously right after page load (e.g. a QR-scan deep link that opens straight into a
  // submit button) can race both of them and see a signed-out-looking null even though the user
  // IS signed in -- every game page's submit handler awaits this first specifically to avoid
  // silently submitting a signed-in user's score without their uid/username.
  let markAuthReady;
  const authReady = new Promise(resolve=>{ markAuthReady = resolve; });
  auth.onAuthStateChanged((user)=>{
    if(!user){
      currentUser = null;
      listeners.forEach(cb=>cb(null));
      markAuthReady();
      return;
    }
    loadProfile(user.uid).then(markAuthReady);
  });
  function onAuthChange(cb){ listeners.push(cb); if(currentUser!==undefined) cb(currentUser); }
  // Firestore profile changes (username/email/avatar) don't re-fire onAuthStateChanged -- that
  // only fires on actual sign-in/out. Call this after any updateX() so the account bar and
  // currentUser reflect the change immediately instead of waiting for a page reload.
  function refreshProfile(){
    const user = auth.currentUser;
    return user ? loadProfile(user.uid) : Promise.resolve();
  }

  // ---- injected UI: account bar (top of #shell) + sign-in/up modal (document.body) ----
  const STYLE = `
    #acct-bar{ display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:var(--dim); margin-bottom:14px; }
    #acct-right{ display:flex; align-items:center; gap:8px; }
    #acct-avatar{ border-radius:3px; border:1px solid var(--border); display:block; image-rendering:pixelated; }
    .acct-link{ background:none; border:none; color:var(--accent2); font:inherit; font-size:12px; cursor:pointer; padding:0; text-decoration:underline; width:auto; }
    #auth-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:20px; z-index:1000; }
    #auth-overlay[hidden]{ display:none; }
    #auth-modal{ background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:22px; width:100%; max-width:340px; position:relative; }
    #auth-close{ position:absolute; top:10px; right:12px; background:none; border:none; color:var(--dim); font-size:20px; cursor:pointer; width:auto; padding:0; line-height:1; }
    #auth-tabs{ display:flex; gap:6px; margin-bottom:16px; }
    .auth-tab{ flex:1; background:transparent; border:1px solid var(--border); color:var(--dim); border-radius:8px; padding:8px; font-size:12.5px; cursor:pointer; font-weight:600; font-family:inherit; }
    .auth-tab.active{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
    #auth-form label{ display:block; font-size:11.5px; color:var(--dim); margin-bottom:12px; }
    #auth-form label[hidden]{ display:none; }
    #auth-form input{
      display:block; width:100%; margin-top:4px; background:var(--navy); border:1px solid var(--border);
      color:var(--cream); border-radius:7px; padding:9px 10px; font:inherit; font-size:13px; box-sizing:border-box;
    }
    #auth-form input:focus{ outline:none; border-color:var(--accent2); }
  `;

  const MODAL_HTML = `
    <div id="auth-overlay" hidden>
      <div id="auth-modal">
        <button type="button" id="auth-close" aria-label="Close">&times;</button>
        <div id="auth-tabs">
          <button type="button" class="auth-tab active" data-mode="signin">Sign In</button>
          <button type="button" class="auth-tab" data-mode="signup">Sign Up</button>
        </div>
        <form id="auth-form">
          <label>Username<input id="auth-username" autocomplete="username" required maxlength="16"></label>
          <label>Password<input id="auth-password" type="password" autocomplete="current-password" required minlength="6"></label>
          <label id="auth-email-label" hidden>Recovery email (optional)<input id="auth-email" type="email" autocomplete="email"></label>
          <button type="submit" class="btn-primary" id="auth-submit">Sign In</button>
          <div id="auth-msg"></div>
        </form>
      </div>
    </div>
  `;

  function injectStyle(){
    const tag = document.createElement('style');
    tag.textContent = STYLE;
    document.head.appendChild(tag);
  }

  function injectModal(){
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    const overlay = document.getElementById('auth-overlay');
    const form = document.getElementById('auth-form');
    const tabs = Array.from(document.querySelectorAll('.auth-tab'));
    const emailLabel = document.getElementById('auth-email-label');
    const submitBtn = document.getElementById('auth-submit');
    const msg = document.getElementById('auth-msg');
    let mode = 'signin';

    function setMode(m){
      mode = m;
      tabs.forEach(t=>t.classList.toggle('active', t.dataset.mode===m));
      emailLabel.hidden = (m !== 'signup');
      submitBtn.textContent = m==='signup' ? 'Sign Up' : 'Sign In';
      msg.innerHTML = '';
    }
    tabs.forEach(t=>t.addEventListener('click', ()=>setMode(t.dataset.mode)));

    function openModal(initialMode){
      setMode(initialMode || 'signin');
      form.reset();
      overlay.hidden = false;
      document.getElementById('auth-username').focus();
    }
    function closeModal(){ overlay.hidden = true; }
    document.getElementById('auth-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); });

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const username = document.getElementById('auth-username').value;
      const password = document.getElementById('auth-password').value;
      const email = document.getElementById('auth-email').value;
      submitBtn.disabled = true;
      msg.innerHTML = '';
      try{
        if(mode==='signup'){
          await signUp(username, password, email);
        } else {
          await signIn(username, password);
        }
        closeModal();
      }catch(err){
        msg.innerHTML = '<div class="msg err">'+escapeHtml(friendlyAuthError(err))+'</div>';
      }finally{
        submitBtn.disabled = false;
      }
    });

    return { openModal };
  }

  function injectAccountBar(modal){
    const shell = document.getElementById('shell');
    if(!shell) return;
    const bar = document.createElement('div');
    bar.id = 'acct-bar';
    // Every page that loads this file gets the same top bar, so a "back to all games" link
    // belongs here too rather than duplicated per game page -- just skip it on the landing page
    // itself, where it'd point at the page you're already on.
    const isHome = location.pathname === '/' || location.pathname === '/index.html';
    const homeLink = isHome ? '' : '<a class="acct-link" href="/">&larr; All games</a>';
    bar.innerHTML = '<div id="acct-left">'+homeLink+'</div>'
      + '<div id="acct-right"><canvas id="acct-avatar" width="18" height="18" hidden></canvas>'
      + '<a id="acct-status" class="acct-link">Signed out</a>'
      + '<button type="button" class="acct-link" id="acct-btn">Sign In / Sign Up</button></div>';
    shell.insertBefore(bar, shell.firstChild);
    const statusEl = bar.querySelector('#acct-status');
    const btnEl = bar.querySelector('#acct-btn');
    const avatarEl = bar.querySelector('#acct-avatar');
    let signedIn = false;
    btnEl.addEventListener('click', ()=>{
      if(signedIn) signOutNow();
      else modal.openModal('signin');
    });
    onAuthChange((user)=>{
      signedIn = !!user;
      if(user){
        // Stored username keeps whatever case the person typed at signup -- always
        // uppercased at display time only, everywhere a username is shown.
        statusEl.textContent = 'Hi, ' + (user.username ? user.username.toUpperCase() : '(loading…)');
        statusEl.href = '/account/';
        btnEl.textContent = 'Sign Out';
        if(user.avatar){
          renderAvatarToCanvas(avatarEl, user.avatar, 18/AVATAR_SIZE);
          avatarEl.hidden = false;
        } else {
          avatarEl.hidden = true;
        }
      } else {
        statusEl.textContent = 'Signed out';
        statusEl.removeAttribute('href');
        btnEl.textContent = 'Sign In / Sign Up';
        avatarEl.hidden = true;
      }
    });
  }

  // Captured by boot() once the modal exists -- boot() itself may run on a deferred
  // DOMContentLoaded, so a page calling openSignInModal() in immediate response to a user action
  // (e.g. "you must sign in to submit") needs a level of indirection rather than a direct
  // reference grabbed before boot() has necessarily run. In practice boot() has always completed
  // by the time any real user interaction fires (DOMContentLoaded is early), so this is a safety
  // net, not a real race.
  let s_modal = null;
  function boot(){
    injectStyle();
    s_modal = injectModal();
    injectAccountBar(s_modal);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot(); // #shell already parsed -- this file's own <script> tag is placed after it on every page
  }

  // Opens the same sign-in/sign-up modal the account bar's own button uses -- for any page that
  // needs to require sign-in before an action (e.g. submitting a score now that anonymous
  // submission has been retired; see each game page's own writeScore()/submit handler).
  function openSignInModal(initialMode){
    if(s_modal) s_modal.openModal(initialMode || 'signin');
  }

  return {
    db, auth,
    signUp, signIn, signOut: signOutNow, onAuthChange, refreshProfile,
    updateUsername, updateRecoveryEmail, updateAvatar, fetchAvatars,
    packColor, unpackColor, css255FromWord, renderAvatarToCanvas, drawAvatarCell,
    TRANSPARENT, isTransparent,
    AVATAR_SIZE, AVATAR_CELLS, USERNAME_RE,
    friendlyAuthError, escapeHtml,
    scoreHasDetail, scoreDetailHTML, scoreInlineMeta, scoreValueDisplay,
    authReady, openSignInModal,
    get currentUser(){ return currentUser; }
  };
})();
