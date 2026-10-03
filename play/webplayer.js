/*
 * webplayer.js -- shared logic for every /play/<slug>/ page: sign-in + coming-soon access gate,
 * the public "played N times" counter, ROM resolution (developer-uploaded build from
 * games/{slug}.romPath, falling back to a static repo-committed file), the QR decode stack
 * (zbar-wasm -> BarcodeDetector -> jsQR) and capture-to-leaderboard routing, and mounting
 * whichever backend emulator the game's own developer picked (games/{slug}.emulator, set from
 * admin/game/index.html's own "Web Player" toggle -- 'ngpcraft', or EmulatorJS otherwise/by
 * default). Every /play/<slug>/ page's own markup already converged on the same element ids
 * before this file existed (#play-count, #signin-gate, #player-content, #player-panel,
 * #btn-maximize, #game, #btn-submit, #submit-msg) -- this file assumes them rather than taking
 * them as parameters, so a page's own <script> only ever has to call NGPCWebPlayer.init({...}).
 *
 * The two backends need different UI entirely: EmulatorJS has no built-in capture affordance, so
 * this file drives #btn-maximize/#btn-submit itself (plus a floating fsBtn while maximized, since
 * the real ones are covered) and grabs a cropped frame off EJS_emulator.canvas by hand. The
 * NgpCraft compact embed (<ngpcraft-embed>) has its own built-in maximize and Capture button
 * (relabeled "Submit Score" here) and hands back an already-native-resolution frame -- so for that
 * backend, #btn-maximize/#btn-submit are simply hidden, since the component's own toolbar
 * replaces them.
 */
