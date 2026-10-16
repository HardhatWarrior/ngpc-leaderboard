// player.js - the browser player: ROM/BIOS loading, 60 fps loop, canvas, WebAudio, input, pod status.
import createNgpcCore from "./ngpc_core.js";
import { Machine, loadCore, BUTTONS, SCREEN_W, SCREEN_H, AUDIO_HZ } from "./machine.js";
import { Pod } from "./pod.js";

const DEFAULT_SERVER = "wss://ngpnet.fly.dev/";
const LS_SERVER = "ngpnet.server";
const MAX_CATCHUP = 4;          // frames per animation tick at most
const RESYNC_AFTER = 30;        // frames behind -> drop the backlog instead

const $ = (id) => document.getElementById(id);
const el = {
  canvas: $("screen"), romFile: $("romFile"), biosFile: $("biosFile"), romName: $("romName"),
  biosState: $("biosState"), serverUrl: $("serverUrl"), reconnect: $("reconnect"), reset: $("reset"),
  mute: $("mute"), logToggle: $("logToggle"), podStatus: $("podStatus"), hint: $("hint"), log: $("log"),
  touch: $("touch"), dpad: $("dpad"), bar: $("bar"), stage: $("stage"),
  lobby: $("lobby"), lobbyList: $("lobbyList"),
};

