/* Neo Turf Masters (NGPC) shot simulator -- JavaScript port of TurfMastersLB/physics (sim.py, cup.py, terrain.py,
 * launch.py, shot.py, th1.py). Bit-exact with the Python model (checked by test_sim.js against Python vectors), which
 * is itself bit-exact against the game. Data: tm_phys.json (ROM physics window) + tm_c<k>.json (holes).
 * Works in node (module.exports) and the browser (window.TMSim). */
(function (root) {
'use strict';
// ---------------------------------------------------------------- integer helpers (Python semantics)
const B = BigInt;
const fl = Math.floor;
function sra(a, n) { return fl(a / 2 ** n); }                 // Python a >> n (floor) for |a| < 2^53
function shl(a, n) { return a * 2 ** n; }
function mul(a, b) {                                          // 0x20D1E9
  const aa = Math.abs(a), ab = Math.abs(b);
  if (aa <= 0x10000 && ab <= 0x10000) {
    let m;
    if (ab === 0x10000) m = aa; else if (aa === 0x10000) m = ab; else m = fl(aa * ab / 65536);
    return ((a < 0) !== (b < 0)) ? -m : m;
  }
  return Number((B(a) * B(b)) >> 16n);
}
function udiv(a, b) {                                         // 0x20D282
  if (a === 0) return 0; if (b === 0) b = 1;
  return Number(((B(a) << 16n) / B(b)) & 0xFFFFFFFFn);
}
function div(a, b) { const q = udiv(Math.abs(a), Math.abs(b)); return ((a < 0) !== (b < 0)) ? -q : q; }
function umul(a, b) { return Number(((B(a) * B(b)) >> 16n) & 0xFFFFFFFFn); }
function isqrtHypot(x, y) {                                   // 0x20D024
  let a = Math.abs(x), b = Math.abs(y);
  if (a > b) { const t = a; a = b; b = t; }
  if (b === 0) return a;
  const step = (small, big) => {
    let r = udiv(small, big);
    if (r !== 0x10000) r = fl((r & 0xFFFF) * (r & 0xFFFF) / 65536);
    return udiv(r, r + 0x40000);
  };
  const q = step(a, b);
  const m1 = b + umul(q + q, b);
  const u = umul(a, q);
  const w = step(u, m1);
  return umul(w + w, m1) + m1;
}
function isqrt(x) {                                           // 0x20D146
  if (x === 0) return 0;
  let g = Math.max(Number(B(x) & 0xFFFFFFFFn), 0x10000);
  for (;;) { const n = fl(Number((B(udiv(x, g)) + B(g)) & 0xFFFFFFFFn) / 2); if (n >= g) return n; g = n; }
}

// ---------------------------------------------------------------- ROM physics window
let PH = null;                                                // {lo, bytes}
function b64(s) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s), o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o;
}
function setPhys(j) { PH = { lo: j.lo, b: b64(j.data) }; buildTables(); }
function u8(a) { const o = a - PH.lo; if (o < 0 || o >= PH.b.length) throw new Error('ROM read outside window ' + a.toString(16)); return PH.b[o]; }
function u16(a) { return u8(a) | (u8(a + 1) << 8); }
function s16(a) { const v = u16(a); return v >= 0x8000 ? v - 0x10000 : v; }
function u32(a) { return (u16(a) + u16(a + 2) * 65536); }
function s32(a) { const v = u32(a); return v >= 0x80000000 ? v - 0x100000000 : v; }
function ptr(a) { return u32(a) % 0x1000000; }
function cos(a) {                                             // 0x20D633 (returns -cos)
  a &= 0xFFF; let neg = 0;
  if (a > 0x800) a = (-a) & 0x7FF;
  if (a > 0x400) { neg = 1; a = (-a) & 0x3FF; }
  const v = s32(0x21D67B + 4 * (0x400 - a));
  return neg ? v : -v;
}
function sin(a) { return cos(a + 0x400); }

let TABLE, SLOPE, PARTS;
function buildTables() {
  TABLE = []; for (let k = 0; k < 12; k++) { const r = []; for (let i = 0; i < 4; i++) r.push(s32(0x221685 + 16 * k + 4 * i)); TABLE.push(r); }
  SLOPE = []; for (let k = 0; k < 16; k++) SLOPE.push(u16(0x22269C + 2 * k));
  PARTS = {};
  for (const t of [0, 4, 8]) {
    let p = s32(0x2226CB + t); const out = [];
    while (p && u16(p + 2) !== 0xFFFF) { out.push([s32(p), s32(p + 4), s32(p + 8), s32(p + 12)]); p += 16; }
    PARTS[t] = out;
  }
}
function SHAPE(ix, iy) { return u8(0x222783 + 49 * iy + ix); }