(function(){
  "use strict";
  function el(id){ return document.getElementById(id); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function lastPathSegment(text){
    const parts = String(text||'').split('/').filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  // Every game's QR encodes its own routing code first -- fetched lazily from the games/
  // collection instead of a hardcoded table (see index.html's own GAME_ROUTES comment), so a new
  // game's routing works the instant its games/{slug} doc exists, no code edit needed here.
  let GAME_ROUTES = null;
  async function getGameRoutes(){
    if(GAME_ROUTES) return GAME_ROUTES;
    const routes = {};
    try{
      if(window.NGPC_AUTH && NGPC_AUTH.db){
        const snap = await NGPC_AUTH.db.collection('games').get();
        snap.forEach(doc=>{ const d = doc.data(); if(d.code) routes[d.code] = doc.id; });
      }
    }catch(e){ /* leave whatever was found -- a partial/empty table just fails routing below */ }
    GAME_ROUTES = routes;
    return routes;
  }

  /* ---------- QR decode stack -- identical to every other page's own scan code (zbar-wasm tried
     first, native BarcodeDetector second, jsQR last); see e.g. /2048/index.html's own comments
     for why. Only the image *source* differs here: a captured emulator frame instead of a live
     camera video or an uploaded photo. ---------- */
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
    }catch(e){ /* fall through */ }
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
      }catch(e){ /* fall through to jsQR */ }
    }
    return jsqrFallback(source, w0, h0, scales);
  }

  // The NGP's native resolution -- both backends' own aspect-ratio boxes are locked to this.
  const NATIVE_ASPECT = 160 / 152;

  function init(opts){
    const slug = opts.slug;
    const title = opts.title;
    const staticRomUrl = opts.staticRomUrl || null;

    const gateEl = el('signin-gate');
    const contentEl = el('player-content');
    const btnSubmit = el('btn-submit');
    const msgEl = el('submit-msg');
    const btnMaximize = el('btn-maximize');
    const playerPanel = el('player-panel');

    // Public "played N times" readout -- off the same pageViews/{pathKey} doc auth.js's own
    // trackPageView() already increments on this page's own load.
    (function(){
      const countEl = el('play-count');
      if(!countEl || !window.NGPC_AUTH || !NGPC_AUTH.db) return;
      NGPC_AUTH.db.collection('pageViews').doc(NGPC_AUTH.pathKeyFromLocation()).get().then(doc=>{
        const total = (doc.exists && doc.data().total) || 0;
        countEl.textContent = 'Played ' + total.toLocaleString() + ' time' + (total===1?'':'s');
      }).catch(()=>{ /* decorative -- leave blank on error */ });
    })();

    let fsBtn = null;
    let isMaximized = false;
    let captureBusy = false;
    let gameData = null;

    function showMsg(cls, text){
      msgEl.innerHTML = '<div class="msg '+cls+'">'+escapeHtml(text)+'</div>';
      // #submit-msg is covered up while maximized (EmulatorJS backend only) -- fsBtn's own label
      // is the only feedback surface visible there, so mirror the same text onto it.
      if(fsBtn) fsBtn.textContent = text.length > 34 ? text.slice(0, 31)+'…' : text;
    }

    function setBusy(busy){
      captureBusy = busy;
      btnSubmit.disabled = busy;
      if(fsBtn) fsBtn.disabled = busy;
    }

    // Decodes whatever frame a backend hands back and routes into the real leaderboard page's
    // own confirm/submit flow -- same hash-payload handoff the main site's QR scan and every
    // leaderboard's own scan already use (see index.html's routeToGame()), so no page here needs
    // its own copy of the Firestore write/auth logic.
    async function decodeAndRoute(canvas){
      if(captureBusy) return;
      setBusy(true);
      showMsg('info', 'Looking for a QR code…');
      try{
        const value = await decodeSource(canvas, canvas.width, canvas.height, [700, 1100, 1500, 2000]);
        if(!value){
          showMsg('err', 'No QR code found on screen — make sure the in-game QR code is fully visible and try again.');
          return;
        }
        const payload = lastPathSegment(value).toUpperCase();
        // Game codes are 2-6 characters -- longest-match against known codes, since there's no
        // delimiter after a variable-length code in the payload itself.
        const routes = await getGameRoutes();
        const sortedCodes = Object.keys(routes).sort((a,b)=>b.length-a.length);
        const code = sortedCodes.find(c=>payload.startsWith(c)) || null;
        const targetSlug = code ? routes[code] : null;
        if(!targetSlug){
          showMsg('err', 'Unrecognized game code — that leaderboard might not be set up yet.');
          return;
        }
        showMsg('ok', 'Found it — opening the leaderboard…');
        // Same "?v=" cache-buster + hash handoff the main page's own scan uses, so the target
        // leaderboard always fetches fresh code and reads the payload back out via its own
        // existing payloadFromEntry(). "src=capture" marks this as an in-browser-player
        // submission (vs a real camera/photo scan) -- read once by the leaderboard page's own
        // SUBMIT_SOURCE before its boot() strips the query string, and stored on the score doc
        // for admin/game/index.html's scan-source breakdown.
        location.href = '/'+targetSlug+'/?v='+Date.now()+'&src=capture#'+payload;
      }catch(e){
        showMsg('err', 'Capture failed: '+escapeHtml(e.message||'unknown error'));
      }finally{
        setBusy(false);
      }
    }

    /* ---------- EmulatorJS backend -- the default/fallback. No built-in capture affordance and
       no maximize that survives iOS Safari/Edge's missing Fullscreen API for non-<video>
       elements, so both are hand-rolled here: #btn-maximize toggles a CSS-only "maximize" (see
       each page's own .maximized rule) instead of the real Fullscreen API, and fsBtn is a
       floating button injected as a *child* of #game so it stays reachable once #btn-submit
       itself is covered by the maximized panel's z-index. ---------- */
    function injectFullscreenButton(){
      const gameEl = el('game');
      if(!gameEl || !gameEl.querySelector('.ejs_canvas_parent')) return false;
      if(fsBtn) return true;
      fsBtn = document.createElement('button');
      fsBtn.type = 'button';
      fsBtn.textContent = 'Submit Score';
      // Position is set dynamically by positionFsBtn() below, right under the actual rendered
      // game canvas -- EJS letterboxes the game's near-square aspect ratio inside the much taller
      // maximized container, so a fixed offset would either sit on top of the game (too small) or
      // float in empty space above the touch controls (too big), depending on the device.
      fsBtn.style.cssText = 'display:none; position:absolute; z-index:2147483647;'
        + 'font:600 13.5px "IBM Plex Sans",system-ui,sans-serif; padding:10px 16px; border:none;'
        + 'border-radius:8px; cursor:pointer; background:var(--accent); color:var(--accent-ink);'
        + 'box-shadow:0 2px 10px rgba(0,0,0,.5); white-space:nowrap;';
      gameEl.appendChild(fsBtn);
      fsBtn.addEventListener('click', captureFromEmulatorJS);
      return true;
    }

    // Measures EJS's own letterboxed canvas (not #game, which is the full maximized container)
    // and places fsBtn just below it, horizontally centered under it.
    function positionFsBtn(){
      if(!fsBtn) return;
      const gameEl = el('game');
      if(!gameEl) return;
      const gameRect = gameEl.getBoundingClientRect();
      if(!gameRect.width || !gameRect.height) return; // not actually rendered yet
      const visibleHeight = Math.min(gameRect.height, gameRect.width / NATIVE_ASPECT);
      const visibleWidth = visibleHeight * NATIVE_ASPECT;
      const offsetX = (gameRect.width - visibleWidth) / 2;
      fsBtn.style.top = (visibleHeight + 12) + 'px';
      fsBtn.style.left = (offsetX + visibleWidth / 2) + 'px';
      fsBtn.style.right = 'auto';
      fsBtn.style.transform = 'translateX(-50%)';
    }

    function setMaximized(on){
      isMaximized = on;
      playerPanel.classList.toggle('maximized', on);
      document.documentElement.classList.toggle('maximizing', on);
      btnMaximize.innerHTML = on ? '&times;' : '&#10530;';
      btnMaximize.title = on ? 'Exit full screen' : 'Full screen';
      if(fsBtn) fsBtn.style.display = on ? 'block' : 'none';
      btnSubmit.style.display = on ? 'none' : '';
      msgEl.style.display = on ? 'none' : '';
      // EmulatorJS only recalculates its own canvas size on a real `window` resize event -- our
      // CSS class toggle doesn't fire one, so nudge it directly once the new layout has settled.
      if(window.EJS_emulator && typeof EJS_emulator.handleResize === 'function'){
        requestAnimationFrame(()=>{
          EJS_emulator.handleResize();
          requestAnimationFrame(positionFsBtn);
        });
      } else if(on){
        requestAnimationFrame(positionFsBtn);
      }
    }

    function grabEmulatorJSFrame(){
      const canvas = window.EJS_emulator && EJS_emulator.canvas;
      if(!canvas || !canvas.width || !canvas.height) return Promise.resolve(null);
      return new Promise(resolve=>{
        // A synchronous drawImage() from a click handler doesn't work: the canvas is WebGL-backed
        // without preserveDrawingBuffer, so its drawing buffer has already been cleared by the
        // time a click handler runs; deferring one frame via requestAnimationFrame (the same
        // trick EmulatorJS's own internal screenshot code uses) avoids that.
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

    async function captureFromEmulatorJS(){
      if(captureBusy) return;
      if(!window.EJS_emulator || !EJS_emulator.canvas){
        showMsg('err', 'The game isn’t ready yet — make sure it’s running, then try again.');
        return;
      }
      const frame = await grabEmulatorJSFrame();
      if(!frame){
        showMsg('err', 'Capture failed: screenshot was empty');
        return;
      }
      decodeAndRoute(frame);
    }

    function mountEmulatorJS(gameUrl){
      window.EJS_player = '#game';
      window.EJS_gameUrl = gameUrl;
      window.EJS_pathtodata = '../emulatorjs/data/';
      window.EJS_core = 'ngp';
      const loaderScript = document.createElement('script');
      loaderScript.src = '../emulatorjs/data/loader.js';
      document.body.appendChild(loaderScript);
      const pollId = setInterval(()=>{ if(injectFullscreenButton()) clearInterval(pollId); }, 300);
      setTimeout(()=>clearInterval(pollId), 30000); // give up quietly if EJS never finishes booting
      btnMaximize.addEventListener('click', ()=>setMaximized(!isMaximized));
      document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && isMaximized) setMaximized(false); });
      window.addEventListener('resize', ()=>{ if(isMaximized) positionFsBtn(); });
      btnSubmit.addEventListener('click', captureFromEmulatorJS);
    }

    /* ---------- NgpCraft backend -- github.com/Tixul/NgpCraft_web_emulator. Its own compact
       <ngpcraft-embed> component has a built-in maximize (CSS-only, self-contained) and Capture
       button (relabeled "Submit Score" via capture-label, set before the element connects to the
       DOM -- INTEGRATION.md is explicit that has to happen pre-connection), so this page's own
       #btn-maximize/#btn-submit are redundant and stay hidden. captureFrame() already returns the
       exact native 160x152 visible area, no letterbox math needed. ---------- */
    async function mountNgpCraft(gameUrl){
      btnMaximize.hidden = true;
      btnSubmit.hidden = true;
      await import('/ngpc/integrated.js');
      const player = document.createElement('ngpcraft-embed');
      player.setAttribute('rom', gameUrl);
      player.setAttribute('game-title', title);
      player.setAttribute('capture-label', 'Submit Score');
      player.addEventListener('ngpc-capture', (event)=>{
        event.preventDefault(); // suppress the component's own default PNG-download behavior
        decodeAndRoute(event.detail.canvas);
      });
      el('game').appendChild(player);
    }

    // The player (and its cores) load once the viewer is allowed to see this game at all -- sign-in
    // is no longer required just to play.
    let emulatorRequested = false;
    async function loadEmulator(){
      if(emulatorRequested) return;
      emulatorRequested = true;
      // Prefer a developer-uploaded build (games/{slug}.romPath, set from /admin/game/) over the
      // static repo-committed ROM -- falls back to the static file on any lookup failure. A few
      // submitted (not repo-committed) games have no static fallback at all (staticRomUrl null).
      const gameUrl = (gameData && gameData.romPath) || staticRomUrl;
      if(!gameUrl){
        contentEl.innerHTML = '<div class="msg err">No ROM is available to play right now.</div>';
        return;
      }
      if(gameData && gameData.emulator === 'ngpcraft'){
        mountNgpCraft(gameUrl);
      } else {
        mountEmulatorJS(gameUrl);
      }
    }

    // Same access-gate concept as the leaderboard page (bk/index.html's own access-gate comment)
    // -- while this game is devStatus 'coming-soon', only the site admin or its own assigned
    // developer gets the real player; everyone else (signed in or not) sees a "not public yet"
    // message instead of the sign-in prompt. gameData is fetched once, reused both for this and
    // for ROM resolution above, instead of two separate reads of the same doc.
    const gameDocPromise = (window.NGPC_AUTH && NGPC_AUTH.db)
      ? NGPC_AUTH.db.collection('games').doc(slug).get()
          .then(doc=>{ gameData = doc.exists ? doc.data() : {}; })
          .catch(()=>{ gameData = {}; })
      : Promise.resolve();

    function isAuthorizedViewer(user){
      if(!gameData || gameData.devStatus !== 'coming-soon') return true;
      return NGPC_AUTH.canPreviewGame(user, gameData);
    }
    function applyAuthState(user){
      gameDocPromise.then(()=>{
        if(!isAuthorizedViewer(user)){
          gateEl.hidden = false;
          gateEl.textContent = 'This game isn’t public yet — check back once it’s live on the main page.';
          contentEl.hidden = true;
          return;
        }
        // Open to everyone (signed in or not) -- signing in is only needed later, to submit a score.
        gateEl.hidden = true;
        contentEl.hidden = false;
        loadEmulator();
      });
    }
    if(window.NGPC_AUTH){
      NGPC_AUTH.onAuthChange(applyAuthState);
    } else {
      // auth.js itself failed to load -- fail closed, same as "hidden if not signed in" intends.
      applyAuthState(null);
    }
  }

  window.NGPCWebPlayer = { init };
})();
