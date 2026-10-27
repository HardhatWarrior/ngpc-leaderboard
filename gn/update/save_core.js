
(function (root) {
  "use strict";
  var ROM_SIZE = 0x200000, B32 = 0x1F8000, B33 = 0x1FA000, BLK = 0x2000;
  var REC_SIZE = 64, V1_REC = 40, SUSP_SIZE = 164, V3_SUSP_OFF = 348, V3_DISC_OFF = 204, V3_DISC = 48;
  var ERAS = { 1: "nocturne_01-02", 2: "nocturne_03-11", 3: "nocturne_12-18", 4: "nocturne_19-45",
               5: "nocturne_46 or later" };
  var V5_TAG = [0x47, 0x4E, 0x2D, 0x53, 0x41, 0x56, 0x45, 0x2D, 0x56, 0x35];
  function isV5Rom(rom) {
    var n = Math.min(rom.length, B32) - V5_TAG.length, i, k;
    for (i = 0; i <= n; i++) {
      if (rom[i] !== 0x47) continue;
      for (k = 1; k < V5_TAG.length && rom[i + k] === V5_TAG[k]; k++) ;
      if (k === V5_TAG.length) return true;
    }
    return false;
  }
  function saveLen(v) { return v === 5 ? 1024 : (v === 3 || v === 4) ? 512 : 256; }
  function slotVersion(b, s) {
    var o = s * 256;
    if (b[o] !== 0xCA || b[o + 1] !== 0xFE || b[o + 2] !== 0x20 || b[o + 3] !== 0x26) return 0;
    if (b[o + 4] !== 0x47 || b[o + 5] !== 0x4E) return 0;
    return b[o + 6];
  }
  function slotSave(b, s) {
    var v = slotVersion(b, s), p;
    if ((s & 3) && slotVersion(b, s & ~3) === 5) return 0;
    if (v === 5) return (s & 3) ? 0 : v;
    if (v === 3 || v === 4) return (s & 1) ? 0 : v;
    if (v !== 1 && v !== 2) return 0;
    if (s & 1) { p = slotVersion(b, s - 1); if (p === 3 || p === 4) return 0; }
    return v;
  }
  function sum16(buf, o, n) {
    var s = 0;
    for (var i = 4; i < (n || 512); i++) if (i !== o && i !== o + 1) s += buf[i];
    return s & 0xFFFF;
  }
  function sum8(buf, end) { var s = 0; for (var i = 4; i < end; i++) s += buf[i]; return s & 0xFF; }
  function checksumOk(buf, v) {
    if (v >= 3 && v <= 5) { var o = v === 3 ? 200 : 72; return (buf[o] | (buf[o + 1] << 8)) === sum16(buf, o, saveLen(v)); }
    var end = v === 2 ? 200 : 128;
    return buf[end] === sum8(buf, end);
  }
  function fixChecksum(buf, v) {
    if (v >= 3 && v <= 5) { var o = v === 3 ? 200 : 72, s = sum16(buf, o, saveLen(v)); buf[o] = s & 0xFF; buf[o + 1] = s >> 8; }
    else { var end = v === 2 ? 200 : 128; buf[end] = sum8(buf, end); }
  }
  function newest(b) {
    for (var s = 31; s >= 0; s--) {
      var v = slotSave(b, s);
      if (!v) continue;
      var n = saveLen(v);
      var buf = new Uint8Array(b.subarray(s * 256, s * 256 + n));
      if (buf.length === n && checksumOk(buf, v)) return { slot: s, v: v, buf: buf };
    }
    return null;
  }
  function recOff(v, i) { return 8 + i * (v === 1 ? V1_REC : REC_SIZE); }
  function rotSum(p, n, s) {
    for (var i = 0; i < n; i++) s = ((((s << 1) | (s >>> 15)) & 0xFFFF) + p[i]) & 0xFFFF;
    return s;
  }
  function suspOk(sp) {
    return sp[0] === 0x53 && sp[1] === 0x55 && sp[2] === 1 && (sp[162] | (sp[163] << 8)) === rotSum(sp, 162, 0x4E53);
  }
  function same(b, s, t, o, n) {
    for (var k = 0; k < n; k++) if (b[s * 256 + o + k] !== b[t * 256 + o + k]) return false;
    return true;
  }
  function oldPick(b, s, v, buf) {
    var used = [0, 1, 2].map(function (i) { return buf[recOff(v, i)] === 1; });
    var cnt = used.filter(Boolean).length, i, t;
    if (cnt < 2) return cnt ? used.indexOf(true) : null;
    var n = v === 1 ? V1_REC : REC_SIZE;
    for (t = s - 1; t >= 0; t--) {
      if (slotSave(b, t) !== v) continue;
      for (i = 0; i < 3; i++) if (used[i] && !same(b, s, t, recOff(v, i), n)) return i;
    }
    if (v === 3) {
      var sp = buf.subarray(V3_SUSP_OFF, V3_SUSP_OFF + SUSP_SIZE);
      if (suspOk(sp) && sp[3] < 3 && used[sp[3]]) return sp[3];
    }
    return used.indexOf(true);
  }
  function popc(x) { var c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
  function recInfo(buf, v, o) {
    return { lv: buf[o + 1], xp: buf[o + 2] | (buf[o + 3] << 8), gold: buf[o + 6] | (buf[o + 7] << 8),
             pieces: popc(buf[o + 9] & 15), ngp: v >= 3 ? buf[o + 59] : 0 };
  }
  function withInfo(base, info) { for (var k in info) base[k] = info[k]; return base; }
  function inspect(b) {
    var n = newest(b);
    if (!n) return null;
    var v = n.v, buf = n.buf, d = { version: v, slot: n.slot, era: ERAS[v] || "?", files: [] }, used, sp;
    if (v >= 5) { d.x8 = buf[648] & 1; d.ever = buf[649] & 0x3F; d.xq = Math.min(buf[656], 10); }
    if (v >= 5) { d.sv = buf[682] <= 2 ? buf[682] : 0; d.xse = buf[682] === 2 ? buf[851] & 1 : 0; }
    if (v >= 5) { d.pt = buf[1016] | (buf[1017] << 8); d.pts = buf[1018]; }
    if (v >= 4) {
      d.cart = buf[77] & 1;
      used = buf[8] === 1;
      sp = buf.subarray(208, 208 + SUSP_SIZE);
      d.files.push(withInfo({ file: 1, used: used, spot: used && suspOk(sp) }, used ? recInfo(buf, v, 8) : {}));
      d.pick = used ? 1 : null;
      return d;
    }
    for (var i = 0; i < 3; i++) {
      var o = recOff(v, i), spot = false;
      used = buf[o] === 1;
      if (v === 3) { sp = buf.subarray(V3_SUSP_OFF, V3_SUSP_OFF + SUSP_SIZE); spot = used && suspOk(sp) && sp[3] === i; }
      d.files.push(withInfo({ file: i + 1, used: used, spot: spot }, used ? recInfo(buf, v, o) : {}));
    }
    var k = oldPick(b, n.slot, v, buf);
    d.pick = k === null ? null : k + 1;
    return d;
  }
  function toV5(buf) {
    var nb = new Uint8Array(1024);
    nb.set(buf.subarray(0, 512), 0);
    nb[6] = 5;
    fixChecksum(nb, 5);
    return nb;
  }
  function saveBlock(b, slot, v5) {
    var n = newest(b);
    if (!n) throw new Error("no Nocturne save in this ROM");
    var v = n.v, buf = n.buf, d = inspect(b), out = new Uint8Array(BLK).fill(0xFF), i, o;
    if (slot === undefined) slot = null;
    if (v >= 4) {
      if (slot !== null && slot !== 1) throw new Error("this save (v" + v + ", " + d.era + ") holds one tale: there is no FILE " + slot);
      if (buf[8] !== 1) throw new Error("the save holds no tale (erased)");
      if (v === 5 && !v5) throw new Error("this save needs a newer build");
      out.set((v === 4 && v5) ? toV5(buf) : buf, 0);
      return { block: out, info: d, kept: 1 };
    }
    var k = slot === null ? d.pick : slot;
    if (k === null) throw new Error("no FILE is used in this save");
    if (!(k >= 1 && k <= 3) || !d.files[k - 1].used) {
      var u = d.files.filter(function (f) { return f.used; }).map(function (f) { return String(f.file); }).join(", ");
      throw new Error("FILE " + k + " is empty (used: " + (u || "none") + ")");
    }
    k -= 1;
    var nb = new Uint8Array(buf), rs = v === 1 ? V1_REC : REC_SIZE;
    for (i = 0; i < 3; i++) {
      if (i === k) continue;
      o = recOff(v, i);
      nb.fill(0, o, o + rs);
      if (v === 3) nb.fill(0, V3_DISC_OFF + i * V3_DISC, V3_DISC_OFF + (i + 1) * V3_DISC);
    }
    if (v === 3) {
      var sp = nb.subarray(V3_SUSP_OFF, V3_SUSP_OFF + SUSP_SIZE);
      if (!(suspOk(sp) && sp[3] === k)) nb.fill(0, V3_SUSP_OFF, V3_SUSP_OFF + SUSP_SIZE);
    }
    fixChecksum(nb, v);
    out.set(nb, 0);
    return { block: out, info: d, kept: k + 1 };
  }
  function blank(b, o) { for (var i = 0; i < BLK; i++) if (b[o + i] !== 0xFF) return false; return true; }
  var EC_MARK = 0x1F4000, EC_MAGIC = [0x47, 0x4E, 0x45, 0x43, 1, 0x5A, 0xA5, 0];
  function erasePending(rom) {
    if (rom.length < EC_MARK + EC_MAGIC.length) return false;
    for (var i = 0; i < EC_MAGIC.length; i++) if (rom[EC_MARK + i] !== EC_MAGIC[i]) return false;
    return true;
  }
  function romInfo(rom) { return rom.length >= B33 + BLK ? inspect(rom.subarray(B33, B33 + BLK)) : null; }
  function updateRom(old, nw, opt) {
    opt = opt || {};
    if (nw.length !== ROM_SIZE) throw new Error("the new build must be a full 2 MB Nocturne ROM");
    if (old.length < B33 + BLK) throw new Error("the old ROM is shorter than 2 MB: no save block in it");
    if (erasePending(old)) throw new Error("the old cart was being erased (ERASE CART): it is wiped at its next boot - nothing to move");
    if (!opt.force && !blank(nw, B33)) throw new Error("the new ROM already holds a save");
    if (opt.content && !opt.force && !blank(nw, B32)) throw new Error("the new ROM already holds added content");
    var r = saveBlock(old.subarray(B33, B33 + BLK), opt.slot === undefined ? null : opt.slot, isV5Rom(nw));
    var out = new Uint8Array(nw);
    out.set(r.block, B33);
    if (opt.content) out.set(old.subarray(B32, B32 + BLK), B32);
    return { rom: out, info: r.info, kept: r.kept };
  }
  function hasContent(rom) { return rom.length >= B32 + BLK && !blank(rom, B32); }
  var api = { inspect: inspect, saveBlock: saveBlock, updateRom: updateRom, romInfo: romInfo, hasContent: hasContent, isV5Rom: isV5Rom,
              ROM_SIZE: ROM_SIZE, B32: B32, B33: B33, BLK: BLK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NocturneSaveCore = api;
})(typeof window !== "undefined" ? window : this);