// ---------------------------------------------------------------- ball
const DRAG = 0x1D0, GRAVITY = 0xA000;
function newBall(k) {
  return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, lift: 0, wx: 0, wy: 0, cx: 0, cy: 0, ground: 0,
    top0: 0, top: 0, speed: 0, rolling: false, done: false, incup: false, bounces: 0, treeflags: 0, q: 0, result: null,
    shottype: 0, near_cup: false, stopped: false, tree_hit: false, surf: 0, slope: 0 }, k || {});
}
function curveVector(s) {                                     // 0x20EDA6
  const sp = isqrtHypot(s.vx, s.vy); s.speed = sp;
  if (sp === 0) { s.cx = s.cy = 0; return; }
  s.cx = Math.max(-0x10000, Math.min(0x10000, div(s.vx, sp)));
  s.cy = Math.max(-0x10000, Math.min(0x10000, div(s.vy, sp)));
}
function flightVelocity(s) {                                  // 0x20ECD7
  curveVector(s);
  let f;
  if (s.z < s.ground + 0x40000) f = 0; else if (s.z > 0x200000) f = 0x10000; else f = sra(s.z, 8) + 0xC000;
  const dx = mul(s.vx - mul(s.wx, f), DRAG);
  s.vx += mul(s.spin, s.cy) - dx;
  const dy = mul(s.vy - mul(s.wy, f), DRAG);
  s.vy -= mul(s.spin, s.cx) + dy;
  s.lift -= mul(s.lift, DRAG);
  s.vz += s.lift - GRAVITY;
}
function bounce(s, surf, e4) {                                // 0x20EB9D
  const t = TABLE[surf], fh = t[0], fv = t[1], fs = t[2];
  s.vz = -s.vz;
  s.vx = mul(s.vx, fh); s.vy = mul(s.vy, fh); s.spin = mul(s.spin, fh);
  s.vz = mul(fv, s.vz);
  s.lift = 0;
  const f8 = mul(sra(-s.top, 8), fs);
  s.vx += mul(f8, s.cx); s.vy += mul(f8, s.cy);
  const fc = mul(s.vx, s.cx) + mul(s.vy, s.cy);
  if (fc <= 0) {
    if (s.shottype === 2) { s.top0 = -s.top0; s.top = -s.top; if (fc === 0) s.top0 = s.top = s.spin = s.vx = s.vy = 0; }
    else s.top0 = s.top = s.spin = s.vx = s.vy = 0;
  }
  s.top0 = mul(s.top0, fh); s.top = mul(s.top, fh);
  s.x -= mul(s.vx, e4); s.y -= mul(s.vy, e4); s.z -= mul(s.vz, e4);
  if (s.z < s.ground) s.z = s.ground;
  if (surf !== 8) s.bounces += 1;
  if (s.bounces > 5 || s.vz <= 0x20000) { s.rolling = true; s.vz = 0; s.z = s.ground; }
}
function rollVelocity(s, surf, slope, putting, legend) {     // 0x20EF66 friction / slope / stop
  curveVector(s);
  let f = TABLE[surf][3];
  if (putting && surf !== 3) f = 0xC000;
  s.vx = mul(s.vx, f); s.vy = mul(s.vy, f);
  if (surf === 3 && (slope & 0xF) && !legend) {
    const k = SLOPE[slope & 0xF], a = (slope & 0xF0) << 4;
    s.vx += mul(sin(a), k); s.vy += mul(cos(a), k);
  }
  s.stopped = Math.abs(s.vx) <= 0x4000 && Math.abs(s.vy) <= 0x4000 && s.vz <= 0;
  if (s.stopped && !s.near_cup) s.vx = s.vy = s.vz = 0;
}

