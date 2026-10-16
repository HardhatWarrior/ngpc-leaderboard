// machine.js - one emulated Neo Geo Pocket Color on top of the NgpCraft core (WebAssembly).
//
// Thin mirror of the C ABI in NgpCraft_MCP-main/vendor/emulator/cpp/include/ngpc_core.h,
// used the same way vendor/emulator/core/native.py uses it. Works in a browser and in Node.

export const SCREEN_W = 160;
export const SCREEN_H = 152;
export const AUDIO_HZ = 44100;

export const BUTTONS = { UP: 0x01, DOWN: 0x02, LEFT: 0x04, RIGHT: 0x08, A: 0x10, B: 0x20, OPTION: 0x40 };

const RESET_HANDOFF = 1;
const SILICON_TIMING = { word_wait: 10, bios_wait: 8 };   // ngpc_native.py SILICON_TIMING
const INSTRS_PER_FRAME_BUDGET = 200000;                    // native.py run_frames backstop
const SUMMARY_BYTES = 128;                                 // >= sizeof(ngpc_summary_t)
const SUMMARY_STOP_STATUS = 20;                            // offsetof(stop_status)

let modulePromise = null;

/** Load (once) the Emscripten module. `factory` is the default export of ngpc_core.js. */
export function loadCore(factory, options = {}) {
  if (!modulePromise) modulePromise = factory(options);
  return modulePromise;
}

export class Machine {
  /**
   * @param {object} M      the instantiated Emscripten module
   * @param {Uint8Array} rom
   * @param {Uint8Array} bios  64 KiB bios.bin
   */
  constructor(M, rom, bios) {
    this.M = M;
    this.h = M._ngpc_create();
    if (!this.h) throw new Error("ngpc_create() returned NULL");
    this._with(rom, (p) => {
      if (M._ngpc_load_rom(this.h, p, rom.length) !== 0) throw new Error("ngpc_load_rom rejected the ROM");
    });
    if (bios) {
      this._with(bios, (p) => {
        if (M._ngpc_load_bios(this.h, p, bios.length) !== 0) throw new Error("ngpc_load_bios rejected the BIOS");
      });
    }
    // scratch buffers that live for the machine's lifetime
    this.fbPtr = M._malloc(SCREEN_W * SCREEN_H * 2);
    this.audioFrames = 8192;
    this.audioPtr = M._malloc(this.audioFrames * 4);
    this.ioPtr = M._malloc(4096);
    this.summaryPtr = M._malloc(SUMMARY_BYTES);
    this.frame = 0;
    this.lastStopStatus = 0;
  }

  _with(bytes, fn) {
    const M = this.M;
    const p = M._malloc(bytes.length);
    try {
      M.HEAPU8.set(bytes, p);
      return fn(p);
    } finally {
      M._free(p);
    }
  }

  /** apply_timing(m, "silicon") + reset(bios_handoff=True), as emu_bridge.py does. */
  boot() {
    const M = this.M;
    M._ngpc_set_timing_silicon(this.h, SILICON_TIMING.word_wait, SILICON_TIMING.bios_wait);
    M._ngpc_reset(this.h, RESET_HANDOFF);
    this.frame = 0;
  }

  destroy() {
    const M = this.M;
    if (!this.h) return;
    M._ngpc_destroy(this.h);
    M._free(this.fbPtr); M._free(this.audioPtr); M._free(this.ioPtr); M._free(this.summaryPtr);
    this.h = 0;
  }

  /** Controller byte at 0x00B0 (bit0 up ... bit6 option). */
  setInput(bits) {
    this.M.HEAPU8[this.ioPtr] = bits & 0x7f;
    this.M._ngpc_write_mem(this.h, 0x00b0, this.ioPtr, 1);
  }

  runFrames(n = 1) {
    const M = this.M;
    M._ngpc_run_frames(this.h, n, n * INSTRS_PER_FRAME_BUDGET, this.summaryPtr);
    this.lastStopStatus = M.HEAPU8[this.summaryPtr + SUMMARY_STOP_STATUS];
    this.frame += n;
    return this.lastStopStatus;
  }

