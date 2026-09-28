const FPS = 6144000 / (515 * 199);
const KEYS = {ArrowUp:1, ArrowDown:2, ArrowLeft:4, ArrowRight:8, KeyZ:16, KeyX:32, Enter:64};
const MAX_ROM = 4 * 1024 * 1024;
const SETTINGS_KEY = 'ngpcraft-player-settings-v1';
const CONTROLS = [[1,'Up'],[2,'Down'],[4,'Left'],[8,'Right'],[16,'A'],[32,'B'],[64,'Option']];
const KEY_LABELS = {ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Enter:'Enter',Space:'Space'};
const keyLabel = (code, key) => KEY_LABELS[code] || (key?.length===1 ? key.toUpperCase() : code.replace(/^Key|^Digit/,''));

export class NgpCraftPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML = `
      <style>
      :host{display:block;max-width:580px;color:#e9eef7;font:14px system-ui,sans-serif}
      *{box-sizing:border-box}section{font:14px system-ui,sans-serif;background:#141c2b;border:1px solid #354057;border-radius:20px;padding:20px}
      header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}
      strong{letter-spacing:.12em;font-size:16px}small{color:#a7b5cc}canvas{display:block;width:100%;aspect-ratio:160/152;background:#080d15;image-rendering:pixelated;border-radius:6px;outline:none}
      canvas:focus-visible{outline:2px solid #66e4c0;outline-offset:3px}.bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      button,.file{font:inherit;color:inherit;background:#26334a;border:1px solid #41526d;border-radius:9px;padding:9px 12px;cursor:pointer}
      button:hover,.file:hover{background:#35465f}button:focus-visible,.file:focus-within{outline:2px solid #66e4c0}button:disabled{opacity:.45;cursor:default}
      button.primary{background:#78e0ba;color:#10251c;border-color:#78e0ba;font-weight:650}
      input[type=file]{position:absolute;width:1px;height:1px;opacity:0}.status{min-height:1.4em;color:#b9c8dc;margin:14px 0 0;overflow-wrap:anywhere}
      .touch{display:flex;justify-content:space-between;align-items:center;margin-top:18px;gap:12px}.dpad{display:grid;grid-template-columns:repeat(3,44px);gap:3px}.dpad button{padding:12px 0}.actions{display:flex;gap:8px;align-items:center}.touch button{touch-action:none;user-select:none;-webkit-user-select:none}.touch button[aria-pressed=true]{background:#4d806e}
      details{margin-top:14px;color:#b9c8dc}summary{cursor:pointer}.hint{line-height:1.6;margin:14px 0 0;font-size:12px;color:#a7b5cc}
      [hidden]{display:none!important}.settings{background:#1c2739;border:1px solid #41526d;border-radius:12px;padding:16px;margin-top:14px}.settings h2{font-size:16px;margin:0 0 12px}.setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0}.setting-row input[type=range]{width:130px;accent-color:#78e0ba}.setting-row input[type=checkbox]{accent-color:#78e0ba}.setting-row select{font:inherit;color:inherit;background:#26334a;padding:8px;border:1px solid #41526d;border-radius:7px}.bindings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.binding{display:flex;justify-content:space-between;align-items:center;gap:8px}.binding button{min-width:78px;max-width:70%;overflow-wrap:anywhere}.binding button[aria-pressed=true]{border-color:#78e0ba;color:#78e0ba}.settings-note{line-height:1.5;min-height:3em;color:#b9c8dc;font-size:12px}
      :host(:fullscreen){max-width:none;width:100%;height:100%;background:#080d15;display:grid;place-items:center;--fullscreen-ui:320px} :host(:fullscreen) section{max-width:none;width:100%;height:100%;overflow:auto;display:flex;flex-direction:column;align-items:center;border:0;border-radius:0;padding:12px}
      :host(:fullscreen) header,:host(:fullscreen) .save-panel,:host(:fullscreen) .controls-hint{display:none}
      :host(:fullscreen) canvas{flex-shrink:0;width:min(calc(100vw - 24px),calc((100dvh - var(--fullscreen-ui)) * 160 / 152));max-width:100%;margin:auto 0 0}
      :host(:fullscreen) .touch{width:min(100%,540px);margin-bottom:auto}:host(:fullscreen) .status{margin-top:8px}:host(:fullscreen) .settings{position:absolute;z-index:2;top:12px;right:12px;width:min(440px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;box-shadow:0 8px 40px #0009}
      @media(max-width:380px){section{padding:12px}.bar{gap:5px}button,.file{padding:8px}.dpad{grid-template-columns:repeat(3,38px)}}
      @media(max-height:500px) and (min-width:700px){:host(:fullscreen) canvas{width:calc((100dvh - 110px) * 160 / 152)}:host(:fullscreen) .touch{position:absolute;left:12px;bottom:85px;width:calc(100% - 24px);margin:0;pointer-events:none}:host(:fullscreen) .touch button{pointer-events:auto}}
      </style>
      <section lang="en" aria-label="Neo Geo Pocket Color player">
        <header><strong>NGPCRAFT <small>WEB</small></strong><small>NEO GEO POCKET COLOR</small></header>
        <canvas width="160" height="152" tabindex="0" aria-label="Game screen"></canvas>
        <div class="bar">
          <label class="file">Open ROM<input class="rom" type="file" accept=".ngp,.ngc,.npc,.bin"></label>
          <button class="primary play" disabled>Play</button><button class="reset" disabled>Restart</button>
          <button class="mute" aria-pressed="false">Sound: on</button><button class="full">Fullscreen</button>
          <button class="options" aria-expanded="false" aria-controls="settings">Options</button>
        </div>
        <div class="settings" id="settings" hidden>
          <h2>Player settings</h2>
          <label class="setting-row">Volume <span><input class="volume" type="range" min="0" max="100" value="100" aria-label="Volume"><output class="volume-value">100 %</output></span></label>
          <label class="setting-row">Display <select class="display"><option value="pixelated">Sharp pixels</option><option value="smooth">Smooth</option></select></label>
          <label class="setting-row">Show touch controls <input class="show-touch" type="checkbox" checked></label>
          <h2>Keyboard controls</h2>
          <div class="bindings">${CONTROLS.map(([bit,name])=>`<div class="binding"><span>${name}</span><button data-bind="${bit}" aria-label="Assign key for ${name}" aria-pressed="false"></button></div>`).join('')}</div>
          <p class="settings-note" role="status">Click a key to change it. Escape cancels. Settings are saved in this browser.</p>
          <div class="bar"><button class="defaults">Restore defaults</button><button class="close-options">Close</button></div>
        </div>
        <p class="status" role="status" aria-live="polite">Open a game to begin.</p>
        <div class="touch" aria-label="Touch controls">
          <div class="dpad"><span></span><button data-bit="1" aria-label="Up">▲</button><span></span><button data-bit="4" aria-label="Left">◀</button><span></span><button data-bit="8" aria-label="Right">▶</button><span></span><button data-bit="2" aria-label="Down">▼</button></div>
          <div class="actions"><button data-bit="64">Option</button><button data-bit="16">A</button><button data-bit="32">B</button></div>
        </div>
        <details class="save-panel"><summary>Game save</summary><div class="bar"><button class="export" disabled>Export</button><label class="file">Import<input class="save" type="file" accept=".ngpsav"></label></div><p class="hint">Your game save is stored in this browser. Export it to keep a backup.</p></details>
        <p class="hint controls-hint"><span class="key-hint"></span><br>Double-click the screen for fullscreen.<br>Local ROMs are never uploaded. Standard gamepads and touch controls are supported.</p>
      </section>`;
    this.$ = selector => this.shadowRoot.querySelector(selector);
    this.canvas = this.$('canvas');
    this.context = this.canvas.getContext('2d', {alpha:false});
    this.frame = new ImageData(160,152);
    this.keys = new Set(); this.pointers = new Map(); this.sources = new Set();
    this.running = false; this.loaded = false; this.muted = false; this.audioTime = 0;
    this.locked = false; this.saveBlocked = false;
    this.settings = this.defaultSettings();
    this.readSettings();this.applySettings();
  }
  connectedCallback() {
    if (this.events) return;
    this.events = new AbortController();
    const on = (target, type, fn) => target.addEventListener(type,fn,{signal:this.events.signal});
    const task = fn => async () => {try {await fn();} catch(e) {this.report(e.message);}};
    on(this.$('.rom'),'change',task(async()=>{
      const file = this.$('.rom').files[0]; if (!file) return;
      if (file.size > MAX_ROM) throw Error('ROM is too large: maximum 4 MiB.');
      await this.load(new Uint8Array(await file.arrayBuffer()),file.name);
      this.$('.rom').value='';
    }));
    on(this.$('.play'),'click',task(()=>this.running ? this.pause() : this.play()));
    on(this.$('.reset'),'click',()=>{if(this.loaded){this.stopAudio();this.module._web_reset();this.report('Game restarted.');}});
    on(this.$('.mute'),'click',()=>{if(this.settings.volume===0){this.settings.volume=100;this.muted=false;this.writeSettings();}else this.muted=!this.muted;this.applySettings();});
    on(this.$('.full'),'click',task(()=>this.toggleFullscreen()));
    on(this.canvas,'dblclick',task(()=>this.toggleFullscreen()));
    on(document,'fullscreenchange',()=>this.updateFullscreen());
    this.updateFullscreen();
    on(this.$('.options'),'click',()=>this.toggleOptions());
    on(this.$('.close-options'),'click',()=>this.toggleOptions(false));
    on(this.$('.volume'),'input',()=>{this.settings.volume=+this.$('.volume').value;this.muted=false;this.applySettings();this.writeSettings();});
    on(this.$('.display'),'change',()=>{this.settings.display=this.$('.display').value;this.applySettings();this.writeSettings();});
    on(this.$('.show-touch'),'change',()=>{this.settings.touch=this.$('.show-touch').checked;this.clearInput();this.applySettings();this.writeSettings();});
    on(this.$('.defaults'),'click',()=>{this.captureBit=null;this.settings=this.defaultSettings();this.muted=false;this.clearInput();this.applySettings();this.writeSettings();this.$('.settings-note').textContent='Default settings restored.';});
    for(const b of this.shadowRoot.querySelectorAll('[data-bind]')){
      on(b,'click',()=>{this.clearInput();this.captureBit=+b.dataset.bind;this.renderBindings();this.$('.settings-note').textContent='Press the new key. Escape to cancel.';});
      on(b,'blur',()=>{if(this.captureBit===+b.dataset.bind)this.cancelBinding();});
    }
    on(this.$('.export'),'click',()=>this.exportSave());
    on(this.$('.save'),'change',task(async()=>{
      const file=this.$('.save').files[0]; if(!file)return;
      if(!this.loaded)throw Error('Open a game before importing its save.');
      if(file.size!==this.module._web_save_size())throw Error('Incorrect save size.');
      this.pause(); const generation=this.generation||0, key=this.key;
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(generation!==(this.generation||0)||key!==this.key||!this.loaded)throw Error('The game changed during import. Try again.');
      if(!this.withBytes(bytes,(p,n)=>this.module._web_save_restore(p,n)))throw Error('Save is corrupt or belongs to another game.');
      this.saveBlocked=false;this.persist();this.module._web_reset();this.report('Save imported. Click Play.');this.$('.save').value='';
    }));
    on(this.shadowRoot,'keydown',e=>{
      if(this.captureBit){this.captureBinding(e);return;}
      if(e.code==='Escape'&&!this.$('.settings').hidden){e.preventDefault();e.stopPropagation();this.toggleOptions(false);return;}
      if (e.target!==this.canvas || !this.settings.keys[e.code] || e.ctrlKey || e.altKey || e.metaKey)return;
      e.preventDefault();this.keys.add(e.code);
    });
    on(window,'keyup',e=>{this.keys.delete(e.code);if(e.code===this.captureReleaseCode){e.preventDefault();this.captureReleaseCode=null;}});
    on(this.canvas,'blur',()=>this.clearInput());
    for(const b of this.shadowRoot.querySelectorAll('[data-bit]')){
      on(b,'pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,+b.dataset.bit);b.setAttribute('aria-pressed','true');});
      const release=e=>{this.pointers.delete(e.pointerId);b.setAttribute('aria-pressed','false');};
      on(b,'pointerup',release);on(b,'pointercancel',release);on(b,'lostpointercapture',release);
    }
    on(this,'focusout',e=>{if(!this.contains(e.relatedTarget))this.clearInput();});
    on(window,'blur',()=>this.pause());
    on(document,'visibilitychange',()=>{if(document.hidden)this.pause();});
    on(window,'pagehide',()=>this.pause());
    this.saveTimer=setInterval(()=>this.persist(),5000);
    if(this.getAttribute('rom')&&!this.hasAttribute('defer'))this.loadURL(this.getAttribute('rom')).catch(e=>this.report(e.message));
  }
  disconnectedCallback() {
    this.pause();clearInterval(this.saveTimer);this.events?.abort();this.events=null;
    this.generation=(this.generation||0)+1;this.module?._web_close();this.module=null;this.loaded=false;
    this.urlRequest=(this.urlRequest||0)+1;this.romFetch?.abort();
    this.audio?.close();this.audio=null;this.gain=null;
    this.$('.play').disabled=true;this.$('.reset').disabled=true;this.$('.export').disabled=true;
    this.report('Open a game to begin.');
  }
  report(text){this.$('.status').textContent=text;}
  defaultSettings(){return {volume:100,display:'pixelated',touch:true,keys:{...KEYS},labels:Object.fromEntries(Object.keys(KEYS).map(code=>[code,keyLabel(code)]))};}
  readSettings(){
    try{
      const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(!s)return;
      if(Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=100)this.settings.volume=s.volume;
      if(['pixelated','smooth'].includes(s.display))this.settings.display=s.display;
      if(typeof s.touch==='boolean')this.settings.touch=s.touch;
      const pairs=Object.entries(s.keys||{}),bits=CONTROLS.map(([bit])=>bit);
      if(pairs.length===7&&new Set(pairs.map(([,bit])=>bit)).size===7&&pairs.every(([code,bit])=>this.allowedKey(code)&&bits.includes(bit))){
        this.settings.keys=Object.fromEntries(pairs);
        this.settings.labels=Object.fromEntries(pairs.map(([code])=>[code,KEY_LABELS[code]||(typeof s.labels?.[code]==='string'&&s.labels[code].length<=24?s.labels[code]:keyLabel(code))]));
      }
    }catch{} // Corrupt or unavailable preferences must never prevent playing.
  }
  writeSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(this.settings));}catch{this.$('.settings-note').textContent='Settings applied for this session; local storage is unavailable.';}}
  applySettings(){
    const s=this.settings;if(this.gain)this.gain.gain.value=this.muted?0:s.volume/100;
    this.$('.volume').value=s.volume;this.$('.volume-value').textContent=`${s.volume} %`;
    this.$('.display').value=s.display;this.canvas.style.imageRendering=s.display==='smooth'?'auto':'pixelated';
    this.$('.show-touch').checked=s.touch;this.$('.touch').hidden=!s.touch;
    this.$('section').style.setProperty('--fullscreen-ui',s.touch?'320px':'160px');
    this.$('.mute').textContent=`Sound: ${this.muted||s.volume===0?'off':'on'}`;this.$('.mute').setAttribute('aria-pressed',String(this.muted||s.volume===0));
    this.renderBindings();
  }
  renderBindings(){
    for(const b of this.shadowRoot.querySelectorAll('[data-bind]')){
      const code=Object.keys(this.settings.keys).find(code=>this.settings.keys[code]===+b.dataset.bind);
      b.textContent=this.captureBit===+b.dataset.bind?'…':this.settings.labels[code];b.setAttribute('aria-pressed',String(this.captureBit===+b.dataset.bind));
    }
    const hint=CONTROLS.map(([bit,name])=>{const code=Object.keys(this.settings.keys).find(code=>this.settings.keys[code]===bit);return `${name} : ${this.settings.labels[code]}`;}).join(' · ');
    this.$('.key-hint').textContent=hint;this.canvas.setAttribute('aria-label',`Game screen. ${hint}`);
  }
  allowedKey(code){return typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Enter|Space|Backspace|Numpad(Enter|[0-9]|Add|Subtract|Multiply|Divide|Decimal)|Shift(Left|Right)|Control(Left|Right)|Comma|Period|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Minus|Equal|Backquote)$/.test(code)&&!code.startsWith('Control');}
  captureBinding(e){
    if(e.code==='Tab'){this.cancelBinding();return;}
    e.preventDefault();e.stopPropagation();this.captureReleaseCode=e.code;if(e.repeat)return;
    if(e.code==='Escape'){this.cancelBinding();return;}
    if(!this.allowedKey(e.code)||e.ctrlKey||e.altKey||e.metaKey){this.$('.settings-note').textContent='Choose a single key (without Ctrl, Alt or Cmd).';return;}
    const existing=this.settings.keys[e.code];
    if(existing&&existing!==this.captureBit){this.$('.settings-note').textContent=`This key is already assigned to ${CONTROLS.find(([bit])=>bit===existing)[1]}. Choose another key.`;return;}
    const old=Object.keys(this.settings.keys).find(code=>this.settings.keys[code]===this.captureBit);
    delete this.settings.keys[old];delete this.settings.labels[old];
    this.settings.keys[e.code]=this.captureBit;this.settings.labels[e.code]=keyLabel(e.code,e.key);
    this.captureBit=null;this.clearInput();this.renderBindings();this.$('.settings-note').textContent='Key assigned. Close settings, then click Play.';this.writeSettings();
  }
  cancelBinding(){this.captureBit=null;this.renderBindings();this.$('.settings-note').textContent='Assignment canceled. Click a key to change it.';}
  toggleOptions(open=this.$('.settings').hidden){
    this.captureBit=null;if(open)this.pause();this.renderBindings();
    this.$('.settings').hidden=!open;this.$('.options').setAttribute('aria-expanded',String(open));
    if(open)this.$('.volume').focus();else this.$('.options').focus();
  }
  async toggleFullscreen(){
    if(document.fullscreenElement===this)await document.exitFullscreen();
    else if(this.requestFullscreen&&document.fullscreenEnabled)await this.requestFullscreen();
    else throw Error('Fullscreen is unavailable in this browser or embedded page.');
  }
  updateFullscreen(){const active=document.fullscreenElement===this;this.$('.full').textContent=active?'Exit fullscreen':'Fullscreen';this.$('.full').setAttribute('aria-pressed',String(active));}
  async loadURL(url){
    this.romFetch?.abort();const controller=this.romFetch=new AbortController();
    const request=this.urlRequest=(this.urlRequest||0)+1,generation=this.generation||0;
    const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`Loading failed (HTTP ${response.status}).`);
    if(Number(response.headers.get('content-length'))>MAX_ROM)throw Error('ROM is too large.');
    const reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_ROM){await reader.cancel();throw Error('ROM is too large.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(request!==this.urlRequest||generation!==(this.generation||0))return;
    await this.load(bytes,new URL(url,document.baseURI).pathname.split('/').pop());
  }
  withBytes(bytes,fn){const m=this.module,p=m._malloc(bytes.length);if(!p)throw Error('Not enough memory.');try{m.HEAPU8.set(bytes,p);return fn(p,bytes.length);}finally{m._free(p);}}
  async load(bytes,name='Game'){
    if(this.locked)throw Error('A game is already loading.');
    if(bytes.length<64||bytes.length>MAX_ROM)throw Error('ROM size must be between 64 bytes and 4 MiB (ZIP is not supported).');
    this.urlRequest=(this.urlRequest||0)+1;this.romFetch?.abort();
    this.locked=true;this.pause();this.loaded=false;
    const generation=this.generation||0;
    this.$('.play').disabled=true;this.$('.reset').disabled=true;this.$('.export').disabled=true;
    this.report('Loading emulator…');
    try{
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const key='ngpcraft-web-v1:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      if(!this.module){const {default:create}=await import('./ngpcraft.mjs');const m=await create();if(generation!==(this.generation||0)){m._web_close();return;}this.module=m;}
      if(generation!==(this.generation||0))return;
      if(!this.withBytes(bytes,(p,n)=>this.module._web_load(p,n)))throw Error('The emulator rejected this ROM.');
      this.key=key;this.gameName=name;this.loaded=true;this.saveBlocked=false;
      let warning='';
      try{const stored=localStorage.getItem(key);if(stored!==null){
        let valid=false;
        try{if(stored.length<=Math.ceil(this.module._web_save_size()/3)*4){const raw=Uint8Array.from(atob(stored),c=>c.charCodeAt(0));valid=!!this.withBytes(raw,(p,n)=>this.module._web_save_restore(p,n));}}catch{}
        if(!valid){this.saveBlocked=true;warning=' Invalid save: original preserved, autosave suspended.';}
      }}
      catch(e){warning=' Local storage unavailable: use Export.';}
      this.$('.play').disabled=false;this.$('.reset').disabled=false;this.$('.export').disabled=false;
      this.context.fillStyle='#080d15';this.context.fillRect(0,0,160,152);
      this.report(`${name} — ready. Click Play.${warning}`);
      this.dispatchEvent(new CustomEvent('ngpc-ready',{detail:{name}}));
    }finally{this.locked=false;}
  }
  async play(){
    if(!this.loaded||this.running||this.locked)return;
    if(!this.$('.settings').hidden)this.toggleOptions(false);
    const epoch=this.playEpoch=(this.playEpoch||0)+1;
    try{
      await this.unlockAudio();
    }catch(e){this.report('Audio unavailable: playing without sound.');}
    if(!this.loaded||!this.isConnected||epoch!==this.playEpoch)return;
    this.running=true;this.last=performance.now();this.accumulator=0;this.audioTime=0;
    this.$('.play').textContent='Pause';this.canvas.focus();this.report(this.gameName);
    this.raf=requestAnimationFrame(t=>this.tick(t));
  }
  clearInput(){this.keys.clear();this.pointers.clear();for(const b of this.shadowRoot.querySelectorAll('[data-bit]'))b.setAttribute('aria-pressed','false');}
  async unlockAudio(){
    if(!this.audio){this.audio=new AudioContext({latencyHint:'interactive'});this.gain=this.audio.createGain();this.gain.gain.value=this.muted?0:this.settings.volume/100;this.gain.connect(this.audio.destination);}
    await this.audio.resume();
  }
  captureFrame(){
    if(!this.loaded)throw Error('No game loaded.');
    const frame=document.createElement('canvas');frame.width=160;frame.height=152;
    frame.getContext('2d',{alpha:false}).drawImage(this.canvas,0,0);
    return frame;
  }
  pause(){this.playEpoch=(this.playEpoch||0)+1;this.running=false;cancelAnimationFrame(this.raf);this.clearInput();this.stopAudio();this.$('.play').textContent='Play';this.persist();}
  stopAudio(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.audioTime=0;}
  input(){
    let mask=0;for(const key of this.keys)mask|=this.settings.keys[key];for(const bit of this.pointers.values())mask|=bit;
    if(this.shadowRoot.activeElement){
      let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{} // Embedding pages may deny gamepad access.
      const pad=Array.from(pads).find(p=>p?.mapping==='standard');
      if(pad){for(const [i,bit] of [[12,1],[13,2],[14,4],[15,8],[0,16],[1,32],[9,64]])if(pad.buttons[i]?.pressed)mask|=bit;if(pad.axes[0]<-.4)mask|=4;if(pad.axes[0]>.4)mask|=8;if(pad.axes[1]<-.4)mask|=1;if(pad.axes[1]>.4)mask|=2;}
    }
    return mask;
  }
  tick(now){
    if(!this.running)return;
    try{
      this.accumulator+=Math.min(now-this.last,100);this.last=now;let count=0;
      while(this.accumulator>=1000/FPS&&count<4){
        const status=this.module._web_run(this.input());
        if(![0,1,41].includes(status))throw Error(`Emulation stopped (code ${status}).`);
        this.queueAudio();this.accumulator-=1000/FPS;count++;
      }
      if(count===4)this.accumulator=0;
      if(count){const p=this.module._web_video();this.frame.data.set(this.module.HEAPU8.subarray(p,p+160*152*4));this.context.putImageData(this.frame,0,0);}
      this.raf=requestAnimationFrame(t=>this.tick(t));
    }catch(e){this.pause();this.report(e.message);}
  }
  queueAudio(){
    const a=this.audio,m=this.module,n=m._web_audio_frames();if(!a||a.state!=='running'||!n)return;
    if(this.audioTime>a.currentTime+.15)return;
    const buffer=a.createBuffer(2,n,44100),p=m._web_audio()>>1;
    for(let c=0;c<2;c++){const out=buffer.getChannelData(c);for(let i=0;i<n;i++)out[i]=m.HEAP16[p+i*2+c]/32768;}
    const source=a.createBufferSource();source.buffer=buffer;source.connect(this.gain);
    this.audioTime=Math.max(this.audioTime,a.currentTime+.025);source.start(this.audioTime);this.audioTime+=n/44100;
    this.sources.add(source);source.onended=()=>{source.disconnect();this.sources.delete(source);};
  }
  saveBytes(){const m=this.module,p=m._web_save();return m.HEAPU8.slice(p,p+m._web_save_size());}
  persist(){
    if(!this.loaded||this.saveBlocked)return;
    try{const bytes=this.saveBytes();let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));localStorage.setItem(this.key,btoa(str));}
    catch(e){this.report('Local save unavailable: use Export.');}
  }
  exportSave(){if(!this.loaded)return;const url=URL.createObjectURL(new Blob([this.saveBytes()]));const a=document.createElement('a');a.href=url;a.download=`${this.gameName}.ngpsav`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
customElements.define('ngpcraft-player',NgpCraftPlayer);