// ---------------------------------------------------------------- trees / flagstick
const C225 = 0xEC83, S225 = 0x61F7, C30 = 0xDDB4, S30 = 0x8000;
const TRUNK_R = { 0: 0x10000, 4: 0x10000, 8: 0x18000 };
function turn(vx, vy, c, sn, sign) {
  if (sign > 0) return [mul(vx, c) + mul(vy, -sn), mul(vx, sn) - mul(vy, -c)];
  return [mul(vx, c) + mul(vy, sn), -mul(vx, sn) - mul(vy, -c)];
}
function sector(c, t1, t2) {
  if (c >= t2) return 'rot+'; if (c >= t1) return 'swapneg'; if (c >= -t1) return 'neg'; if (c >= -t2) return 'swap'; return 'rot-';
}
function applyK(s, k, c, sn) {
  if (k === 'rot+') [s.vx, s.vy] = turn(s.vx, s.vy, c, sn, 1);
  else if (k === 'rot-') [s.vx, s.vy] = turn(s.vx, s.vy, c, sn, -1);
  else if (k === 'swapneg') [s.vx, s.vy] = [-s.vy, -s.vx];
  else if (k === 'neg') [s.vx, s.vy] = [-s.vx, -s.vy];
  else [s.vx, s.vy] = [s.vy, s.vx];
}
function treeHit(s, ttype, tx, ty, resp, pin) {
  s.spin = 0; s.top = 0; s.shottype = 0; s.tree_hit = true;
  const f = s.treeflags;
  if (resp === 0) {
    if (f & 1) return; s.treeflags = f | 1;
    const c = mul(s.cy, s.x - pin[0]) - mul(s.cx, s.y - pin[1]);
    const k = sector(c, 0x2000, 0x376D);
    if (k === 'rot+' || k === 'rot-') {
      const ovx = s.vx;
      if (k === 'rot+') { s.vx = mul(s.vx, C30) + mul(s.vy, -S30); s.vy = mul(S30, ovx) - mul(s.vy, -C30); }
      else { s.vx = mul(s.vx, C30) + mul(s.vy, S30); s.vy = mul(-S30, ovx) - mul(s.vy, -C30); }
    } else applyK(s, k, 0, 0);
    s.vx = mul(s.vx, 0x8000); s.vy = mul(s.vy, 0x8000);
  } else if (resp === 4) {
    if (f & 2) return; s.treeflags = f | 2;
    s.vx = sra(s.vx, 1); s.vy = sra(s.vy, 1);
    let c = mul(sra(s.vy, 4), s.x - tx) - mul(sra(s.vx, 4), s.y - ty);
    c = -c;
    applyK(s, sector(c, 0x187D, 0x3B20), C225, S225);
    curveVector(s);
    const dx = s.x - tx, dy = s.y - ty;
    const d = isqrt(mul(dx, dx) + mul(dy, dy));
    const kk = TRUNK_R[ttype] + 0x8000;
    if (s.speed !== 0) { s.x = mul(kk, s.cx) + tx; s.y = mul(kk, s.cy) + ty; }
    else if (d !== 0) { s.x = div(mul(dx, kk), d) + tx; s.y = div(mul(dy, kk), d) + ty; }
    else s.x += (s.x < pin[0]) ? kk : -kk;
  } else {
    if (f & 4) return; s.treeflags = f | 4;
    if (f & 2) return;
    s.vx = mul(s.vx, 0xF000); s.vy = mul(s.vy, 0xF000); s.vz = mul(s.vz, 0xF000);
  }
}
function treeTest(s, trees, pin) {
  for (const [ttype, tx, ty] of trees) {
    const dx = Math.abs(tx - s.x), dy = Math.abs(ty - s.y);
    if (dx >= 0xC0000 || dy >= 0xC0000) continue;
    for (const [zmin, zmax, r, resp] of PARTS[ttype] || []) {
      if (dy > r || dx > r || s.z < zmin || s.z > zmax) continue;
      if (shl(SHAPE(sra(shl(dx, 2), 16), sra(shl(dy, 2), 16)), 16) > r) continue;
      treeHit(s, ttype, tx, ty, resp, pin);
    }
  }
}

