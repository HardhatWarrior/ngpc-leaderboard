/* OV1 parser shared by the browser and Node tests. No network or DOM access. */
(function (root) {
  'use strict';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  // Accept old ROM text, a camera-scanned URL, or GitHub Pages' hash redirect.
  // Keep payload case unchanged: it is covered by the checksum.
  function extractPayload(input) {
    if (typeof input !== 'string' || input.length > 256) throw new Error('Résultat invalide.');
    let text = input.trim();
    if (/^https:\/\//i.test(text)) {
      const url = new URL(text);
      if (!['www.ngpc-dev.com', 'ngpc-dev.com'].includes(url.hostname) ||
          url.username || url.password || url.port || url.search) throw new Error('Adresse Over Rev invalide.');
      if (/^\/overrev\/$/i.test(url.pathname) && url.hash) text = url.hash.slice(1);
      else if (/^\/overrev\/[^/]+$/i.test(url.pathname) && !url.hash) text = url.pathname.slice(9);
      else throw new Error('Adresse Over Rev invalide.');
      text = decodeURIComponent(text);
    } else if (text.startsWith('#')) text = decodeURIComponent(text.slice(1));
    return text;
  }
  function crc16(bytes) {
    let crc = 0xffff;
    for (const byte of bytes) {
      crc ^= byte << 8;
      for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
    }
    return crc;
  }
  function decode(text) {
    const match = /^OV1:([A-Z0-9]{1,8}):([A-Z2-7]{24})$/.exec(extractPayload(text));
    if (!match) throw new Error('Ce code ne contient pas un résultat Over Rev OV1.');
    const name = match[1], data = new Uint8Array(15);
    let bits = 0, value = 0, offset = 0;
    for (const char of match[2]) {
      value = (value << 5) | alphabet.indexOf(char);
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        data[offset++] = (value >>> bits) & 255;
        value &= (1 << bits) - 1;
      }
    }
    const prefix = Array.from('OV1:' + name + ':', c => c.charCodeAt(0));
    if (crc16([...prefix, ...data.slice(0, 13)]) !== ((data[13] << 8) | data[14])) {
      throw new Error('Le résultat est endommagé (somme de contrôle incorrecte).');
    }
    const rules = (data[0] << 8) | data[1], flags = data[5];
    const ticks = (data[6] << 16) | (data[7] << 8) | data[8];
    const event = (data[9] << 8) | data[10];
    if (rules !== 1) throw new Error('Cette révision du jeu n’est pas encore prise en charge.');
    if (data[2] >= 10 || data[3] >= 8 || (flags & 128) || (flags & 3) !== 1 ||
        ticks < 1 || ticks > 65535 || event !== 0) {
      throw new Error('Les paramètres de cette course ne sont pas pris en charge.');
    }
    const seconds = Math.floor(ticks / 60);
    const time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') +
      '.' + String(Math.floor((ticks % 60) * 100 / 60)).padStart(2, '0');
    return {
      protocol: 'OV1', raw: match[0], name, rules, course: data[2], car: data[3],
      tune: data[4], upgrades: [0, 2, 4, 6].map(shift => (data[4] >> shift) & 3),
      mode: 'TIME ATTACK', difficulty: (flags >> 2) & 3,
      transmission: (flags & 16) ? 'AT' : 'MT', won: Boolean(flags & 32),
      localRecord: Boolean(flags & 64), ticks, time, event,
      sequence: (data[11] << 8) | data[12]
    };
  }
  const api = { decode, crc16, extractPayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OverRevProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
