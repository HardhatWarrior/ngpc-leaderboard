// pod.js - the NgpNet "pod" in JavaScript: the box that would sit on the console's EXT port.
//
// Port of NgpNetDemo/tools/emu_bridge.py (Deframer, wrap, crc8, Bridge.step):
//   console TX bytes --deframe [len][frame][crc8]--> one binary WebSocket message per frame
//   WebSocket messages --wrap the same way--> queued, fed to the console <= 32 bytes per
//   60 Hz frame (about 19200 bps) while its RTS allows. The peer is declared present (CTS low).
// Works in a browser and in Node >= 22 (global WebSocket).

export const OPNAME = {
  0x01: "HELLO", 0x02: "LIST", 0x03: "CREATE", 0x04: "JOIN", 0x05: "LEAVE", 0x06: "DATA", 0x07: "PING",
  0x10: "W_ENTER", 0x11: "W_INPUT", 0x12: "W_SAY", 0x81: "WELCOME", 0x82: "ROOMS", 0x83: "ROOM",
  0x84: "PEER", 0x86: "RDATA", 0x87: "PONG", 0x90: "W_ZONE", 0x91: "W_SELF", 0x92: "W_ENTS",
  0x93: "W_CHAT", 0xff: "ERR",
};

export const BYTES_PER_FRAME = 32;   // ~ one 60 Hz frame of 19200 8N1
// Resuming a room after the socket drops (phone locked, app switched): the server keeps the slot
// for GRACE_MS (NgpNet/server/src/server.js) and a HELLO with the same token takes it back.
export const GRACE_MS = 90000;
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];   // then every 30 s until the grace is spent
export const RX_SILENCE_MS = 25000;  // in a room, no server frame for this long -> the socket is dead (half-open), reconnect

