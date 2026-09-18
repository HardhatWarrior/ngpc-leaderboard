/* MIT; see LICENSE. Pure helpers; no network calls, authentication or writes. */
(function (root) {
  'use strict';
  const protocol = typeof module !== 'undefined' && module.exports ? require('./protocol.js') : root.OverRevProtocol;
  function toScore(input, submittedAt) {
    const r = protocol.decode(input);
    if (!Number.isSafeInteger(submittedAt) || submittedAt < 0) throw new Error('Invalid submission timestamp');
    return {
      game: 'OV', initials: r.name, rules: r.rules, course: r.course, car: r.car,
      tune: r.tune, mode: 1, difficulty: r.difficulty, transmission: r.transmission,
      ticks: r.ticks, won: r.won, localRecord: r.localRecord, event: r.event,
      sequence: r.sequence, raw: r.raw, source: 'qr', submittedAt
    };
  }
  function category(input) {
    const r = protocol.decode(input);
    return ['OV', r.rules, r.course, 1, r.car, r.tune, r.difficulty, r.transmission].join(':');
  }
  const api = { toScore, category };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OverRevSiteAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