// ---------------------------------------------------------------- cup
const CR = 0x6000, LIP = 0x4000, FLOOR = -0xC000, CUP_R = 0x2000;
const dist = (s, pin) => isqrtHypot(pin[0] - s.x, pin[1] - s.y);
function radial(s, pin) { s.rad = mul(s.x - pin[0], s.cx) + mul(s.y - pin[1], s.cy); }
function unit(s, pin) { s.ux = s.uy = 0; if (s.d === 0) return; s.ux = div(s.x - pin[0], s.d); s.uy = div(s.y - pin[1], s.d); }
function lipDepth(s) { if (s.z >= 0) s.h = 0; else if (s.z <= -LIP) s.h = LIP; else { const t = LIP + s.z; s.h = isqrt(0x1000 - mul(t, t)); } }
function lateral(s, pin) { s.lat = mul(s.cy, pin[0] - s.x) - mul(s.cx, pin[1] - s.y); }
function rimK(s) { s.k = div(CR, s.h + s.d); }
function scaleAboutPin(s, pin) { s.x = mul(s.x - pin[0], s.k) + pin[0]; s.y = mul(s.y - pin[1], s.k) + pin[1]; s.z = mul(s.z, s.k); }
function stepToRim(s) { const f = div(CR - (s.d + s.h), s.speed); s.x += mul(f, s.vx); s.y += mul(f, s.vy); s.z += mul(f, s.vz); }
function overLip(s, pin) { lateral(s, pin); if (Math.abs(s.lat) > CR || s.d > CR) return false; s.vz -= 0x2800; lipDepth(s); return s.h + s.d >= CR; }
function tail(s, pin) { if (s.z > 0) return; s.d = dist(s, pin); if (s.d > CR) return; lipDepth(s); if (s.h + s.d < CR) return; rimK(s); scaleAboutPin(s, pin); }
function hitWall(s, pin) {
  rimK(s); s.h = mul(s.k, s.h);
  if (s.speed >= 0x8000 && Math.abs(s.lat) < 0x43E1) stepToRim(s); else scaleAboutPin(s, pin);
  const e = div(s.h, LIP), n = isqrt(0x10000 - mul(e, e));
  unit(s, pin);
  const p = mul(mul(mul(s.vx, s.ux) + mul(s.vy, s.uy), e), -0x20000);
  s.vx += mul(p, s.ux); s.vy += mul(p, s.uy);
  if (s.speed >= 0x4000 && s.z > -LIP) s.vz += mul(-p, n);
  tail(s, pin);
}
function lipSlide(s, pin) {
  if (s.vz <= 0 && s.z < -LIP) return hitWall(s, pin);
  let t = CR - s.d; t = mul(t, t);
  s.z = -(LIP - isqrt(0x1000 - t));
  if (s.speed < 0x4000) { unit(s, pin); const a = sra(div(mul(0x4000, s.vz), 0x4000), 1); s.vx += mul(a, s.ux); s.vy += mul(a, s.uy); }
  tail(s, pin);
}
function enter(s, pin) { if (!overLip(s, pin)) return; lipSlide(s, pin); }
function inside(s, pin) {
  if (!overLip(s, pin)) return;
  if (shl(-s.z, 3) <= 0x4000) { s.z = 0; return; }
  if (s.speed < 0x4000) return lipSlide(s, pin);
  hitWall(s, pin);
}
function groundFlat(s) { s.z = 0; s.vz = 0; }
const QT = [groundFlat, enter, inside, inside, inside, enter, inside, inside, inside, enter, inside, inside, inside, inside, enter, groundFlat];
function rim(s, pin) {                                        // 0x20F1D0
  s.d = dist(s, pin);
  if (s.d > 0x30000) { s.vz = 0; return null; }
  if (s.d <= CR && s.z <= -LIP) { s.incup = true; incupTick(s, pin); return 'incup'; }
  radial(s, pin);
  const prev = s.q;
  if (s.d >= CR) s.q = s.rad < 0 ? 0 : 3; else s.q = s.rad < 0 ? 1 : 2;
  QT[prev * 4 + s.q](s, pin);
  return null;
}
function wall(s, pin) {
  lipDepth(s); s.d = dist(s, pin);
  if (s.d < 0x2000) return;
  radial(s, pin);
  rimK(s); s.h = mul(s.h, s.k); s.d = mul(s.d, s.k);
  const g = s.speed ? div(mul(s.k - 0x10000, s.d), s.speed) : 0;
  s.x += mul(s.vx, g); s.y += mul(s.vy, g);
  s.d = dist(s, pin); unit(s, pin);
  s.vx = mul(mul(s.ux, s.speed), -0xC000); s.vy = mul(mul(s.uy, s.speed), -0xC000);
  s.x -= mul(s.vx, g); s.y -= mul(s.vy, g);
  s.d = dist(s, pin); lipDepth(s);
  if (s.h + s.d >= CR) { rimK(s); scaleAboutPin(s, pin); }
}
function cupFloor(s, pin) {
  if (s.vz >= 0 || s.z >= FLOOR) return;
  const f = sra(div(s.z - FLOOR, s.vz), 4);
  s.x -= mul(s.vx, f); s.y -= mul(s.vy, f); s.z = FLOOR;
  s.vz = mul(-s.vz, 0xB333);
  if (s.vz <= 0x8000) { s.done = true; s.x = pin[0]; s.y = pin[1]; s.z = FLOOR; return; }
  s.vx = mul(s.vx, 0x8000); s.vy = mul(s.vy, 0x8000);
  s.x += mul(s.vx, f); s.y += mul(s.vy, f); s.z += mul(s.vz, f);
}
function incupTick(s, pin) {
  s.vz -= 0xA000;
  s.x += sra(s.vx, 4); s.y += sra(s.vy, 4); s.z += sra(s.vz, 4);
  curveVector(s); wall(s, pin); cupFloor(s, pin);
}