  /** Raw 12-bit 0BGR pixels, SCREEN_W*SCREEN_H of them (a view into the wasm heap: copy if you keep it). */
  framebuffer() {
    const M = this.M;
    const n = M._ngpc_get_framebuffer(this.h, this.fbPtr, SCREEN_W * SCREEN_H);
    return M.HEAPU16.subarray(this.fbPtr >> 1, (this.fbPtr >> 1) + n);
  }

  /** Paint the picture into an RGBA Uint8ClampedArray (ImageData.data). */
  paint(rgba) {
    const fb = this.framebuffer();
    for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
      const p = fb[i];
      rgba[j] = (p & 0x0f) * 17;
      rgba[j + 1] = ((p >> 4) & 0x0f) * 17;
      rgba[j + 2] = ((p >> 8) & 0x0f) * 17;
      rgba[j + 3] = 255;
    }
  }

  /** Drain up to `max` stereo frames: Int16Array view, interleaved L,R at 44100 Hz. */
  audio(max = this.audioFrames) {
    const M = this.M;
    const got = M._ngpc_get_audio(this.h, this.audioPtr, Math.min(max, this.audioFrames));
    return M.HEAP16.subarray(this.audioPtr >> 1, (this.audioPtr >> 1) + got * 2);
  }

  audioDropped() { return Number(this.M._ngpc_audio_dropped(this.h)); }

  read(addr, n) {
    const M = this.M;
    const out = new Uint8Array(n);
    for (let off = 0; off < n; off += 4096) {
      const k = Math.min(4096, n - off);
      M._ngpc_read_mem(this.h, addr + off, this.ioPtr, k);
      out.set(M.HEAPU8.subarray(this.ioPtr, this.ioPtr + k), off);
    }
    return out;
  }

  write(addr, bytes) {
    const M = this.M;
    for (let off = 0; off < bytes.length; off += 4096) {
      const k = Math.min(4096, bytes.length - off);
      M.HEAPU8.set(bytes.subarray(off, off + k), this.ioPtr);
      M._ngpc_write_mem(this.h, addr + off, this.ioPtr, k);
    }
  }

  // --- link cable (serial channel 0): the pod sits at the other end ---------------
  serialSetEnabled(on) { this.M._ngpc_serial_set_enabled(this.h, on ? 1 : 0); }
  /** Bytes the console transmitted since the last call (copy). */
  serialReadTx(max = 256) {
    const M = this.M;
    const n = M._ngpc_serial_read_tx(this.h, this.ioPtr, max);
    return M.HEAPU8.slice(this.ioPtr, this.ioPtr + n);
  }
  serialWriteRx(bytes) {
    if (!bytes.length) return;
    this.M.HEAPU8.set(bytes, this.ioPtr);
    this.M._ngpc_serial_write_rx(this.h, this.ioPtr, bytes.length);
  }
  /** true when the console is ready to receive (RTS low). */
  serialRts() { return this.M._ngpc_serial_rts(this.h) !== 0; }
  /** Drive the console's CTS input. link.py declare_peer(present) == serialSetCts(!present). */
  serialSetCts(high) { this.M._ngpc_serial_set_cts(this.h, high ? 1 : 0); }
  declarePeer(present) { this.serialSetCts(!present); }

  /** SCR1 tilemap as 19 rows of 20 ASCII chars (emu_bridge.scr1_text). */
  scr1Text() {
    const rows = [];
    for (let y = 0; y < 19; y++) {
      const d = this.read(0x9000 + y * 64, 40);
      let line = "";
      for (let x = 0; x < 20; x++) {
        const t = d[x * 2] | ((d[x * 2 + 1] & 1) << 8);
        line += t >= 32 && t < 127 ? String.fromCharCode(t) : " ";
      }
      rows.push(line.replace(/\s+$/, ""));
    }
    return rows;
  }
}
