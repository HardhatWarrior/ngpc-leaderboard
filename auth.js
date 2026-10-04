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

  // The site owner's own uid -- ALWAYS an admin, regardless of the `admin` Firestore flag below
  // (which is how the owner grants that same access to somebody else). Previously copy-pasted as
  // a local `ADMIN_UID` const on every game page that needed it (ms/ddmr/hgs/rvng/bk's own
  // access-gate logic, admin/index.html, admin/game/index.html, account/index.html). Centralized
  // here so nothing needs to duplicate the literal ever again.
  const ADMIN_UID = 'L44BFbmiNkhi2vvLdrPUIxkvmfs2';
  // True for the hardcoded site owner OR any account the owner has granted the `admin` flag to
  // (users/{uid}.admin -- see admin/index.html's own promote-admin/demote-admin toggle and
  // firestore.rules' isAdmin(), which this mirrors client-side). `user` here is the enriched
  // profile object onAuthChange()/currentUser hands out, not the raw Firebase Auth user.
  function isSiteAdmin(user){
    return !!user && (user.uid === ADMIN_UID || user.admin === true);
  }
  // True for a site admin (see isSiteAdmin) or this specific game's own assigned developer -- the
  // same "who's allowed behind this game's curtain" check every access-gated leaderboard page
  // already made inline (see ms/index.html's isAuthorizedViewer, for instance). gameData is a
  // games/{slug} doc read (or null/undefined before it's loaded, which just means "not yet", not
  // "not manager").
  function isGameManager(user, gameData){
    return isSiteAdmin(user) || (!!user && !!gameData && user.uid === gameData.developerUid);
  }
  // True for isGameManager() OR an account this game's own developer/admin has listed under
  // games/{slug}.previewTesters (an array of uids, set from admin/game/'s Preview Access panel) --
  // lets another developer see and play a still-'coming-soon' game's leaderboard/play page before
  // it goes live, without granting them the ability to actually edit it. Every access-gated
  // leaderboard/play page's isAuthorizedViewer() should use this, not isGameManager, for the
  // coming-soon check.
  function canPreviewGame(user, gameData){
    return isGameManager(user, gameData)
      || (!!user && !!gameData && Array.isArray(gameData.previewTesters) && gameData.previewTesters.includes(user.uid));
  }

  // ---- admin email notifications -- writes a doc to mail/{id}, which the Firebase "Trigger
  // Email" extension (installed separately from the Firebase Console, requires the Blaze plan)
  // watches and turns into a real email. The recipient is hardcoded here AND in firestore.rules'
  // own mail/{id} match block -- rules re-check it so a client can never redirect a notification
  // to an arbitrary address, this constant alone isn't a security boundary. Fire-and-forget: a
  // failed notification write should never block the signup/submission it's reporting on.
  const ADMIN_NOTIFY_EMAIL = 'support@ngpc-dev.com';
  function notifyAdmin(subject, text){
    try{
      db.collection('mail').add({
        to: [ADMIN_NOTIFY_EMAIL],
        message: { subject, text },
      }).catch(()=>{});
    }catch(e){ /* non-critical */ }
  }

  // Sends to a PLAYER's own recovery email -- unlike notifyAdmin above (fixed admin address),
  // this is admin/index.html's own account-approval notice, so firestore.rules' mail/{id} rule
  // requires the `uid` field here and checks the `to` address against THAT account's own
  // private/contact.recoveryEmail server-side, so even a compromised admin-panel script couldn't
  // redirect this to an arbitrary inbox. Caller's job to only call this when a recovery email
  // actually exists (admin/index.html already has it loaded from its own players table).
  function notifyUser(uid, email, subject, text){
    try{
      db.collection('mail').add({
        to: [email],
        message: { subject, text },
        uid,
      }).catch(()=>{});
    }catch(e){ /* non-critical */ }
  }

  // ---- page-view tracking -- fires once per page load, on every page that loads this file
  // (every game leaderboard, the homepage, account/admin/user pages, everything). Two docs per
  // view: pageViews/{pathKey} holds a running total for the "top pages" list, pageViewsDaily/
  // {pathKey_YYYYMMDD} holds one day's count so admin/index.html's Site Stats panel can total
  // "today" and "last 7 days" without reading every view doc ever written. Both are plain
  // FieldValue.increment() writes -- see firestore.rules' pageViews/pageViewsDaily match blocks,
  // which only allow a create at exactly 1 or an update that increments by exactly 1, nothing else.
  function pathKeyFromLocation(){
    const raw = (location.pathname || '/').replace(/^\/+|\/+$/g, '');
    return (raw ? raw.replace(/\//g, '_') : 'home').toLowerCase();
  }
  function dateKeyFromDate(d){
    return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  }
  function trackPageView(){
    try{
      const pathKey = pathKeyFromLocation();
      const dateKey = dateKeyFromDate(new Date());
      const inc = firebase.firestore.FieldValue.increment(1);
      db.collection('pageViews').doc(pathKey).set(
        { path: pathKey, total: inc, lastViewedAt: Date.now() }, { merge: true }
      ).catch(()=>{}); // non-critical -- a blocked/offline write should never affect the page itself
      db.collection('pageViewsDaily').doc(pathKey+'_'+dateKey).set(
        { path: pathKey, date: dateKey, count: inc }, { merge: true }
      ).catch(()=>{});
    }catch(e){ /* non-critical */ }
  }
  trackPageView();

  // Bumped by each leaderboard page's own rom-link click handler -- see firestore.rules' games/
  // {slug} allow update, which carves out a public, anonymous +1-only exception for exactly this
  // field, same shape as pageViews above. Colocated on the game doc itself (not a separate
  // collection) so admin/game/index.html can show it right alongside everything else about that
  // game with no extra read.
  function trackRomDownload(slug){
    try{
      db.collection('games').doc(slug).set(
        { romDownloads: firebase.firestore.FieldValue.increment(1) }, { merge: true }
      ).catch(()=>{}); // non-critical -- a blocked/offline write should never affect the download itself
    }catch(e){ /* non-critical */ }
  }

  const EMAIL_DOMAIN = 'users.ngpc-dev.com';
  const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

  function usernameToEmail(usernameLower){
    return usernameLower + '@' + EMAIL_DOMAIN;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function signUp(usernameRaw, password, recoveryEmailRaw, wantsDev){
    const username = (usernameRaw||'').trim();
    if(!USERNAME_RE.test(username)){
      throw {code:'invalid-username', message:'Usernames are 3-16 characters: letters, numbers, underscore only.'};
    }
    const usernameLower = username.toLowerCase();
    // A developer needs a real way for the admin to reach them (game approval, payload
    // questions, etc.) -- checked here too, not just via the modal's own `required` attribute on
    // the email field, in case something ever calls signUp() directly.
    if(wantsDev && !(recoveryEmailRaw||'').trim()){
      throw {code:'dev-needs-email', message:'A recovery email is required to sign up as a developer.'};
    }
    const email = usernameToEmail(usernameLower);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    // approved:false always -- an account can sign in and submit scores right away, but stays
    // off the public boards until the admin approves it (see firestore.rules' submitterApproved()
    // on the scores collection). Only isAdmin() can ever flip this bit; a client can't self-approve.
    // wantsDev is just a self-reported "I'd like to submit a game" flag for the admin dashboard --
    // it grants nothing by itself, see firestore.rules' comment on users/{uid}.
    const profile = { username, usernameLower, createdAt: Date.now(), avatar: DEFAULT_AVATAR, approved: false, wantsDev: !!wantsDev };
    const recoveryEmail = (recoveryEmailRaw||'').trim();
    try{
      // One atomic batch, not a transaction -- there's no read to make a decision from here, the
      // uniqueness guarantee comes entirely from the security rules (a usernames/{uname} doc can
      // only ever be CREATEd, never updated, so a second claim on the same username is evaluated
      // as a denied update, which fails this whole batch and leaves nothing partially written).
      // recoveryEmail does NOT belong on this profile doc -- firestore.rules only ever allows it
      // on the separate private/contact subdoc (see updateRecoveryEmail below). Putting it here
      // used to add an extra key hasOnly() rejects, failing the WHOLE batch with permission-denied
      // whenever a signup included a recovery email -- which then got mislabeled below as
      // "username already taken" for every username the person tried, since that's the only case
      // this catch block ever checked for. Confirmed the actual cause in production via a user's
      // own console: no rules or network issue, just this extra field.
      const batch = db.batch();
      batch.set(db.collection('usernames').doc(usernameLower), {uid});
      batch.set(db.collection('users').doc(uid), profile);
      if(recoveryEmail) batch.set(db.collection('users').doc(uid).collection('private').doc('contact'), {recoveryEmail});
      await batch.commit();
    }catch(e){
      // The auth account exists at this point even though the profile/reservation didn't get
      // written -- delete it rather than leave an orphan with no username pointing at it (which
      // would be permanently unreachable, since sign-in only ever looks accounts up by username).
      try{ await cred.user.delete(); }catch(_e){ /* best effort */ }
      if(e && e.code === 'permission-denied'){
        // Don't assume permission-denied means the username was taken -- that was wrong once
        // already (an extra disallowed field on this same batch produced the exact same error
        // code and got mislabeled this way for every username a real user tried). Check the
        // actual reservation doc first; usernames/{lower} is publicly readable, so this is safe
        // even though the signup itself just failed.
        let actuallyTaken = false;
        try{
          const nameDoc = await db.collection('usernames').doc(usernameLower).get();
          actuallyTaken = nameDoc.exists;
        }catch(_e){ /* if even this read fails, fall through to the generic message below */ }
        if(actuallyTaken){
          throw {code:'username-taken', message:'That username is already taken.'};
        }
        throw {code:'signup-rejected', message:'Couldn’t create your account (rejected by the site’s access rules) — try again in a moment.'};
      }
      throw e;
    }
    notifyAdmin(
      'New NGPC High Scores signup: ' + username,
      'Username: ' + username + '\nSigned up: ' + new Date().toLocaleString()
        + (recoveryEmail ? '\nRecovery email: ' + recoveryEmail : '')
        + (wantsDev ? '\nChecked "I\'d like to submit a game" at signup.' : '')
        + '\n\nApprove at https://ngpc-dev.com/admin/'
    );
    return cred.user;
  }

  function signIn(usernameRaw, password){
    const email = usernameToEmail((usernameRaw||'').trim().toLowerCase());
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signOutNow(){ return auth.signOut(); }

  // ---- password reset (see functions/index.js's handlePasswordResetRequest/confirmPasswordReset
  // for the privileged server-side half of this flow) ----
  //
  // Deliberately resolves the same way whether or not the username exists, has a recovery email,
  // or is currently throttled -- usernames/{lower} is public-read either way (a determined visitor
  // could already probe existence through it directly), but this function itself never reveals
  // anything: the caller sees one generic "check your email" message regardless, same shape as any
  // reputable "forgot password" flow's own anti-enumeration behavior.
  async function requestPasswordReset(usernameRaw){
    const usernameLower = (usernameRaw||'').trim().toLowerCase();
    if(!usernameLower) return;
    try{
      const reservationDoc = await db.collection('usernames').doc(usernameLower).get();
      if(!reservationDoc.exists) return;
      await db.collection('passwordResetRequests').add({
        uid: reservationDoc.data().uid,
        requestedAt: Date.now(),
      });
    }catch(e){ /* swallow -- see comment above, this never surfaces a distinguishable error */ }
  }

  // ---- profile updates (account page) ----

  // Usernames are permanent: every score a player submits is listed under theirs, and sign-in maps
  // it to the account's synthetic Auth email (a client-side rename never updated that email, so a
  // renamed player could only sign in with the OLD name). firestore.rules now forbids changing
  // users/{uid}.username or releasing a usernames/{name} reservation; an admin fixes a typo or a bad
  // name with NGPC-Admin-Scripts/rename-user.js, which also moves the Auth email and rewrites every
  // score. Kept (and exported) so any stale caller gets a clear message instead of a crash.
  async function updateUsername(){
    throw {code:'rename-disabled', message:'Usernames can\u2019t be changed. If yours needs fixing, email support@ngpc-dev.com.'};
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

  // ---- default initials: a 1-3 char tag for places that can't show a full free-typed name (e.g.
  // Over Rev's 1-8 char names on a board built for 3 initials). Stored on the public profile as
  // users/{uid}.defaultInitials ONLY when the player overrides it; otherwise it's generated from
  // their username here (no write needed). Generation: split the username into words on '_',
  // digits and camelCase humps and take the first letters (up to 3); if that gives fewer than 3,
  // top up from the first word's letters (preferring consonants). A run-together name like
  // "hardhatwarrior" has no word boundaries to find, so it can't come out as HHW -- players can
  // override it on the account page.
  function generateInitials(username){
    const name = String(username||'').trim();
    if(!name) return '???';
    const words = name.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[^A-Za-z]+/).filter(Boolean);
    let out = words.slice(0,3).map(w=>w[0].toUpperCase()).join('');
    if(out.length < 3 && words.length){
      const rest = words[0].slice(1).toUpperCase().split('');
      const consonants = rest.filter(c=>!'AEIOU'.includes(c));
      const fill = consonants.concat(rest.filter(c=>'AEIOU'.includes(c)));
      out = (out + fill.join('')).slice(0,3);
    }
    return out || name.slice(0,3).toUpperCase();
  }
  const INITIALS_RE = /^[A-Za-z0-9]{1,3}$/;
  async function updateDefaultInitials(raw){
    const user = auth.currentUser;
    if(!user) throw {code:'not-signed-in', message:'Sign in first.'};
    const v = String(raw||'').trim().toUpperCase();
    if(v && !INITIALS_RE.test(v)) throw {code:'invalid-initials', message:'Initials are 1-3 letters or numbers.'};
    await db.collection('users').doc(user.uid).update({defaultInitials: v ? v : firebase.firestore.FieldValue.delete()});
  }
  // uid -> effective initials, filled as a side effect of fetchAvatars() (same users/ docs, so no
  // extra reads) -- a board that has already called fetchAvatars() can read these synchronously.
  const initialsCache = {};
  function defaultInitialsOf(uid, usernameFallback){
    return initialsCache[uid] || generateInitials(usernameFallback);
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
          initialsCache[doc.id] = (typeof d.defaultInitials==='string' && d.defaultInitials) ? d.defaultInitials : generateInitials(d.username);
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
    // Each cell's pixel bounds are rounded independently (x*cellPx and (x+1)*cellPx, not
    // width=round(cellPx)) so every column/row gets a size derived from cumulative rounding --
    // this is what keeps a non-integer cellPx (e.g. the leaderboard row chip's 48/32 = 1.5px)
    // symmetric. Drawing at native 1:1 and upscaling via drawImage() looked crisp (no fillRect
    // anti-aliasing) but let the browser's own non-integer nearest-neighbor blit decide which
    // source pixels get duplicated -- that decision isn't guaranteed symmetric across a row/
    // column, and at 1.5x it visibly skewed silhouettes (an avatar edited square came out
    // lopsided on the leaderboard). Filling rects directly at rounded bounds avoids both
    // problems at once: pixel-aligned edges stay crisp, and the scale-up is deterministic.
    for(let y=0;y<size;y++){
      const y0 = Math.round(y*cellPx), y1 = Math.round((y+1)*cellPx);
      for(let x=0;x<size;x++){
        const word = packedWords[y*size+x];
        if(isTransparent(word)) continue;
        const x0 = Math.round(x*cellPx), x1 = Math.round((x+1)*cellPx);
        ctx.fillStyle = css255FromWord(word);
        ctx.fillRect(x0, y0, x1-x0, y1-y0);
      }
    }
  }

  function friendlyAuthError(e){
    const code = e && e.code;
    switch(code){
      case 'invalid-username': return e.message;
      case 'username-taken': return e.message;
      case 'signup-rejected': return e.message;
      case 'dev-needs-email': return e.message;
      case 'same-username': return e.message;
      case 'rename-disabled': return e.message;
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
  // turn mirrors overrev-leaderboard-kit/catalog.json (rules revision 1, 2026-10-03 release: 16 courses, 9 cars).
  const OV_COURSES = ['CYPRESS LANE','CITY CIRCUIT','CANYON RUN','COAST ROAD','NIGHT WORKS','VOLCANO PASS','RICE FIELDS','AUTUMN WOODS','SAKURA TEMPLE','SNOW PASS','SUNSET MESA','AURORA RIDGE','HARBOR DOCKS','SALT FLATS','DAM CREST','TRANQUILITY'];
  const OV_CARS = ['COMET','PROTO','GT','TURBO','WEDGE','BIKE','FORMULA','STINGER','HORNET'];
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
    // Upgrade levels (0-3 each) come from the decoded payload, or are unpacked from the stored `tune`
    // byte (four 2-bit levels) when a doc hasn't been re-decoded -- per the kit, they're shown.
    const ups = Array.isArray(data.upgrades) ? data.upgrades : [0,2,4,6].map(sh=>((data.tune||0)>>sh)&3);
    const rows = '<tr><td>Track</td><td class="ov-val">'+escapeHtml(OV_COURSES[data.course]||'?')+'</td></tr>'+
      '<tr><td>Car</td><td class="ov-val">'+escapeHtml(OV_CARS[data.car]||'?')+'</td></tr>'+
      '<tr><td>Difficulty</td><td class="ov-val">'+escapeHtml(OV_DIFFICULTY_NAMES[data.difficulty]||'?')+'</td></tr>'+
      '<tr><td>Transmission</td><td class="ov-val">'+escapeHtml(data.transmission)+'</td></tr>'+
      OV_UPGRADE_NAMES.map((n,i)=>'<tr><td>'+n+'</td><td class="ov-val">'+ups[i]+' / 3</td></tr>').join('')+
      '<tr><td colspan="2">'+
        (data.won ? '<div class="ov-badge won">FINISHED</div>' : '')+
        (data.localRecord ? '<div class="ov-badge record">LOCAL RECORD</div>' : '')+
      '</td></tr>';
    return '<table class="ov-sheet">'+rows+'</table>';
  }

  // Sudoku's own difficulty names (see sd/index.html's DIFF_NAMES) -- duplicated here rather than
  // imported since every other game's small lookup tables (OV_COURSES etc.) follow the same
  // each-page-keeps-its-own-copy convention.
  const SD_DIFF_NAMES = {E:'Easy', M:'Medium', H:'Hard'};
  function formatSdTime(seconds){
    const m = Math.floor(seconds/60), s = seconds%60;
    return m + ':' + String(s).padStart(2,'0');
  }
  function renderSudokuScorecardHTML(data){
    const rows = '<tr><td>Difficulty</td><td class="sd-val">'+escapeHtml(SD_DIFF_NAMES[data.difficulty]||'?')+'</td></tr>'+
      '<tr><td>Time</td><td class="sd-val tnum">'+formatSdTime(data.time)+'</td></tr>'+
      '<tr><td>Mistakes</td><td class="sd-val tnum">'+data.misses+'</td></tr>'+
      (data.seed!=null ? '<tr><td>Seed</td><td class="sd-val tnum">'+data.seed+'</td></tr>' : '');
    return '<table class="sd-sheet">'+rows+'</table>';
  }

  // Xenon 2's own detail fields -- money/checkpoint/livesLeft, same shape xn/index.html's own
  // renderXenon2ScorecardHTML uses (duplicated per the same each-page-keeps-its-own-copy
  // convention as every other game's table renderer here).
  function renderXenon2ScorecardHTML(data){
    const rows = '<tr><td>Money</td><td class="xn-val tnum">'+data.money+'</td></tr>'+
      '<tr><td>Checkpoint</td><td class="xn-val tnum">'+data.checkpoint+' / 7</td></tr>'+
      '<tr><td>Lives left</td><td class="xn-val tnum">'+data.livesLeft+(data.livesLeft>0?' <span class="completion-badge">&#10003; Completed</span>':'')+'</td></tr>';
    return '<table class="xn-sheet">'+rows+'</table>';
  }

  // Mirrors fu/index.html's own renderScorecardHTML exactly (duplicated per the same
  // each-page-keeps-its-own-copy convention every other game's table renderer here follows).
  // totalScore is the console's own final pre-computed value, printed as-is -- see that page's
  // comment on why it's never recomputed from the other fields here either.
  function renderFurryScorecardHTML(data){
    const rows = '<tr><td>Start World</td><td class="fu-val tnum">'+data.startWorld+'</td></tr>'+
      '<tr><td>Level Reached</td><td class="fu-val tnum">'+data.levelReached+'</td></tr>'+
      '<tr><td>Game Completed</td><td class="fu-val tnum">'+data.gameCompleted+'</td></tr>'+
      '<tr><td>Play Time In Seconds</td><td class="fu-val tnum">'+data.playTimeInSeconds+'</td></tr>'+
      '<tr><td>Gems Collected (Total)</td><td class="fu-val tnum">'+data.gemsCollectedTotal+'</td></tr>'+
      '<tr><td>Total Deaths</td><td class="fu-val tnum">'+data.totalDeaths+'</td></tr>'+
      '<tr><td>Lives Left</td><td class="fu-val tnum">'+data.livesLeft+'</td></tr>'+
      '<tr><td>Enemies Shot</td><td class="fu-val tnum">'+data.enemiesShot+'</td></tr>'+
      '<tr><td>Bombs That Exploded On Furry</td><td class="fu-val tnum">'+data.bombsThatExplodedOnFurry+'</td></tr>'+
      '<tr><td>Deaths By Enemies</td><td class="fu-val tnum">'+data.deathsByEnemies+'</td></tr>'+
      '<tr><td>Deaths By Bombs</td><td class="fu-val tnum">'+data.deathsByBombs+'</td></tr>'+
      '<tr><td>Deaths By Spikes</td><td class="fu-val tnum">'+data.deathsBySpikes+'</td></tr>'+
      '<tr><td>Deaths By Lava And Acid</td><td class="fu-val tnum">'+data.deathsByLavaAndAcid+'</td></tr>'+
      '<tr><td>Deaths By Piranhas</td><td class="fu-val tnum">'+data.deathsByPiranhas+'</td></tr>'+
      '<tr><td>Deaths By Falling Into The Abyss</td><td class="fu-val tnum">'+data.deathsByFallingIntoTheAbyss+'</td></tr>'+
      '<tr><td>Total Score</td><td class="fu-val tnum">'+data.totalScore+'</td></tr>';
    return '<table class="fu-sheet">'+rows+'</table>';
  }

  // Sokoban -- same SK_PAR table, star rule and per-level grid as sk/index.html's own copy (the
  // each-page-keeps-its-own-copy convention). A score doc stores the cartridge's 30-char
  // over-par string (overPar: 0-9A-Z = 0-35 moves over par, 'Z' = 35+, '-' = unsolved) plus
  // formatVersion; stars and the over-par total are recomputed from it here, never trusted from
  // the stored totals. SK_PAR is keyed by formatVersion because pars are tied to the level set.
  const SK_PAR = {
    '1': [2, 11, 37, 31, 45, 67, 25, 26, 21, 40, 63, 56, 56, 35, 65, 59, 73, 68, 112, 137, 133, 92, 65, 118, 161, 174, 195, 192, 127, 302]
  };
  function skSummary(data){
    const pars = SK_PAR[data && data.formatVersion];
    const op = data && data.overPar;
    if(!pars || typeof op !== 'string' || !/^[0-9A-Z-]{30}$/.test(op)) return null;
    const levels = [];
    let stars = 0, overTotal = 0, solved = 0;
    for(let i=0;i<30;i++){
      if(op[i] === '-'){ levels.push({level:i+1, solved:false, stars:0, over:null}); continue; }
      const over = parseInt(op[i], 36);
      // Cartridge stars_for(): 3 at par, 2 within par + clamp(floor(par/4), 4, 30), else 1.
      const st = over === 0 ? 3 : (over <= Math.min(30, Math.max(4, Math.floor(pars[i]/4))) ? 2 : 1);
      solved++; stars += st; overTotal += over;
      levels.push({level:i+1, solved:true, stars:st, over:over});
    }
    return {levels:levels, stars:stars, overTotal:overTotal, solved:solved};
  }
  function formatSkClock(seconds){
    const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60), sec = seconds%60;
    return (h ? h+':'+String(m).padStart(2,'0') : String(m)) + ':' + String(sec).padStart(2,'0');
  }
  // Reuses .scorecard-grid/.sc-frame/.sc-marks/.sc-total and .tk-sheet/.tk-val, which account/
  // and user/ already style, so this needs no new CSS beyond the small .sk-* color touches.
  function renderSokobanScorecardHTML(data){
    const sum = skSummary(data);
    if(!sum) return '';
    const grid = sum.levels.map(function(L){
      const stars = L.stars ? '<span class="sk-stars">'+'\u2605'.repeat(L.stars)+'</span>' : '&ndash;';
      const overTxt = !L.solved ? '' : (L.over === 0 ? 'PAR' : ('+'+(L.over === 35 ? '35+' : L.over)));
      return '<div class="sc-frame'+(L.solved?'':' sk-unsolved')+'">'+
        '<div class="sc-marks">'+L.level+'</div>'+
        '<div class="sc-total">'+stars+(overTxt?'<span class="sk-over">'+overTxt+'</span>':'')+'</div>'+
      '</div>';
    }).join('');
    // Cartridge reward marks: MASTER = all 30 solved, PERFECT = all 90 stars (sk/index.html skBadgeHTML)
    const badge = sum.stars >= 90 ? '<span class="sk-badge perfect">PERFECT</span>'
                : (sum.solved >= 30 ? '<span class="sk-badge master">MASTER</span>' : '');
    const rows = '<tr><td>Levels solved</td><td class="tk-val tnum">'+sum.solved+' / 30</td></tr>'+
      '<tr><td>Stars</td><td class="tk-val tnum">'+sum.stars+' / 90</td></tr>'+
      (badge ? '<tr><td>Award</td><td class="tk-val">'+badge+'</td></tr>' : '')+
      '<tr><td>Moves over par</td><td class="tk-val tnum">+'+sum.overTotal+'</td></tr>'+
      '<tr><td>Total moves</td><td class="tk-val tnum">'+(Number(data.totalMoves)||0)+'</td></tr>'+
      '<tr><td>Total pushes</td><td class="tk-val tnum">'+(Number(data.totalPushes)||0)+'</td></tr>'+
      '<tr><td>Play time</td><td class="tk-val tnum">'+formatSkClock(Number(data.playTime)||0)+'</td></tr>';
    return '<div class="scorecard-grid">'+grid+'</div><table class="tk-sheet">'+rows+'</table>';
  }

  // True for a game whose row expands into a click-to-reveal detail (Bowling/Yahtzee/Farkle/
  // 2048/Over Rev/Sudoku/Xenon 2); false for Tetris, whose own leaderboard shows lines/level as
  // plain inline meta text instead -- scoreInlineMeta() covers that case.
  function scoreHasDetail(data){
    switch(data.game){
      case 'BW': return Array.isArray(data.rolls) && data.rolls.length>0;
      case 'YZ': return Array.isArray(data.categoryScores) && data.categoryScores.length===YZ_CATS.length;
      case 'FK': return data.resultDisplay !== undefined && data.rounds !== undefined;
      case '2K': return data.moves !== undefined;
      case 'SD': return data.difficulty !== undefined && data.time !== undefined;
      case 'XN': return data.money !== undefined && data.checkpoint !== undefined;
      case 'FU': return data.totalScore !== undefined && data.startWorld !== undefined;
      case 'SK': return skSummary(data) !== null;
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
      case 'SD': return renderSudokuScorecardHTML(data);
      case 'XN': return renderXenon2ScorecardHTML(data);
      case 'FU': return renderFurryScorecardHTML(data);
      case 'SK': return renderSokobanScorecardHTML(data);
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
    if(data.game==='SK'){
      // Numbers only -- callers put this into innerHTML unescaped.
      const sum = skSummary(data);
      if(!sum) return '';
      return sum.stars+'/90 stars'+(Number.isFinite(data.totalMoves) ? (' · '+data.totalMoves+' moves') : '');
    }
    return '';
  }
  // The one place besides scoreHasDetail/scoreDetailHTML a page needs to special-case Over Rev:
  // its score doc has no `score` field at all (ticks/course instead -- see index.html's own
  // recent-activity ticker, which hit this same gap first). Farkle has a `score` field, but its
  // own leaderboard (farkle/index.html) ranks and headlines `rounds` instead -- shown here too,
  // so a Farkle run's "main" number matches what its own board actually shows for it. Sudoku and
  // Minesweeper both have no `score` field either -- they rank by `time` (ascending), so that's
  // their headline value; a missed case here is exactly what showed a bare "-" for every Sudoku
  // (and later Minesweeper) row on the account page and homepage ticker before this existed.
  // Furry ranks by `totalScore`, not `score` -- same gap, caught before shipping this time.
  // Sokoban has no `score` either (levels solved + moves over par) -- added up front too.
  function scoreValueDisplay(data){
    if(data.game === 'OV') return data.ticks!=null ? formatOvTicks(data.ticks) : '-';
    if(data.game === 'FK') return data.rounds!=null ? (data.rounds+' rounds') : '-';
    if(data.game === 'SD') return data.time!=null ? formatSdTime(data.time) : '-';
    if(data.game === 'MS') return data.time!=null ? formatSdTime(data.time) : '-';
    if(data.game === 'FU') return data.totalScore!=null ? data.totalScore : '-';
    // Sokoban ranks by stars, then moves over par -- ASCII only (the homepage ticker's
    // Press Start 2P font has no star glyph).
    if(data.game === 'SK'){ const sum = skSummary(data); return sum ? (sum.stars+' STARS') : '-'; }
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
      defaultInitials: (typeof data.defaultInitials === 'string' && data.defaultInitials) ? data.defaultInitials : null,
      // Accounts created before this field existed have no `approved` key at all -- treat that
      // as approved (grandfathered in), same stance the one-time backfill script takes so a
      // pre-existing player's history doesn't vanish from the boards.
      approved: data.approved === undefined ? true : !!data.approved,
      // Admin-granted yes/no, not tied to any specific game -- gates /dev/submit/ (see
      // firestore.rules' gameSubmissions allow create). Defaults false; nobody grants this to
      // themselves.
      isDeveloper: !!data.isDeveloper,
      // Admin-granted yes/no, same trust level as the hardcoded ADMIN_UID below -- see
      // isSiteAdmin(). Defaults false; nobody grants this to themselves (see firestore.rules'
      // users/{uid} allow update, which only lets the OWNER'S OWN branch leave this field
      // untouched, never set it).
      admin: !!data.admin,
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
    #acct-new{ background:var(--danger,#e5615a); color:#fff; font-size:9px; font-weight:700; letter-spacing:.06em; padding:2px 5px; border-radius:999px; text-decoration:none; line-height:1.3; }
    #acct-new[hidden]{ display:none; }
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
    #auth-form label.auth-checkbox-label:not([hidden]){ display:flex; align-items:center; gap:7px; font-size:11.5px; width:100%; box-sizing:border-box; }
    #auth-form label.auth-checkbox-label input{ display:inline; width:auto; margin:0; flex:none; }
    .auth-link-row{ text-align:right; margin:-6px 0 12px; }
    .auth-link-row[hidden]{ display:none; }
    .auth-link-btn{ background:none; border:none; color:var(--accent2); font-size:11.5px; cursor:pointer; padding:0; width:auto; text-decoration:underline; text-underline-offset:2px; font-family:inherit; }
    .auth-link-btn:hover{ color:var(--cream); }
    #auth-forgot-hint{ font-size:11.5px; color:var(--dim); margin:-4px 0 12px; line-height:1.4; }
    #auth-forgot-hint[hidden]{ display:none; }
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
          <p id="auth-forgot-hint" hidden>Enter your username and, if it has a recovery email on file, we'll send a link to reset your password.</p>
          <label>Username<input id="auth-username" autocomplete="username" required maxlength="16"></label>
          <label id="auth-password-label">Password<input id="auth-password" type="password" autocomplete="current-password" required minlength="6"></label>
          <div class="auth-link-row" id="auth-forgot-row"><button type="button" class="auth-link-btn" id="auth-forgot-link">Forgot password?</button></div>
          <div class="auth-link-row" id="auth-back-row" hidden><button type="button" class="auth-link-btn" id="auth-back-link">&larr; Back to sign in</button></div>
          <label id="auth-email-label" hidden><span id="auth-email-label-text">Recovery email (optional)</span><input id="auth-email" type="email" autocomplete="email"></label>
          <label id="auth-dev-label" class="auth-checkbox-label" hidden><input id="auth-wants-dev" type="checkbox"> <span>Developer</span></label>
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
    const devLabel = document.getElementById('auth-dev-label');
    const submitBtn = document.getElementById('auth-submit');
    const msg = document.getElementById('auth-msg');
    const emailInput = document.getElementById('auth-email');
    const emailLabelText = document.getElementById('auth-email-label-text');
    const wantsDevCheckbox = document.getElementById('auth-wants-dev');
    const passwordLabel = document.getElementById('auth-password-label');
    const passwordInput = document.getElementById('auth-password');
    const forgotHint = document.getElementById('auth-forgot-hint');
    const forgotRow = document.getElementById('auth-forgot-row');
    const backRow = document.getElementById('auth-back-row');
    let mode = 'signin';
    let lastNonForgotMode = 'signin';

    // A developer signup needs a real way for the admin to reach them (game approval, payload
    // questions, etc.) -- recovery email is otherwise optional, so this only flips to required
    // once "Developer" is actually checked, not for every signup.
    function updateEmailRequirement(){
      const required = mode === 'signup' && wantsDevCheckbox.checked;
      emailInput.required = required;
      emailLabelText.textContent = required ? 'Recovery email (required for developers)' : 'Recovery email (optional)';
    }
    wantsDevCheckbox.addEventListener('change', updateEmailRequirement);

    function setMode(m){
      mode = m;
      if(m !== 'forgot') lastNonForgotMode = m;
      tabs.forEach(t=>t.classList.toggle('active', t.dataset.mode===m));
      document.getElementById('auth-tabs').hidden = (m === 'forgot');
      emailLabel.hidden = (m !== 'signup');
      devLabel.hidden = (m !== 'signup');
      passwordLabel.hidden = (m === 'forgot');
      passwordInput.required = (m !== 'forgot');
      forgotHint.hidden = (m !== 'forgot');
      forgotRow.hidden = (m !== 'signin');
      backRow.hidden = (m !== 'forgot');
      submitBtn.textContent = m==='signup' ? 'Sign Up' : m==='forgot' ? 'Send Reset Link' : 'Sign In';
      msg.innerHTML = '';
      updateEmailRequirement();
    }
    tabs.forEach(t=>t.addEventListener('click', ()=>setMode(t.dataset.mode)));
    document.getElementById('auth-forgot-link').addEventListener('click', ()=>setMode('forgot'));
    document.getElementById('auth-back-link').addEventListener('click', ()=>setMode(lastNonForgotMode));

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
      const wantsDev = document.getElementById('auth-wants-dev').checked;
      submitBtn.disabled = true;
      msg.innerHTML = '';
      try{
        if(mode==='forgot'){
          await requestPasswordReset(username);
          // Same message whether or not the account/recovery-email actually exists -- see
          // requestPasswordReset's own comment on why this can't reveal that.
          msg.innerHTML = '<div class="msg ok">If that account has a recovery email on file, a reset link is on its way.</div>';
          passwordInput.value = '';
        } else if(mode==='signup'){
          await signUp(username, password, email, wantsDev);
          closeModal();
        } else {
          await signIn(username, password);
          closeModal();
        }
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
      + '<a id="acct-new" href="/admin/" hidden>NEW!</a>'
      + '<a id="acct-status" class="acct-link">Signed out</a>'
      + '<button type="button" class="acct-link" id="acct-btn">Sign In / Sign Up</button></div>';
    shell.insertBefore(bar, shell.firstChild);
    const statusEl = bar.querySelector('#acct-status');
    const btnEl = bar.querySelector('#acct-btn');
    const avatarEl = bar.querySelector('#acct-avatar');
    const newEl = bar.querySelector('#acct-new');
    let signedIn = false;
    // Admins only: flag pending work (players awaiting approval, game submissions awaiting review)
    // so it's visible from any page without opening /admin/. Two small capped reads per page load,
    // both already allowed for an admin (users/ is public; gameSubmissions/ is admin-readable);
    // any failure just leaves the badge hidden.
    async function refreshAdminBadge(user){
      newEl.hidden = true;
      if(!isSiteAdmin(user)) return;
      try{
        const [players, games] = await Promise.all([
          db.collection('users').where('approved','==',false).limit(50).get(),
          db.collection('gameSubmissions').where('status','==','pending').limit(50).get(),
        ]);
        if(!currentUser || currentUser.uid !== user.uid) return; // signed out / switched meanwhile
        const parts = [];
        if(players.size) parts.push(players.size+' player'+(players.size===1?'':'s')+' awaiting approval');
        if(games.size) parts.push(games.size+' game submission'+(games.size===1?'':'s')+' to review');
        if(parts.length){ newEl.title = parts.join(' \u00b7 '); newEl.hidden = false; }
      }catch(e){ /* leave hidden */ }
    }
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
        refreshAdminBadge(user);
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
        newEl.hidden = true;
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
    generateInitials, updateDefaultInitials, defaultInitialsOf,
    packColor, unpackColor, css255FromWord, renderAvatarToCanvas, drawAvatarCell,
    TRANSPARENT, isTransparent,
    AVATAR_SIZE, AVATAR_CELLS, USERNAME_RE,
    friendlyAuthError, escapeHtml, notifyAdmin, notifyUser, trackRomDownload, pathKeyFromLocation,
    scoreHasDetail, scoreDetailHTML, scoreInlineMeta, scoreValueDisplay,
    ADMIN_UID, isSiteAdmin, isGameManager, canPreviewGame, requestPasswordReset,
    authReady, openSignInModal,
    get currentUser(){ return currentUser; }
  };
})();