// ---------------------------------------------------------------- terrain
function toMap(v) { return sra(mul(v, 0x19999), 16) & 0xFFFF; }
class Hole {
  constructor(H, putting) {
    this.w = H.w; this.h = H.h; this.tee = H.tee; this.gbox = H.gbox; this.putting = !!putting;
    this.tm = H._tm || (H._tm = b64(H.tmap)); this.gm = H._gm || (H._gm = b64(H.gmap));
    const dz = H.dz || [-1, -1, 0, 0x7FFF]; this.dz = [dz[0], dz[1], dz[3]];
  }
  cell(m, x, y) {
    let p = m[(y >> 3) * 2] | (m[(y >> 3) * 2 + 1] << 8); let de = x >> 3;
    for (;;) { const c = m[p], v = m[p + 1] | (m[p + 2] << 8); p += 3; if (de < c) return v; de -= c; }
  }
  subcell(v, x, y) {
    let L = v & 0xFF; const P = v >> 8;
    const on = u8(0x22310C + P * 8 + (y & 7)) & u8(0x223104 + (x & 7));
    if (L < 0xD0) return [((on ? (L >> 4) : L) & 0x0F), 0];
    if (!on) return [3, 0];
    L -= 0xD0; return [3, (((L << 4) | (L >> 4)) & 0xFF) + 1];
  }
  surface(x, y) {
    const [gx, gy] = this.gbox;
    if (!this.putting) {
      if (x >= this.w + 0x70 || y >= this.h + 0x98) return [5, 0];
      if (Math.abs(x - this.tee[0]) <= 0x0A && Math.abs(y - this.tee[1]) <= 7) return [4, 0];
      if (!(gy - y >= 0 || gy - y + 0x37 < 0 || gx - x >= 0 || gx - x + 0x37 < 0)) {
        const X = (x - gx) * 2 + 16, Y = (y - gy) * 2 + 8; return this.subcell(this.cell(this.gm, X, Y), X, Y);
      }
      return this.subcell(this.cell(this.tm, x, y), x, y);
    }
    const X = (x - gx) * 2 + 16, Y = (y - gy) * 2 + 8;
    return this.subcell(this.cell(this.gm, X, Y), X, Y);
  }
  ground(x, y) {
    const [y0, y1, x0] = this.dz;
    if (!(y0 <= y && y <= y1) || this.surface(x, y)[0] === 8) return [0, 0];
    if (((x - x0) & 0xFFFF) <= 0x40 && ((y - y0) & 0xFFFF) <= 0x20) return [-2, 0xFF];
    return [-1000, (y + 0x20 >= y1) ? 0xFF : 0];
  }
  groundPhys(px, py) { return sra(shl(this.ground(toMap(px), toMap(py))[0], 16), 6); }
  lie(px, py, pz) {
    const x = toMap(px), y = toMap(py);
    const g = this.ground(x, y)[0];
    let dz = (sra(shl(pz, 6), 16) * 2) & 0xFFFF;
    dz = sra(dz & 0x8000 ? dz - 0x10000 : dz, 6);
    const y2 = y - dz;
    if (g >= 0 || y2 < this.dz[1]) return this.surface(x, y2);
    return [7, 0];
  }
}

