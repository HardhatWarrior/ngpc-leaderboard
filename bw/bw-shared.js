/* Neo Bowling tournament standings and achievements, shared by bw/index.html and
   user/index.html (a player's achievements on their profile) so the two never disagree. Pure
   functions over score docs (plain data objects) and the games/bw doc: nothing here reads or
   writes the database. Loaded before each page's own script, as window.BW_SHARED. */
(function(){
  "use strict";
  const HCP_MIN_GAMES = 5;   // same as the cart's HCP_MIN_GAMES

  // floor((200 - avg) * 0.9), capped 90 -- spec section 4, the cart's avg_handicap()
  function handicapFor(avg10){ return Math.min(90, Math.floor(Math.max(0, 2000 - avg10) * 9 / 100)); }

  // Spec section 2: a strike is a 10 at a full rack -- the first ball of frames 1-9; in the
  // 10th, ball 1, ball 2 after a strike, ball 3 after strike-strike or a spare.
  function strikeStats(rolls){
    let i = 0, run = 0, streak = 0, strikes = 0;
    const ball = isStrike => { if(isStrike){ strikes++; run++; if(run > streak) streak = run; } else run = 0; };
    for(let f=0; f<9 && i<rolls.length; f++){
      if(rolls[i] === 10){ ball(true); i += 1; } else { ball(false); i += 2; }
    }
    const [a, b, c] = rolls.slice(i);
    if(a === undefined) return {streak, strikes};
    ball(a === 10);
    if(b !== undefined && a === 10) ball(b === 10);
    if(c !== undefined && ((a === 10 && b === 10) || (a < 10 && a + b === 10))) ball(c === 10);
    return {streak, strikes};
  }

  // Each Bowling feature is Off, Testers or On (games/bw.bwFeatures): <k> === true is On (for
  // everyone); <k>Testers === true is Testers (the game's Preview access list plus the admin and
  // developer); anything else is Off. Testers is a separate flag so an older cached page, which
  // only knows <k>, sees false and keeps the feature hidden.
  function featureLevel(features, k){
    const f = features || {};
    if(f[k] === true) return 'on';
    return (f[k + 'Testers'] === true || f[k] === 'testers') ? 'testers' : 'off';
  }
  // who sees it: On = everyone; the admin and the game's developer always; Testers = also the
  // Preview access list (auth.js isGameManager() / canPreviewGame())
  function featureVisible(game, k, user, auth){
    const lvl = featureLevel(game && game.bwFeatures, k);
    if(lvl === 'on') return true;
    if(!user || !auth) return false;
    if(auth.isGameManager(user, game)) return true;
    return lvl === 'testers' && auth.canPreviewGame(user, game);
  }

  // games/bw.bwTournaments: [{id, name, startsAt, endsAt, prize}] (ms timestamps)
  function events(game){
    const list = (game && game.bwTournaments) || [];
    return list.filter(e=>e && e.id && e.name && e.startsAt < e.endsAt);
  }
  function status(ev, now){ return now < ev.startsAt ? 'upcoming' : now < ev.endsAt ? 'live' : 'final'; }

  function playerKey(d){ return d.uid || ('@' + (d.username || d.initials)); }
  function compare(a, b, mode){
    const ka = mode === 'hcp' ? a.total : a.score, kb = mode === 'hcp' ? b.total : b.score;
    return (kb - ka) || (b.streak - a.streak) || (b.strikes - a.strikes) || (a.at - b.at);
  }
  // Each player's best verified game inside the window, with the handicap snapshotted from
  // their last v3 score submitted BEFORE the start (spec section 4) -- games bowled during the
  // event never move it. The handicap is fixed per player, so the best game is the same on
  // the Handicap and Scratch boards. scores: every approved Bowling score. Unsorted.
  function standings(ev, scores){
    const snap = new Map();
    scores.forEach(d=>{
      if(d.version !== 3 || !Number.isInteger(d.avg10) || !(d.submittedAt < ev.startsAt)) return;
      const k = playerKey(d), prev = snap.get(k);
      if(!prev || d.submittedAt > prev.submittedAt) snap.set(k, d);
    });
    const best = new Map();
    scores.forEach(d=>{
      if(d.version !== 3 || !d.verified || !Array.isArray(d.rolls) || !Number.isInteger(d.score)) return;
      if(!(d.submittedAt >= ev.startsAt && d.submittedAt < ev.endsAt)) return;
      const k = playerKey(d), s = snap.get(k);
      const hcp = (s && s.avgGames >= HCP_MIN_GAMES) ? handicapFor(s.avg10) : null;
      const st = strikeStats(d.rolls);
      const e = {d, k, score:d.score, hcp, total:d.score + (hcp || 0), streak:st.streak, strikes:st.strikes, at:d.submittedAt};
      const prev = best.get(k);
      if(!prev || compare(e, prev, 'hcp') < 0) best.set(k, e);
    });
    return [...best.values()];
  }

  // A player's handicap snapshot for an event: their last v3 score (carrying the cart's average)
  // submitted before the start -- the one standings() uses. scores: that player's own.
  function snapshotFor(ev, scores){
    let s = null;
    scores.forEach(d=>{
      if(d.version !== 3 || !Number.isInteger(d.avg10) || !(d.submittedAt < ev.startsAt)) return;
      if(!s || d.submittedAt > s.submittedAt) s = d;
    });
    return s;
  }

  // ---- achievements ----
  // Tournament champion: 1st on the handicap board of each finished event -> [{ev, entry}],
  // newest event first. entry.k is the winner's playerKey() (their uid), entry.d their game.
  function champions(game, scores, now){
    return events(game).filter(ev=>status(ev, now) === 'final').sort((a,b)=>b.endsAt - a.endsAt).map(ev=>{
      const rows = standings(ev, scores).sort((a,b)=>compare(a, b, 'hcp'));
      return rows.length ? {ev, entry: rows[0]} : null;
    }).filter(Boolean);
  }
  // The 300 Club: a verified code whose rolls are twelve strikes
  function isPerfect(d){
    return !!d && d.version === 3 && d.verified === true && d.score === 300
      && Array.isArray(d.rolls) && d.rolls.length === 12 && d.rolls.every(r=>r === 10);
  }
  // A player's perfect games, oldest first. The same code scanned again is one game, dated by its
  // first scan: every field it carries matches. (Two real 300s differ in the cart's game count or
  // average, except in rare cases past the cart's 999-game count; counting those once is the price
  // of a re-scanned photo never earning a second badge.)
  function perfectGames(scores){
    const seen = new Set();
    return scores.filter(isPerfect).slice().sort((a,b)=>a.submittedAt - b.submittedAt).filter(d=>{
      const key = [playerKey(d), d.initials, d.weight, d.avg10, d.avgGames].join('|');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  window.BW_SHARED = {HCP_MIN_GAMES, handicapFor, strikeStats, featureLevel, featureVisible, events, status,
                      playerKey, compare, standings, snapshotFor, champions, isPerfect, perfectGames};
})();