// ------------------------------------------------------------------ IndexedDB (BIOS, last ROM)
const idb = {
  open() {
    if (this._db) return this._db;
    this._db = new Promise((resolve, reject) => {
      const req = indexedDB.open("ngpnetweb", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._db;
  },
  async get(key) {
    try {
      const db = await this.open();
      return await new Promise((resolve, reject) => {
        const r = db.transaction("files").objectStore("files").get(key);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
    } catch (_) { return undefined; }
  },
  async set(key, value) {
    try {
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(value, key);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch (_) { /* private mode etc.: just don't remember */ }
  },
};

// ------------------------------------------------------------------ audio (WebAudio, pull model)
class Audio {
  constructor() {
    this.ctx = null; this.node = null; this.muted = false;
    this.cap = 1 << 15;                               // ring of stereo frames (power of two)
    this.L = new Float32Array(this.cap); this.R = new Float32Array(this.cap);
    this.wr = 0; this.rd = 0; this.pos = 0;           // pos: fractional read cursor (resampling)
  }
  get available() { return (this.wr - this.rd) & (this.cap - 1); }
  start() {
    keepAwake();                                  // a user gesture: the moment iOS grants a wake lock
    if (this.ctx) { if (this.ctx.state !== "running") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ sampleRate: AUDIO_HZ }); } catch (_) { this.ctx = new AC(); }
    this.step = AUDIO_HZ / this.ctx.sampleRate;
    const node = this.ctx.createScriptProcessor(2048, 0, 2);
    node.onaudioprocess = (e) => this.pull(e.outputBuffer);
    node.connect(this.ctx.destination);
    this.node = node;
    if (this.ctx.state !== "running") this.ctx.resume();
  }
  /** Int16 interleaved stereo at 44100 Hz, from Machine.audio(). */
  push(pcm) {
    const n = pcm.length >> 1;
    if (!n) return;
    // keep latency bounded: if more than ~0.25 s is queued, drop the oldest
    const limit = 11025;
    if (this.available + n > limit) this.rd = (this.wr + n - limit) & (this.cap - 1);
    for (let i = 0; i < n; i++) {
      this.L[this.wr] = pcm[2 * i] / 32768;
      this.R[this.wr] = pcm[2 * i + 1] / 32768;
      this.wr = (this.wr + 1) & (this.cap - 1);
    }
  }
  pull(buf) {
    const outL = buf.getChannelData(0), outR = buf.getChannelData(1);
    const step = this.step || 1;
    for (let i = 0; i < outL.length; i++) {
      if (this.muted || this.available < 2) { outL[i] = outR[i] = 0; continue; }
      const a = this.rd, b = (a + 1) & (this.cap - 1), f = this.pos;
      outL[i] = this.L[a] + (this.L[b] - this.L[a]) * f;
      outR[i] = this.R[a] + (this.R[b] - this.R[a]) * f;
      this.pos += step;
      while (this.pos >= 1) { this.pos -= 1; this.rd = (this.rd + 1) & (this.cap - 1); }
    }
  }
}

// ------------------------------------------------------------------ player state
const state = {
  M: null, machine: null, pod: null, audio: new Audio(),
  rom: null, romName: "", bios: null,
  heldKeys: 0, heldTouch: 0, script: [],          // script: [{bits, frames}] from the debug API
  running: false, t0: 0, frames: 0, lastPump: 0, fallbackTimer: 0,
  image: null, fpsFrames: 0, fpsT: 0, fps: 0,
};
const ctx2d = el.canvas.getContext("2d", { alpha: false });
state.image = ctx2d.createImageData(SCREEN_W, SCREEN_H);

function log(text) {
  const lines = el.log.textContent ? el.log.textContent.split("\n") : [];
  lines.push(text);
  while (lines.length > 300) lines.shift();
  el.log.textContent = lines.join("\n");
  if (!el.log.hidden) el.log.scrollTop = el.log.scrollHeight;
}

function setPodStatus(stateName, pod, detail) {
  if (stateName === "closed" || stateName === "error") {
    el.hint.textContent = "Connection lost. Press Reset, then enter ONLINE again.";
    el.lobby.hidden = true;
  } else if (stateName === "reconnecting") {
    el.hint.textContent = "Connection lost, reconnecting... (the server keeps your seat in room " +
      (pod ? pod.room : "") + " for 90 s).";
  } else if (stateName === "connected") {
    el.hint.textContent = "";
  }
  const s = pod ? pod.seen : { rx: 0, tx: 0 };
  const extra = pod && pod.deframer.bad ? ", bad crc " + pod.deframer.bad : "";
  el.podStatus.className = "status " + stateName;
  el.podStatus.textContent = "pod: " + stateName + (detail ? " (" + detail + ")" : "") +
    " · frames in " + s.rx + " / out " + s.tx + extra +
    (state.fps ? " · " + state.fps + " fps" : "");
}

// ------------------------------------------------------------------ loading
async function loadBios() {
  const saved = await idb.get("bios");
  if (saved && saved.byteLength === 65536) { state.bios = new Uint8Array(saved); el.biosState.textContent = "BIOS: saved copy"; return; }
  try {
    const r = await fetch("bios.bin", { cache: "no-store" });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (buf.byteLength === 65536) { state.bios = new Uint8Array(buf); el.biosState.textContent = "BIOS: bios.bin"; return; }
    }
  } catch (_) { /* no bios.bin next to the page */ }
  el.biosState.textContent = "BIOS: pick bios.bin (64 KiB)";
  el.biosState.style.color = "var(--warn)";
}

async function loadRomFromQuery() {
  // ?rom=URL wins; else the page's own default (<body data-rom="game.ngc">), if any
  const url = new URL(location.href).searchParams.get("rom") || document.body.dataset.rom;
  if (!url) return false;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    setRom(new Uint8Array(await r.arrayBuffer()), url.split("/").pop() || url, false);
    return true;
  } catch (e) {
    el.hint.textContent = "Could not fetch ?rom=" + url + " (" + e.message + "). Pick a file instead.";
    return false;
  }
}

function setRom(bytes, name, remember = true) {
  state.rom = bytes; state.romName = name;
  el.romName.textContent = name + " (" + (bytes.length >> 10) + " KiB)";
  if (remember) idb.set("rom", { name, bytes });
  maybeStart();
}

function maybeStart() {
  if (!state.rom) { el.hint.textContent = "Pick a ROM file (.ngc)."; return; }
  if (!state.bios) { el.hint.textContent = "Pick bios.bin (64 KiB) to boot " + state.romName + "."; return; }
  start();
}

let starting = null;
function start() {
  if (starting) return starting.then(() => start());
  starting = startNow().finally(() => { starting = null; });
  return starting;
}
async function startNow() {
  if (!state.M) state.M = await loadCore(createNgpcCore);
  stopLoop();
  if (state.machine) state.machine.destroy();
  if (state.pod) state.pod.close();
  const m = new Machine(state.M, state.rom, state.bios);
  m.boot();
  const pod = new Pod({ url: el.serverUrl.value.trim(), onStatus: setPodStatus, onLog: log, onRooms: showRooms });
  pod.attach(m);
  state.machine = m; state.pod = pod;
  el.log.textContent = "";
  pod.connect();
  el.hint.textContent = pod.url ? "" : "Offline (no server URL). Enter one and press Reconnect to go online.";
  startLoop();
}

// ------------------------------------------------------------------ lobby (LIST every few seconds once the console said HELLO)
const LOBBY_EVERY_MS = 3000;
function showRooms(rooms) {
  const pod = state.pod;
  el.lobby.hidden = false;
  el.lobbyList.textContent = "";
  if (!rooms.length) { el.lobbyList.textContent = "none - CREATE ROOM to open one"; return; }
  for (const r of rooms) {
    const span = document.createElement("span");
    span.className = "room" + (pod && pod.room === r.code ? " mine" : "");
    span.textContent = r.code + " " + r.players + "/" + r.max;
    span.title = pod && pod.room === r.code ? "your room" : "JOIN ROOM and type this code";
    el.lobbyList.appendChild(span);
  }
}
setInterval(() => { if (state.pod && state.running) state.pod.listRooms(); }, LOBBY_EVERY_MS);

// ------------------------------------------------------------------ screen wake lock (phones lock the screen while you wait for the opponent)
const wake = { lock: null };
async function keepAwake() {
  if (!("wakeLock" in navigator) || wake.lock || document.hidden || !state.running) return;
  try {
    wake.lock = await navigator.wakeLock.request("screen");
    wake.lock.addEventListener("release", () => { wake.lock = null; });
  } catch (_) { /* denied or unsupported: nothing to do */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) keepAwake(); });

// ------------------------------------------------------------------ the loop
function stepOne() {
  const m = state.machine;
  let bits = state.heldKeys | state.heldTouch;
  if (state.script.length) {
    const s = state.script[0];
    bits = s.bits;
    if (--s.frames <= 0) state.script.shift();
  }
  m.setInput(bits);
  m.runFrames(1);
  state.pod.step(m);
  if (state.audio.ctx) state.audio.push(m.audio());
  else m.audio();                               // keep the core's ring drained
  state.frames++;
}

function present() {
  state.machine.paint(state.image.data);
  ctx2d.putImageData(state.image, 0, 0);
}

function pump(now, maxFrames) {
  if (!state.running) return 0;
  const target = Math.floor((now - state.t0) * 60 / 1000);
  let behind = target - state.frames;
  if (behind > RESYNC_AFTER) { state.t0 = now - state.frames * 1000 / 60; behind = 0; }
  let n = 0;
  while (state.frames < target && n < maxFrames) { stepOne(); n++; }
  if (n) present();
  state.fpsFrames += n;
  if (now - state.fpsT >= 1000) {
    state.fps = Math.round(state.fpsFrames * 1000 / (now - state.fpsT));
    state.fpsFrames = 0; state.fpsT = now;
    if (state.pod) setPodStatus(state.pod.state, state.pod);
  }
  return n;
}

function raf(now) {
  if (!state.running) return;
  state.lastPump = now;
  safePump(now, MAX_CATCHUP);
  requestAnimationFrame(raf);
}
function safePump(now, maxFrames) {
  try {
    pump(now, maxFrames);
  } catch (e) {
    log("player error: " + (e && e.stack || e));
    el.hint.textContent = "Emulation stopped: " + (e && e.message || e);
    stopLoop();
  }
}
// requestAnimationFrame stops in a hidden tab (and never fires in some embedded panes); this
// timer takes over whenever no animation frame has pumped for a while, so the console -- and
// its keep-alive PINGs to the server -- keep running.
function fallbackTick() {
  if (!state.running) return;
  const now = performance.now();
  if (now - state.lastPump > 45) { state.lastPump = now; safePump(now, 20); }
}

function startLoop() {
  state.running = true; state.frames = 0; state.t0 = performance.now(); state.fpsT = state.t0; state.fpsFrames = 0;
  state.lastPump = state.t0;
  requestAnimationFrame(raf);
  if (!state.fallbackTimer) state.fallbackTimer = setInterval(fallbackTick, 50);
  keepAwake();
}
function stopLoop() {
  state.running = false;
  if (state.fallbackTimer) { clearInterval(state.fallbackTimer); state.fallbackTimer = 0; }
}
document.addEventListener("visibilitychange", () => {
  // coming back from a throttled background tab: do not try to catch up on minutes of frames
  if (!document.hidden && state.running) state.t0 = performance.now() - state.frames * 1000 / 60;
});

// ------------------------------------------------------------------ canvas sizing
function fitCanvas() {
  const phone = document.body.classList.contains("touch") || window.innerWidth <= 700;
  if (phone) { el.canvas.style.width = "100%"; el.canvas.style.height = "auto"; return; }
  const availW = el.stage.clientWidth - 16;
  const availH = window.innerHeight - el.bar.offsetHeight - 70;
  const scale = Math.max(1, Math.floor(Math.min(availW / SCREEN_W, availH / SCREEN_H)));
  el.canvas.style.width = SCREEN_W * scale + "px";
  el.canvas.style.height = SCREEN_H * scale + "px";
}

// ------------------------------------------------------------------ input
const KEYS = { ArrowUp: BUTTONS.UP, ArrowDown: BUTTONS.DOWN, ArrowLeft: BUTTONS.LEFT, ArrowRight: BUTTONS.RIGHT,
  z: BUTTONS.A, Z: BUTTONS.A, x: BUTTONS.B, X: BUTTONS.B, Enter: BUTTONS.OPTION };
window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  const b = KEYS[e.key];
  if (!b) return;
  state.heldKeys |= b; e.preventDefault(); state.audio.start();
});
window.addEventListener("keyup", (e) => {
  const b = KEYS[e.key];
  if (!b) return;
  state.heldKeys &= ~b; e.preventDefault();
});
window.addEventListener("blur", () => { state.heldKeys = 0; });