// ---------------------------------------------------------------- launch
function launch(inp) {
  const g = ((inp.golfer + inp.legend) * 4) & 0xFF, lie = inp.lie;
  const t = ptr(0x21F379 + g);
  const speed = lie === 0x0D ? u32(0x21FA09 + ((inp.power * 4) & 0xFFFC)) : u32(t + ((inp.power * 2) & 0xFFFC));
  const angle = u16(ptr(0x21F1F9 + g) + 2 * lie);
  const T = ptr(0x21FB9D + g);
  const fct = s32(ptr(0x21FE6D + g) + 4 * lie);
  const W = ptr(ptr(0x22013D + g) + 4 * ((inp.stat + inp.result) & 0xFF));
  const wv = (a) => { const v = u16(a); return sra(shl(v < 0x8000 ? v : v - 0x10000, 16), 10); };
  const wh = wv(W + 4 * lie), wvv = wv(W + 4 * lie + 2);
  const club = shl(0x13 - inp.club, 16);
  const a1 = sra(mul(club, s32(T + lie * 8)), 6);
  let h = -cos(angle) - a1; h = h * 0x40;
  h = mul(h, fct); h = mul(h, speed); h = mul(h, wh);
  const b = newBall();
  b.vx = mul(inp.aimx, h); b.vy = mul(inp.aimy, h);
  const a2 = sra(mul(club, s32(T + lie * 8 + 4)), 6);
  let v = sin(angle) + a2; v = v * 0x40;
  v = mul(v, fct); v = mul(v, speed); v = mul(v, wvv);
  b.vz = sra(v, 1);
  const imp = inp.impact - 4;
  const k = Math.max(0, shl(angle + imp + 4 * (0x13 - inp.club), 16));
  const top = mul(speed, k);
  b.top0 = top;
  const st = inp.shottype || 0;
  b.top = st === 1 ? 0 : (st === 2 ? top * 3 : top);
  b.spin = -mul(mul(mul(shl(imp, 16), h), 0x28E), 0x1555);
  let l = shl(imp + ((0x13 - inp.club) >> 1), 16);
  l += shl(angle, 16);
  l = mul(l, 0x3DD) + 0x8000;
  l = mul(mul(mul(l, h), 0x28E), 0xA000);
  b.lift = Math.max(0, l);
  const wa = (shl(inp.wind_dir || 0, 8)) & 0xFFFF;
  b.wx = sin(wa) * (inp.wind_str || 0); b.wy = cos(wa) * (inp.wind_str || 0);
  b.shottype = st;
  return b;
}

