import {NgpCraftPlayer} from './player.js';
const expandedPlayers=new Set();
let savedOverflow='';

// Compact frontend for a game's own page. No global emulator singleton.
export class NgpCraftEmbed extends NgpCraftPlayer {
  defaultSettings(){return {...super.defaultSettings(),touch:matchMedia('(pointer:coarse)').matches};}
  constructor(){
    super();
    const style=document.createElement('style');
    style.textContent=`
      :host{max-width:none;width:100%;height:100%;aspect-ratio:160/152;display:block;position:relative}
      section{width:100%;height:100%;padding:0!important;position:relative;overflow:hidden;border-radius:inherit;background:#080d15}
      canvas{width:100%;height:calc(100% - 48px);aspect-ratio:auto;object-fit:contain;border-radius:0}
      header,.controls-hint,.bar>.file{display:none}
      section>.bar{position:absolute;bottom:0;left:0;right:0;height:48px;z-index:3;margin:0;padding:7px;gap:5px;background:#172235;border-top:1px solid #354057;flex-wrap:nowrap;align-items:center}
      section>.bar button{font-size:12px;padding:7px 9px;border-radius:6px;white-space:nowrap;min-width:0}
      section>.bar .full{margin-left:auto}section>.bar .options{border-color:#6b9b92;color:#a8efcf}
      .status{position:absolute;left:8px;right:8px;top:8px;margin:0;padding:5px 8px;border-radius:6px;background:#080d15c9;font-size:12px;pointer-events:none;z-index:2}
      .settings{position:absolute;inset:8px;z-index:5;margin:0;padding:0!important;max-height:calc(100% - 16px);overflow:hidden;box-shadow:0 8px 40px #0009;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#172235;border-color:#53647c}
      .settings-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #354057;background:#1f2d43}.settings-heading h2{margin:0;font-size:15px}.settings-heading .close-options{padding:0;width:36px;height:36px;font-size:25px;line-height:1;flex-shrink:0}
      .settings-tabs{display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid #354057}.settings-tabs button{flex:1;padding:8px 5px;font-size:12px;border-color:transparent;background:transparent}.settings-tabs button[aria-selected=true]{background:#30495a;border-color:#699b90;color:#b8f6d5}
      .settings-scroll{overflow-y:auto;min-height:0;padding:4px 12px 12px;overscroll-behavior:contain;scrollbar-width:thin}.settings-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-top:1px solid #354057;background:#1f2d43}.settings-footer small{font-size:11px}.settings-footer button{padding:8px 12px}
      .settings .save-panel{display:block;margin:10px 0}.settings .reset{margin-top:8px}.settings .bindings{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.settings .binding{font-size:12px}.settings .binding button{min-width:58px;padding:7px}.settings .settings-note{min-height:0;margin:8px 0}.settings .defaults{font-size:12px;padding:7px}.settings .setting-row{font-size:13px}.settings .mute{font-size:12px}
      .touch{position:absolute;left:10px;right:10px;bottom:55px;margin:0;pointer-events:none;z-index:2}.touch button{pointer-events:auto;background:#26334ac9}.dpad{grid-template-columns:repeat(3,34px)}.dpad button{padding:8px 0}.actions button{padding:9px}
      .launch{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;background:#080d15de;padding:24px;text-align:center}
      .launch button{padding:14px 30px;font-size:17px}.launch p{margin:0;max-width:100%;overflow-wrap:anywhere}.launch small{max-width:100%;overflow-wrap:anywhere}
      :host([expanded]){position:fixed;inset:0;z-index:2147483000;width:100%;height:100dvh;max-width:none;aspect-ratio:auto;border-radius:0}
      :host([expanded]) section,:host(:fullscreen) section{display:block;padding:0;border:0}
      :host([expanded]) canvas,:host(:fullscreen) canvas{width:100%;height:calc(100% - 48px);max-width:100%;margin:0;object-fit:contain}
      :host([expanded]) .touch,:host(:fullscreen) .touch{width:auto;left:18px;right:18px;bottom:70px;margin:0}
      :host([expanded]) .settings,:host(:fullscreen) .settings{inset:12px;width:auto;max-width:460px;margin-left:auto;max-height:calc(100% - 24px)}
      @media(max-width:380px){section>.bar button{padding:7px 5px;font-size:11px}.setting-row input[type=range]{width:95px}.settings-tabs button{font-size:11px}.settings-footer small{display:none}.settings-footer{justify-content:flex-end}}
    `;
    this.shadowRoot.append(style);
    this.buildSettings();
    const capture=document.createElement('button');capture.className='capture';capture.textContent='Capture';capture.title='Capture the game screen';capture.disabled=true;
    this.$('section>.bar').insertBefore(capture,this.$('.full'));
    this.$('.options').textContent='Settings';
    const launch=document.createElement('div');launch.className='launch';
    launch.innerHTML='<p class="game-title"></p><button class="primary start">Play</button><small class="launch-note">Click Play to load the game.</small>';
    this.$('section').append(launch);
  }
  buildSettings(){
    const panel=this.$('.settings');
    const rows=Array.from(panel.querySelectorAll('.setting-row'));
    const bindings=this.$('.bindings'),note=this.$('.settings-note'),defaults=this.$('.defaults');
    const close=this.$('.close-options'),mute=this.$('.mute'),reset=this.$('.reset'),save=this.$('.save-panel');
    panel.replaceChildren();panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Game settings');
    const heading=document.createElement('div');heading.className='settings-heading';
    const title=document.createElement('h2');title.textContent='Settings';
    close.textContent='×';close.setAttribute('aria-label','Close settings');close.title='Close (Escape)';heading.append(title,close);
    const tabs=document.createElement('div');tabs.className='settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Settings category');
    const scroll=document.createElement('div');scroll.className='settings-scroll';
    for(const [id,label] of [['general','General'],['keys','Keys'],['saves','Save']]){
      const tab=document.createElement('button');tab.dataset.tab=id;tab.id=`tab-${id}`;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`pane-${id}`);tabs.append(tab);
      const pane=document.createElement('div');pane.id=`pane-${id}`;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',tab.id);scroll.append(pane);
    }
    scroll.querySelector('#pane-general').append(...rows,mute);
    scroll.querySelector('#pane-keys').append(bindings,note,defaults);
    save.open=true;scroll.querySelector('#pane-saves').append(save,reset);
    const footer=document.createElement('div');footer.className='settings-footer';
    footer.innerHTML='<small>Game paused</small><button class="primary back-game">Resume game</button>';
    panel.append(heading,tabs,scroll,footer);this.selectSettingsTab('general');
  }
  selectSettingsTab(id){
    this.captureBit=null;this.renderBindings();
    for(const tab of this.shadowRoot.querySelectorAll('[data-tab]')){
      const selected=tab.dataset.tab===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
      this.$(`#pane-${tab.dataset.tab}`).hidden=!selected;
    }
    this.$('.settings-scroll').scrollTop=0;
  }
  toggleOptions(open=this.$('.settings').hidden){
    if(open)this.selectSettingsTab('general');
    super.toggleOptions(open);
    if(open){this.$('.back-game').disabled=!this.loaded;this.$('.close-options').focus({preventScroll:true});}
  }
  connectedCallback(){
    if(this.events)return;
    this.setAttribute('defer','');super.connectedCallback();
    const signal=this.events.signal;
    this.$('.back-game').addEventListener('click',()=>{this.toggleOptions(false);this.play().catch(e=>this.report(e.message));},{signal});
    for(const tab of this.shadowRoot.querySelectorAll('[data-tab]')){
      tab.addEventListener('click',()=>this.selectSettingsTab(tab.dataset.tab),{signal});
      tab.addEventListener('keydown',e=>{
        const ids=['general','keys','saves'],i=ids.indexOf(tab.dataset.tab);
        const next=e.code==='ArrowRight'?(i+1)%3:e.code==='ArrowLeft'?(i+2)%3:e.code==='Home'?0:e.code==='End'?2:null;
        if(next!==null){e.preventDefault();this.selectSettingsTab(ids[next]);this.$(`[data-tab="${ids[next]}"]`).focus();}
      },{signal});
    }
    this.$('.game-title').textContent=this.getAttribute('game-title')||'Neo Geo Pocket Color';
    this.$('.capture').textContent=this.getAttribute('capture-label')||'Capture';
    this.$('.start').addEventListener('click',()=>this.startGame(),{signal});
    this.$('.capture').addEventListener('click',()=>{
      try{
        const canvas=this.captureFrame();
        const unhandled=this.dispatchEvent(new CustomEvent('ngpc-capture',{detail:{canvas},bubbles:true,composed:true,cancelable:true}));
        if(unhandled){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='ngpcraft-capture.png';a.click();}
      }
      catch(e){this.report(e.message);}
    },{signal});
    this.addEventListener('ngpc-ready',()=>{this.$('.launch').hidden=true;this.$('.capture').disabled=false;},{signal});
    this.addEventListener('keydown',e=>{if(e.code==='Escape'&&this.hasAttribute('expanded')){e.preventDefault();this.toggleFullscreen();}},{signal});
    this.updateFullscreen();
  }
  disconnectedCallback(){
    this.setExpanded(false);super.disconnectedCallback();
    clearTimeout(this.statusTimer);
    this.$('.launch').hidden=false;this.$('.capture').disabled=true;
  }
  report(text){
    super.report(text);
    clearTimeout(this.statusTimer);
    const status=this.$('.status');
    status.hidden=this.loaded&&this.running&&text===this.gameName;
    // During gameplay only transient feedback should overlay the screen.
    // Errors that pause emulation remain visible until the user resumes.
    if(!status.hidden&&this.running)this.statusTimer=setTimeout(()=>{status.hidden=true;},5000);
  }
  async startGame(){
    if(this.starting)return;
    const url=this.getAttribute('rom');
    if(!url){this.$('.launch-note').textContent='No ROM configured by this page.';return;}
    this.starting=true;this.$('.start').disabled=true;this.$('.launch-note').textContent='Loading game…';
    const generation=this.generation||0;
    try{
      // Audio permission is acquired during the click, before waiting for network/WASM.
      try{await this.unlockAudio();}catch{}
      if(!this.isConnected||generation!==(this.generation||0))return;
      await this.loadURL(url);
      if(this.isConnected&&generation===(this.generation||0)&&this.loaded)await this.play();
    }catch(e){if(this.isConnected)this.$('.launch-note').textContent=`${e.message} Try again.`;}
    finally{this.starting=false;this.$('.start').disabled=false;}
  }
  async toggleFullscreen(){
    // CSS maximize, like the reference site: also works when Fullscreen API is denied.
    if(document.fullscreenElement===this){await document.exitFullscreen();return;}
    this.setExpanded(!this.hasAttribute('expanded'));this.canvas.focus({preventScroll:true});
  }
  setExpanded(active){
    if(active&&!expandedPlayers.has(this)){if(!expandedPlayers.size){savedOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';}expandedPlayers.add(this);}
    if(!active&&expandedPlayers.delete(this)&&!expandedPlayers.size)document.documentElement.style.overflow=savedOverflow;
    this.toggleAttribute('expanded',active);this.updateFullscreen();
  }
  updateFullscreen(){const active=this.hasAttribute('expanded')||document.fullscreenElement===this;this.$('.full').textContent=active?'Restore':'Maximize';this.$('.full').setAttribute('aria-pressed',String(active));}
}
customElements.define('ngpcraft-embed',NgpCraftEmbed);

export function mountNgpCraft(target,{rom,title='Neo Geo Pocket Color',onCapture}={}){
  const container=typeof target==='string'?document.querySelector(target):target;
  if(!container)throw Error('NgpCraft container not found.');
  const player=document.createElement('ngpcraft-embed');
  if(rom)player.setAttribute('rom',rom);
  player.setAttribute('game-title',title);
  if(onCapture)player.addEventListener('ngpc-capture',event=>{event.preventDefault();onCapture(event.detail.canvas,player);});
  container.append(player);
  return player;
}