// touch pad: every pointer owns a set of bits; held = OR of all of them
const pointers = new Map();
function recomputeTouch() {
  let bits = 0;
  for (const b of pointers.values()) bits |= b;
  state.heldTouch = bits;
  el.dpad.classList.toggle("d-up", !!(bits & BUTTONS.UP));
  el.dpad.classList.toggle("d-down", !!(bits & BUTTONS.DOWN));
  el.dpad.classList.toggle("d-left", !!(bits & BUTTONS.LEFT));
  el.dpad.classList.toggle("d-right", !!(bits & BUTTONS.RIGHT));
}
function dpadBits(ev) {
  const r = el.dpad.getBoundingClientRect();
  const dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
  const dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
  if (dx * dx + dy * dy < 0.04) return 0;
  let bits = 0;
  if (Math.abs(dx) > 0.38 * Math.abs(dy)) bits |= dx < 0 ? BUTTONS.LEFT : BUTTONS.RIGHT;
  if (Math.abs(dy) > 0.38 * Math.abs(dx)) bits |= dy < 0 ? BUTTONS.UP : BUTTONS.DOWN;
  return bits;
}
el.dpad.addEventListener("pointerdown", (e) => {
  e.preventDefault(); state.audio.start();
  pointers.set(e.pointerId, dpadBits(e)); recomputeTouch();
  try { el.dpad.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ }
});
el.dpad.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, dpadBits(e)); recomputeTouch();
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  el.dpad.addEventListener(type, (e) => { if (pointers.delete(e.pointerId)) recomputeTouch(); });
}
for (const btn of el.touch.querySelectorAll(".btn")) {
  const bits = Number(btn.dataset.bits);
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault(); state.audio.start();
    pointers.set(e.pointerId, bits); btn.classList.add("down"); recomputeTouch();
    try { btn.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    btn.addEventListener(type, (e) => { if (pointers.delete(e.pointerId)) { btn.classList.remove("down"); recomputeTouch(); } });
  }
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}
el.touch.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ toolbar
el.romFile.addEventListener("change", async () => {
  const f = el.romFile.files[0];
  if (f) setRom(new Uint8Array(await f.arrayBuffer()), f.name);
});
el.biosFile.addEventListener("change", async () => {
  const f = el.biosFile.files[0];
  if (!f) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes.length !== 65536) { el.biosState.textContent = "BIOS: " + f.name + " is not 64 KiB"; return; }
  state.bios = bytes; el.biosState.textContent = "BIOS: " + f.name + " (saved)"; el.biosState.style.color = "";
  await idb.set("bios", bytes.buffer);
  maybeStart();
});
el.serverUrl.value = localStorage.getItem(LS_SERVER) ?? DEFAULT_SERVER;
el.serverUrl.addEventListener("change", () => localStorage.setItem(LS_SERVER, el.serverUrl.value.trim()));
el.reconnect.addEventListener("click", () => {
  localStorage.setItem(LS_SERVER, el.serverUrl.value.trim());
  if (state.pod) state.pod.connect(el.serverUrl.value.trim());
});
el.reset.addEventListener("click", () => { if (state.rom && state.bios) start(); });
el.mute.addEventListener("click", () => {
  state.audio.start();
  state.audio.muted = !state.audio.muted;
  el.mute.classList.toggle("on", !state.audio.muted);
});
el.mute.classList.add("on");
el.logToggle.addEventListener("click", () => { el.log.hidden = !el.log.hidden; el.logToggle.classList.toggle("on", !el.log.hidden); });
el.canvas.addEventListener("pointerdown", () => state.audio.start());
window.addEventListener("resize", fitCanvas);

