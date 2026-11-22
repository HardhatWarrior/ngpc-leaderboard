/* IPS patching + CRC32, client-side (no ROM ever leaves the browser). Used by /patches/ and /patches/upload/. */
(function (root) {
  "use strict";
  var table = null;
  function crc32(b) {
    if (!table) { table = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; } }
    var r = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) r = table[(r ^ b[i]) & 0xFF] ^ (r >>> 8);
    return ((r ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  /* Checks the file is a well-formed IPS patch. Returns {records, maxEnd, truncate} or throws. */
  function parseIps(p) {
    if (p.length < 8 || String.fromCharCode(p[0], p[1], p[2], p[3], p[4]) !== "PATCH") throw new Error("this is not an IPS patch (it does not start with PATCH)");
    var o = 5, records = 0, maxEnd = 0, truncate = null;
    for (;;) {
      if (o + 3 > p.length) throw new Error("the patch ends without an EOF marker (damaged or cut off)");
      if (p[o] === 0x45 && p[o + 1] === 0x4F && p[o + 2] === 0x46) {            /* "EOF" */
        if (o + 3 + 3 <= p.length && o + 3 + 3 === p.length) truncate = (p[o + 3] << 16) | (p[o + 4] << 8) | p[o + 5];
        break;
      }
      var off = (p[o] << 16) | (p[o + 1] << 8) | p[o + 2], size = (p[o + 3] << 8) | p[o + 4]; o += 5;
      if (size === 0) { if (o + 3 > p.length) throw new Error("the patch is damaged"); size = (p[o] << 8) | p[o + 1]; o += 3; if (off + size > maxEnd) maxEnd = off + size; }
      else { if (o + size > p.length) throw new Error("the patch is damaged"); o += size; if (off + size > maxEnd) maxEnd = off + size; }
      records++;
    }
    return { records: records, maxEnd: maxEnd, truncate: truncate };
  }

  function applyIps(rom, p) {
    var info = parseIps(p), size = Math.max(rom.length, info.maxEnd), out = new Uint8Array(size);
    out.set(rom, 0);
    var o = 5;
    for (;;) {
      if (p[o] === 0x45 && p[o + 1] === 0x4F && p[o + 2] === 0x46) break;
      var off = (p[o] << 16) | (p[o + 1] << 8) | p[o + 2], n = (p[o + 3] << 8) | p[o + 4]; o += 5;
      if (n === 0) { var rl = (p[o] << 8) | p[o + 1], v = p[o + 2]; o += 3; out.fill(v, off, off + rl); }
      else { out.set(p.subarray(o, o + n), off); o += n; }
    }
    return info.truncate !== null && info.truncate < out.length ? out.subarray(0, info.truncate) : out;
  }

  var api = { crc32: crc32, parseIps: parseIps, applyIps: applyIps };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NgpcIps = api;
})(typeof window !== "undefined" ? window : this);
