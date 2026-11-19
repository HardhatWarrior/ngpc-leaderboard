/* Generic NGPC save updater core (same logic as _Tools/ngpc_save_update.py).
 *
 * Every ngpc-dev.com game keeps its save inside the 16 Mbit cart image:
 *   block 33 (0x1FA000, 8 KB): ngpc_flash.c's append-only slots (magic CA FE 20 26, then the game's own data),
 *   block 32 (0x1F8000, 8 KB): the multipack journal's second block ('PPJ1' records) and Nocturne's added content.
 * Flashing a new build rewrites the whole image, so those blocks are copied byte for byte from a dump of the
 * old cart into the new build. The game's own loader then reads (and, if its format grew, upgrades) the save
 * exactly as if the cart had been updated in place. Block 34+ (0x1FC000, the system area) is never touched. */
(function (root) {
  "use strict";
  var ROM_SIZE = 0x200000, B32 = 0x1F8000, B33 = 0x1FA000, BLK = 0x2000;

  function blank(b, o) { for (var i = 0; i < BLK; i++) if (b[o + i] !== 0xFF) return false; return true; }
  function at(b, o, s) { for (var i = 0; i < s.length; i++) if (b[o + i] !== s[i]) return false; return true; }
  var MAGIC = [0xCA, 0xFE, 0x20, 0x26], PPJ = [0x50, 0x50, 0x4A, 0x31];

  /* what the save blocks of a dump hold */
  function inspect(rom) {
    if (rom.length < B33 + BLK) return null;
    var d = { b32: !blank(rom, B32), b33: !blank(rom, B33), records: 0, tags: {}, journal: 0 }, o, t, c, rs;
    for (o = B33; o < B33 + BLK; o += 256) {
      if (!at(rom, o, MAGIC)) continue;
      d.records++;
      c = [rom[o + 4], rom[o + 5]];
      t = (c[0] >= 0x20 && c[0] < 0x7F && c[1] >= 0x20 && c[1] < 0x7F) ? String.fromCharCode(c[0], c[1]) : null;
      if (t) d.tags[t] = (d.tags[t] || 0) + 1;
    }
    for (rs = 512; rs <= 1024; rs *= 2)                     /* multipack journal records: tag at rec + size - 16 */
      for (o = B32; o < B33 + BLK; o += rs) if (at(rom, o + rs - 16, PPJ)) d.journal++;
    d.kind = d.journal ? "multipack" : d.records ? "game" : (d.b33 || d.b32) ? "unknown" : "none";
    d.tagList = Object.keys(d.tags);
    return d;
  }

  /* old: the old cart's dump; nw: the new build (padded to 2 MB here if shorter). -> { rom, info, copied32, padded } */
  function updateRom(old, nw, opt) {
    opt = opt || {};
    if (old.length < B33 + BLK) throw new Error("the old ROM is shorter than 2 MB, so it holds no save: read the WHOLE cart (2 MB) with your flasher");
    if (nw.length > ROM_SIZE) throw new Error("the new build is larger than 2 MB");
    var info = inspect(old);
    if (!info.b33 && !info.b32) throw new Error("the old ROM's save blocks are empty: there is no save to carry");
    var out = new Uint8Array(ROM_SIZE).fill(0xFF), padded = nw.length < ROM_SIZE;
    out.set(nw, 0);
    if (!opt.force && !blank(out, B33)) throw new Error("the new build already holds a save (or data where the save goes): use a fresh copy of the build");
    out.set(old.subarray(B33, B33 + BLK), B33);
    var copied32 = false;
    if (info.b32) {
      if (blank(out, B32) || opt.force) { out.set(old.subarray(B32, B32 + BLK), B32); copied32 = true; }
    }
    return { rom: out, info: info, copied32: copied32, padded: padded, skipped32: info.b32 && !copied32 };
  }

  var api = { inspect: inspect, updateRom: updateRom, ROM_SIZE: ROM_SIZE, B32: B32, B33: B33, BLK: BLK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NgpcSaveCore = api;
})(typeof window !== "undefined" ? window : this);