// ------------------------------------------------------------------ debug / test API
window.ngp = {
  get machine() { return state.machine; },
  get pod() { return state.pod; },
  get frames() { return state.frames; },
  BUTTONS,
  /** Queue a scripted button hold (bits or name) for n frames, then a gap of released frames. */
  press(button, hold = 6, gap = 8) {
    const bits = typeof button === "string" ? BUTTONS[button.toUpperCase()] : button;
    state.script.push({ bits, frames: hold });
    if (gap) state.script.push({ bits: 0, frames: gap });
  },
  screen() { return state.machine ? state.machine.scr1Text() : []; },
  loadRom(bytes, name) { setRom(new Uint8Array(bytes), name || "rom.ngc", false); },
  async loadRomUrl(url) { const r = await fetch(url); setRom(new Uint8Array(await r.arrayBuffer()), url.split("/").pop(), false); },
};

// ------------------------------------------------------------------ boot
(async function main() {
  const q = new URL(location.href).searchParams;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (q.get("touch") === "1" || (coarse && q.get("touch") !== "0")) document.body.classList.add("touch");
  fitCanvas();
  await loadBios();
  if (!(await loadRomFromQuery())) {
    const saved = await idb.get("rom");
    if (saved && saved.bytes) setRom(new Uint8Array(saved.bytes), saved.name, false);
    else maybeStart();                            // shows the "pick a ROM" hint
  }
  fitCanvas();
})();
