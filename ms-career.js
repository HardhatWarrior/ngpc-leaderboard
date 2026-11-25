/* Metal Slug career docs (MS1M / MS2M): ONE doc per player (scores/<GAME>_<uid>), like Nocturne's GN_<uid>.
   Every mission code a player submits is merged into it:
     - best run (score = total, + that run's mission / mscore / level / ...): the leaderboard entry
     - per mission (index 0..n-1): mBest (best mission score), mLevel (its difficulty), mClears (codes submitted),
       mPows (MS2 only: most POWs freed in one run of that mission)
     - clearedMax, powsAll (MS2), chars (MS2): running maxima / sets
     - codes: the last 300 merged codes (mission_total_mscore), so a rescan never counts twice
   firestore.rules (isMetalSlugCareer) checks the shape and that the best total and the code list never shrink. */
(function(){
"use strict";
const zeros = (n)=>Array.from({length:n}, ()=>0);
function codeKey(sub){ return sub.mission + '_' + sub.score + '_' + sub.mscore; }
// old: the current doc data or null; sub: the parsed code; n: missions; pows: MS2 (POW fields); extra: identity fields
function merge(old, sub, n, pows, extra){
  const key = codeKey(sub);
  if(old && Array.isArray(old.codes) && old.codes.indexOf(key) >= 0) return { dup:true };
  const o = old || {};
  const arr = (a)=>Array.isArray(a) && a.length === n ? a.slice() : zeros(n);
  const mBest = arr(o.mBest), mLevel = arr(o.mLevel), mClears = arr(o.mClears), mPows = pows ? arr(o.mPows) : null;
  const i = sub.mission;
  if(i < n){
    mClears[i] += 1;
    if(sub.mscore > mBest[i] || (sub.mscore === mBest[i] && sub.level > mLevel[i])){ mBest[i] = sub.mscore; mLevel[i] = sub.level; }
    if(pows) mPows[i] = Math.max(mPows[i], sub.pows||0);
  }
  const better = !old || sub.score > o.score || (sub.score === o.score && sub.level > o.level);
  const run = better ? sub : o;
  const d = {
    game: sub.game, initials: run.initials, score: run.score, mscore: run.mscore, mission: run.mission,
    cleared: run.cleared, level: run.level, bestAt: better ? Date.now() : o.bestAt,
    clearedMax: Math.max(o.clearedMax||0, sub.cleared||0),
    mBest: mBest, mLevel: mLevel, mClears: mClears,
    codes: (Array.isArray(o.codes) ? o.codes : []).concat([key]).slice(-300),
  };
  if(pows){
    d.pows = run.pows; d.character = run.character; d.mPows = mPows;
    d.powsAll = Math.max(o.powsAll||0, sub.powsAll||0);
    const chars = Array.isArray(o.chars) ? o.chars.slice() : [];
    if(chars.indexOf(sub.character) < 0) chars.push(sub.character);
    d.chars = chars.sort();
  }
  return { dup:false, better: better, data: Object.assign(d, extra) };
}
window.MS_CAREER = { merge: merge, codeKey: codeKey, zeros: zeros };
})();