export function crc8(data) {
  let c = 0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

export function wrap(frame) {
  if (frame.length < 1 || frame.length > 255) throw new Error("frame length " + frame.length + " out of 1..255");
  const out = new Uint8Array(frame.length + 2);
  out[0] = frame.length;
  out.set(frame, 1);
  out[frame.length + 1] = crc8(frame);
  return out;
}

export class Deframer {
  constructor() { this.buf = []; this.bad = 0; }
  feed(data) {
    for (let i = 0; i < data.length; i++) this.buf.push(data[i]);
    const out = [];
    while (this.buf.length) {
      const n = this.buf[0];
      if (n === 0) { this.buf.shift(); continue; }
      if (this.buf.length < n + 2) break;
      const frame = Uint8Array.from(this.buf.slice(1, 1 + n));
      if (crc8(frame) === this.buf[1 + n]) {
        out.push(frame);
        this.buf.splice(0, n + 2);
      } else {
        this.bad++;
        this.buf.shift();                       // resync one byte at a time
      }
    }
    return out;
  }
}

function hex(bytes, max = 12) {
  let s = "";
  for (let i = 0; i < Math.min(bytes.length, max); i++) s += bytes[i].toString(16).padStart(2, "0");
  return s + (bytes.length > max ? "..." : "");
}

export class Pod {
  /**
   * @param {object} opts
   * @param {string}   opts.url       wss://... (empty = offline, no socket)
   * @param {function} [opts.onStatus] (state: "idle"|"connecting"|"connected"|"reconnecting"|"closed"|"error", pod, detail)
   * @param {function} [opts.onLog]    (text)
   * @param {function} [opts.onRooms]  (rooms: [{code, players, max}]) replies to listRooms()
   * @param {boolean}  [opts.quiet]    do not log every frame
   */
  constructor(opts = {}) {
    this.url = opts.url || "";
    this.onStatus = opts.onStatus || (() => {});
    this.onLog = opts.onLog || (() => {});
    this.onRooms = opts.onRooms || (() => {});
    this.quiet = !!opts.quiet;
    this.helloSeen = false;                     // the console has introduced itself on this socket
    this.pendingList = 0;                       // LIST frames the PAGE sent (their ROOMS replies stay here)
    this.pendingHello = 0;                      // HELLO frames the POD sent (their WELCOME replies stay here)
    this.room = "";                             // code of the room the console is in, "" outside
    this.lastHello = null;                      // the console's last HELLO frame, replayed after a reconnect
    this.lastRx = 0;                            // Date.now() of the last server frame
    this.retry = { timer: 0, attempt: 0, since: 0 };   // reconnect backoff while in a room
    this.ws = null;
    this.state = "idle";
    this.deframer = new Deframer();
    this.toConsole = [];                        // bytes waiting for the wire
    this.inbox = [];                            // messages arrived, not yet logged/queued
    this.seen = { WELCOME: false, zone_parts: 0, PONG: 0, tx: 0, rx: 0, lastOp: "" };
    this.frame = 0;
  }

  _set(state, detail) {
    this.state = state;
    this.onStatus(state, this, detail || "");
  }

  /** A fresh session: the console starts over with HELLO. */
  connect(url = this.url) {
    this.close();
    this.url = url || "";
    this.deframer = new Deframer();
    this.toConsole.length = 0;
    this.inbox.length = 0;
    this.seen = { WELCOME: false, zone_parts: 0, PONG: 0, tx: 0, rx: 0, lastOp: "" };
    this.helloSeen = false; this.pendingList = 0; this.pendingHello = 0; this.room = ""; this.lastHello = null;
    if (!this.url) { this._set("idle"); return; }
    this._open(false);
  }

  /** Open the socket; `resume` replays the console's HELLO so the server hands its room slot back. */
  _open(resume) {
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      if (resume) return this._lost("open failed: " + String(e.message || e));
      this._set("error", String(e.message || e));
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.inbox.length = 0;
    this._set(resume ? "reconnecting" : "connecting", resume ? "attempt " + this.retry.attempt : "");
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.lastRx = Date.now();
      if (resume && this.lastHello) {
        ws.send(this.lastHello);
        this.pendingHello = 1;                  // exactly one WELCOME to swallow on this socket
        this.onLog("pod: reconnected after " + Math.round((Date.now() - this.retry.since) / 1000) +
          " s, HELLO replayed (room " + this.room + ")");
        this.retry.attempt = 0; this.retry.since = 0;
        this._set("connected", "resumed");
      } else {
        this._set("connected");
      }
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      const data = ev.data;
      this.lastRx = Date.now();
      if (data instanceof ArrayBuffer) this.inbox.push(new Uint8Array(data));
      else if (ArrayBuffer.isView(data)) this.inbox.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      // text frames are not part of the protocol; ignored
    };
    ws.onerror = () => { if (this.ws === ws && !this._resumable()) this._set("error", "socket error"); };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this._lost(ev && ev.code ? "code " + ev.code : "");
    };
  }

  /** The socket went away on its own. In a room: try to get the slot back before the server's grace runs out. */
  _lost(detail) {
    if (this._resumable()) {
      const r = this.retry;
      if (!r.since) r.since = Date.now();
      const delay = RECONNECT_DELAYS_MS[Math.min(r.attempt, RECONNECT_DELAYS_MS.length - 1)];
      if (Date.now() + delay - r.since <= GRACE_MS) {
        r.attempt++;
        this._set("reconnecting", "in " + Math.round(delay / 1000) + " s" + (detail ? ", " + detail : ""));
        r.timer = setTimeout(() => { r.timer = 0; if (!this.ws) this._open(true); }, delay);
        return;
      }
      this.onLog("pod: gave up resuming room " + this.room + " after " + Math.round((Date.now() - r.since) / 1000) + " s");
      this.room = ""; r.attempt = 0; r.since = 0;
    }
    this._set("closed", detail);
  }

  _resumable() { return !!this.url && !!this.room && !!this.lastHello; }

  /** Drop the socket without telling anyone, then treat it as lost (reconnects when in a room). */
  _dropSocket(detail) {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (_) { /* already gone */ }
    }
    this._lost(detail);
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (this.retry.timer) { clearTimeout(this.retry.timer); this.retry.timer = 0; }
    this.retry.attempt = 0; this.retry.since = 0;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (_) { /* already gone */ }
      this._set("closed");
    }
  }

  get connected() { return !!this.ws && this.ws.readyState === 1; }

  /** Ask the server for the open rooms (needs the console's HELLO first). The ROOMS reply goes to
   *  onRooms, not to the console. Returns false if it could not be sent. */
  listRooms() {
    if (!this.connected || !this.helloSeen) return false;
    this.ws.send(Uint8Array.from([0x02]));
    this.pendingList++;
    return true;
  }

  /** Wire the console up: serial on, peer present. Call once after machine.boot(). */
  attach(machine) {
    machine.serialSetEnabled(true);
    machine.declarePeer(true);
  }

  /** Call once per emulated frame, AFTER machine.runFrames(1). */
  step(machine) {
    const frame = this.frame++;
    // console -> server
    let tx = machine.serialReadTx(256);
    let all = tx;
    while (tx.length === 256) {
      tx = machine.serialReadTx(256);
      const merged = new Uint8Array(all.length + tx.length);
      merged.set(all); merged.set(tx, all.length);
      all = merged;
    }
    if (all.length) {
      for (const f of this.deframer.feed(all)) {
        this.seen.tx++;
        if (f[0] === 0x01) { this.helloSeen = true; this.lastHello = f; }
        else if (f[0] === 0x05) this.room = "";
        if (!this.quiet) this.onLog("[" + frame + "] >> " + (OPNAME[f[0]] || "0x" + f[0].toString(16)) + " " + hex(f.subarray(1), 24));
        if (this.connected) this.ws.send(f);
      }
    }
    // a socket the browser has not noticed is dead (phone just woke up): nothing from the server for too long
    if (this.connected && this.room && this.lastRx && Date.now() - this.lastRx > RX_SILENCE_MS) {
      this.onLog("pod: no server frame for " + Math.round((Date.now() - this.lastRx) / 1000) + " s, reconnecting");
      this._dropSocket("silent");
    }
    // server -> console: log, wrap, queue
    if (this.inbox.length) {
      for (const msg of this.inbox) {
        if (!msg.length || msg.length > 255) continue;
        if (msg[0] === 0x81 && this.pendingHello > 0) {  // WELCOME for the pod's own replayed HELLO
          this.pendingHello--;
          continue;
        }
        if (msg[0] === 0x82 && this.pendingList > 0) {   // ROOMS for the page's own LIST
          this.pendingList--;
          const rooms = [];
          for (let i = 0, p = 2; i < msg[1] && p + 6 <= msg.length; i++, p += 6) {
            rooms.push({ code: String.fromCharCode(msg[p], msg[p + 1], msg[p + 2], msg[p + 3]), players: msg[p + 4], max: msg[p + 5] });
          }
          this.onRooms(rooms);
          continue;
        }
        this.seen.rx++;
        const name = OPNAME[msg[0]] || "0x" + msg[0].toString(16);
        if (name === "ROOM" && msg.length >= 5) this.room = String.fromCharCode(msg[1], msg[2], msg[3], msg[4]);
        this.seen.lastOp = name;
        if (name === "WELCOME") {
          this.seen.WELCOME = true;
          // the console may have said HELLO with token 0 (new account); the replay must carry the
          // token the server handed out, or the server would not know whose room slot to give back
          if (this.lastHello && this.lastHello.length >= 8 && msg.length >= 5) this.lastHello.set(msg.subarray(1, 5), 4);
        }
        else if (name === "W_ZONE") this.seen.zone_parts++;
        else if (name === "PONG") this.seen.PONG++;
        if (!this.quiet && name !== "W_ENTS") this.onLog("[" + frame + "] << " + name + " " + hex(msg.subarray(1)));
        const w = wrap(msg);
        for (let i = 0; i < w.length; i++) this.toConsole.push(w[i]);
      }
      this.inbox.length = 0;
    }
    // ...then paced onto the wire while RTS allows
    if (this.toConsole.length && machine.serialRts()) {
      const n = Math.min(BYTES_PER_FRAME, this.toConsole.length);
      machine.serialWriteRx(Uint8Array.from(this.toConsole.splice(0, n)));
    }
  }

  summary() {
    const s = this.seen;
    return "in " + s.rx + " / out " + s.tx + (this.deframer.bad ? " / bad crc " + this.deframer.bad : "");
  }
}
