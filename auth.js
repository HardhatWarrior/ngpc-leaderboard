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
    const profile = { username, usernameLower, createdAt: Date.now() };
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

  async function updateRecoveryEmail(emailRaw){
    const user = auth.currentUser;
    if(!user) throw {code:'not-signed-in', message:'Sign in first.'};
    const email = (emailRaw||'').trim();
    // Firestore rejects `undefined`, and there's no user-facing way to fully clear a field via
    // .update() with a plain value -- FieldValue.delete() is the documented way to remove one.
    const value = email ? email : firebase.firestore.FieldValue.delete();
    await db.collection('users').doc(user.uid).update({recoveryEmail: value});
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

  // Draws one avatar cell at grid position (gx,gy) -- a flat color, or one of two checker shades
  // (alternating by grid parity, not a sub-cell pattern -- see renderAvatarToCanvas's own comment
  // on why a per-cell flat fill is what stays crisp at any scale) for a transparent one, same idea
  // as the tile editor's own transparency preview, just always on here rather than a toggle.
  function drawAvatarCell(ctx, word, gx, gy, cellPx){
    const x = gx*cellPx, y = gy*cellPx;
    if(isTransparent(word)){
      ctx.fillStyle = ((gx+gy)&1) ? '#454b63' : '#2a2f42';
      ctx.fillRect(x, y, cellPx, cellPx);
    } else {
      ctx.fillStyle = css255FromWord(word);
      ctx.fillRect(x, y, cellPx, cellPx);
    }
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
    currentUser = {
      uid,
      username: data.username || null,
      usernameLower: data.usernameLower || null,
      recoveryEmail: data.recoveryEmail || null,
      avatar: Array.isArray(data.avatar) ? data.avatar : null,
    };
    listeners.forEach(cb=>cb(currentUser));
  }
  auth.onAuthStateChanged((user)=>{
    if(!user){
      currentUser = null;
      listeners.forEach(cb=>cb(null));
      return;
    }
    loadProfile(user.uid);
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

  function boot(){
    injectStyle();
    const modal = injectModal();
    injectAccountBar(modal);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot(); // #shell already parsed -- this file's own <script> tag is placed after it on every page
  }

  return {
    db, auth,
    signUp, signIn, signOut: signOutNow, onAuthChange, refreshProfile,
    updateUsername, updateRecoveryEmail, updateAvatar, fetchAvatars,
    packColor, unpackColor, css255FromWord, renderAvatarToCanvas, drawAvatarCell,
    TRANSPARENT, isTransparent,
    AVATAR_SIZE, AVATAR_CELLS, USERNAME_RE,
    friendlyAuthError, escapeHtml,
    get currentUser(){ return currentUser; }
  };
})();