// ---------------------------------------------------------------- shot (dispatcher 0x20E52F)
class Shot {
  constructor(hole, ball, pin, objects, legend, snap) {
    this.H = hole; this.b = ball; this.pin = pin; this.legend = !!legend;
    this.trees = legend ? [] : (objects || []).map(([t, x, y]) => [t, mul(shl(x, 16), 0xA000), mul(shl(y, 16), 0xA000)]);
    if (!legend && !hole.putting) this.trees.unshift([0, pin[0], pin[1]]);      // 0x2100FC: the flagstick (not when putting)
    this.snap = snap === undefined ? !hole.putting : snap;
    this.ticks = 0;
  }
  collide() {
    const b = this.b, sx = b.x, sy = b.y, sz = b.z;
    b.tree_hit = false;
    b.x -= sra(b.vx, 4); b.y -= sra(b.vy, 4); b.z -= sra(b.vz, 4);
    for (let k = 1; k <= 16; k++) {
      b.x += sra(b.vx, 8); b.y += sra(b.vy, 8); b.z += sra(b.vz, 8);
      const g = this.H.groundPhys(b.x, b.y);
      treeTest(b, this.trees, this.pin);
      if (g > b.z || (g === b.z && g < 0)) { b.z = g; return -sra(shl(16 - k, 16), 8); }
    }
    if (!b.tree_hit) { b.x = sx; b.y = sy; b.z = sz; }
    return null;
  }
  surface() { const [s, sl] = this.H.lie(this.b.x, this.b.y, this.b.z); this.b.surf = s; this.b.slope = sl; return s; }
  events(landing) {
    const b = this.b, surf = this.surface();
    if (surf === 6 || surf === 7) {
      const y = toMap(b.y);
      const skim = b.vz < -0x20000 && shl(-b.vz, 2) < b.speed && !(((this.H.dz[0] & 0xFFFF) <= y) && (y <= (this.H.dz[1] & 0xFFFF)));
      if (!skim) { b.done = true; b.result = surf === 7 ? 'water' : 'hazard'; return; }
    }
    if (surf >= 11 && surf <= 14 && landing && !b.rolling) {        // 0x20FCA0: bunker landing draws a plug depth
      b.draws = (b.draws || 0) + 1;
      let plug = b.draws === b.plug_at && b.plug;
      // TH1 codes carry no plug data: the next shot's table byte = plug depth (record+3) + the surface it rests on
      if (!b.plug_known && b.next_tbl != null) { const dep = b.next_tbl - surf; plug = dep >= 1 && dep <= 3; }
      if (plug) { b.done = true; b.result = 'plugged'; return; }
    }
    if (surf === 3 && landing && !b.rolling && dist(b, this.pin) <= CUP_R) this.holeOut();
  }
  holeOut() { const b = this.b; b.incup = true; b.result = 'holed'; if (this.snap) { b.x = this.pin[0]; b.y = this.pin[1]; } }
  tick() {
    const b = this.b;
    if (b.done) return false;
    this.ticks++;
    if (b.incup) { incupTick(b, this.pin); if (b.done) b.result = 'holed'; return true; }
    b.x += sra(b.vx, 4); b.y += sra(b.vy, 4);
    b.treeflags &= 1;
    b.z += sra(b.vz, 4);
    if (b.rolling) this.rollStep();
    else {
      this.landing();
      if (b.incup) return true;
      if (b.done) { /* finished */ } else if (b.rolling) this.rollStep(); else flightVelocity(b);
    }
    this.bounds();
    return true;
  }
  bounds() {
    const b = this.b;
    if (this.H.putting || b.incup) return;
    const x = toMap(b.x), y = toMap(b.y);
    const sx = x & 0x8000 ? x - 0x10000 : x, sy = y & 0x8000 ? y - 0x10000 : y;
    if (sx <= 0 || sx >= this.H.w + 0x70 || sy <= 0 || sy >= this.H.h + 0x98) { if (!b.done) b.result = 'ob'; b.done = true; }
    if (b.done) { const [g, pit] = this.H.ground(x, y); if (!pit) b.z = sra(shl(g, 16), 6); }
  }
  landing() {
    const b = this.b, g = this.H.groundPhys(b.x, b.y);
    const near = b.z <= g + 0x140000;
    if (!near) { if (g >= b.z) { if (b.vz >= 0) return; } else if (g === b.ground) return; }
    b.ground = g;
    const e4 = this.collide();
    if (e4 === null) return;
    this.events(true);
    if (b.done || b.incup) return;
    bounce(b, b.surf, e4);
  }
  rollStep() {
    const b = this.b;
    b.wx = b.wy = 0;
    curveVector(b);
    if (!this.H.putting) this.collide();
    if (Math.abs(this.pin[0] - b.x) + Math.abs(this.pin[1] - b.y) >= 0x20000) {
      const [g, pit] = this.H.ground(toMap(b.x), toMap(b.y)); if (!pit) b.z = sra(shl(g, 16), 6);
    }
    this.events(false);
    if (b.done) return;
    if (this.H.putting) {
      const r = rim(b, this.pin);
      if (r === 'incup') { b.result = 'holed'; return; }
      if (b.z > 0) { b.rolling = false; return; }
    }
    b.near_cup = dist(b, this.pin) <= CR;
    rollVelocity(b, b.surf, b.slope, this.H.putting, this.legend);
    if (b.stopped) {
      if (dist(b, this.pin) > CR) { b.done = true; b.result = b.result || 'stopped'; } else this.holeOut();
    }
  }
}
function simulate(inp, hole, start, pin, objects, limit, plugAt, plug, nextTbl, plugKnown) {
  const b = launch(inp);
  b.x = start[0]; b.y = start[1]; b.z = 0;
  b.rolling = inp.lie === 0x0D;                  // the putter rolls from the first tick (0x434B bit 0)
  b.plug_at = plugAt || 0; b.plug = plug || 0; b.next_tbl = nextTbl == null ? null : nextTbl; b.plug_known = !!plugKnown;
  const S = new Shot(hole, b, pin, objects, !!inp.legend);
  const path = [[b.x, b.y, b.z]];
  while (S.tick() && S.ticks < (limit || 4000)) path.push([b.x, b.y, b.z]);
  return { ball: b, path };
}

// ---------------------------------------------------------------- TH1 QR
const A36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function b36(s) { let v = 0; for (const c of s) { const d = A36.indexOf(c); if (d < 0) throw new Error('bad char'); v = v * 36 + d; } return v; }
function parseTH1(text) {
  const body = text.includes('/TM/') ? text.split('/TM/')[1] : text;
  const v3 = body.startsWith('TH3'), v2 = v3 || body.startsWith('TH2');
  if (!body.startsWith('TH1') && !v2) throw new Error('not a hole replay code');
  const data = body.slice(0, -2), chk = b36(body.slice(-2));
  let sum = 0; for (const c of data) sum += A36.indexOf(c);
  if (sum % 1296 !== chk) throw new Error('checksum');
  let p = 3; const take = (n) => { const v = b36(data.slice(p, p + n)); p += n; return v; };
  const h = { course: take(1), hole: take(1), golfer: take(1), legend: take(1), pinx: take(2), piny: take(2) };
  if (v3) { const r = take(1); h.cart = { strokes: r & 15, holed: !!(r & 16) }; }   // TH3: the cart's own result
  const n = take(1); h.shots = [];
  for (let i = 0; i < n; i++) {
    const a = take(6), b = take(v2 ? 6 : 5);
    const s = { angle: a & 0xFFF, power: fl(a / 2 ** 12) & 0x7F, club: fl(a / 2 ** 19) & 0x3F, impact: fl(a / 2 ** 25) & 0xF,
      shottype: fl(a / 2 ** 29) & 3, wind_dir: b & 0xF, wind_str: (b >> 4) & 0xF, tbl: (b >> 8) & 0xFF, lie: (b >> 16) & 0xF,
      stroke: (b >> 20) & 0xF, newstart: (b >> 24) & 1 };
    if (v2) { s.draws = fl(b / 2 ** 25) & 3; s.plug = fl(b / 2 ** 27) & 3; }   // TH1: plugs are inferred
    if (s.newstart && v3) { const v = take(6); s.sx = (v % 16384) * 1024; s.sy = fl(v / 16384) * 1024; s.approx = true; }  // map px * 64
    else if (s.newstart) { s.sx = take(6); s.sy = take(6); }
    h.shots.push(s);
  }
  if (p !== data.length) throw new Error('length');
  return h;
}
function replayTH1(h, courseJson) {
  const H = courseJson.holes[h.hole];
  const pin = [mul(shl(h.pinx, 16), 0xA000), mul(shl(h.piny, 16), 0xA000)];
  const out = []; let prev = null;
  for (const s of h.shots) {
    let mx, my;
    if (!prev) { mx = shl(H.tee[0], 16); my = shl(H.tee[1], 16); }               // first shot: the hole's tee
    else { mx = mul(prev[0], 0x19999); my = mul(prev[1], 0x19999); }             // else the previous rest
    // a recorded start: TH1/TH2 exact; TH3 to 1/64 px -- used only where the chained start drifted from it, so a replay
    // that matches the cart stays bit-exact
    if (s.newstart && (!s.approx || fl(mx / 1024) !== s.sx / 1024 || fl(my / 1024) !== s.sy / 1024)) { mx = s.sx; my = s.sy; }
    const start = [mul(mx, 0xA000), mul(my, 0xA000)];
    const inp = { golfer: h.golfer, legend: h.legend, stat: s.tbl, result: 0, lie: s.lie, power: s.power, club: s.club,
      impact: s.impact, shottype: s.shottype, aimx: sin(s.angle), aimy: cos(s.angle), wind_dir: s.wind_dir, wind_str: s.wind_str };
    const hole = new Hole(H, false);
    hole.putting = hole.surface(toMap(start[0]), toMap(start[1]))[0] === 3;     // 0x41DB: the ball is on the green
    const nx = h.shots[h.shots.indexOf(s) + 1];
    const r = simulate(inp, hole, start, pin, H.objects, 4000, s.draws || 0, s.plug || 0, nx ? nx.tbl : null, s.draws !== undefined);
    out.push({ shot: s, result: r.ball.result, rest: [r.ball.x, r.ball.y, r.ball.z], path: r.path, start });
    prev = [r.ball.x, r.ball.y];
  }
  return { pin, shots: out };
}

const API = { setPhys, Hole, launch, simulate, parseTH1, replayTH1, mul, sin, cos, toMap };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TMSim = API;
})(typeof window !== 'undefined' ? window : globalThis);
