/* Shared badge definitions: one provider per game, used by /achievements/ (a player's badges) and
   /admin/badges/ (every game, every player). load(ctx) -> {note, earned, list, html} or null. */
(function(){
"use strict";
const A = window.NGPC_AUTH;
const esc = (s)=>String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function loadScript(src){
    return new Promise((ok, no)=>{
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ()=>no(new Error('could not load '+src));
      document.head.appendChild(s);
    });
  }
  function fmtDate(ts){ return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function badgeGrid(list){
    let out = '', grp = null;
    list.forEach(b=>{
      if(b.grp !== grp){ out += (grp !== null ? '</div>' : '') + (b.grp ? '<div class="grp">'+esc(b.grp)+'</div>' : '') + '<div class="grid">'; grp = b.grp; }
      out += '<div class="badge'+(b.on?' on':'')+(b.big?' big':'')+'"><b>'+esc(b.name)+'</b>'+(b.sub?'<small>'+esc(b.sub)+'</small>':'')+'</div>';
    });
    return out + (grp !== null ? '</div>' : '');
  }

  // Completion head (% + "n of m badges" + bar), the same markup Nocturne's tab uses.
  function pctHead(got, total){
    const pct = total ? Math.round(got*100/total) : 0;
    return { pct: pct, html: '<div class="g-head"><div class="g-pct px tnum">'+pct+'%</div><div class="g-sum"><div class="tnum">'+got+' of '+total+' badges</div>'+
      '<div class="bar"><i style="width:'+pct+'%"></i></div></div></div>' };
  }
  // ---- Games that offer badges. Adding one = one more entry here: load(ctx) returns null when the game
  // has nothing to show for this player at all (the tab is left out), else {note, earned, html}. ctx is
  // {uid, username, self, viewer, scores: this player's approved score docs}. ----
  const PROVIDERS = [
    {
      key:'gn', name:'Guardians of the Nocturne',
      // From the player's TALE CODE: their private saved one when it is their own page, else the code on their
      // public COMPLETION BOARD entry (scores/GN_<uid>, which the player puts there by submitting a tale).
      // Badges are sticky: the board entry's `earned` union (fromEntry) is applied whenever an entry exists, so a
      // NEW GAME+ code never unlights a badge earned on an earlier journey.
      async load(ctx){
        await loadScript('/gn/achievements.js');
        const G = window.NGPC_ACH_GN;
        let res = null, from = '';
        const entries = ctx.scores.filter(d=>d.game === 'GN').sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));
        const entry = entries.length ? entries[0] : null;
        if(ctx.self){
          try{
            const d = await A.db.collection('taleCodes').doc(ctx.uid).get();
            if(d.exists && d.data().code){
              const code = d.data().code;
              res = entry ? G.fromEntry({ code: code, earned: entry.earned, pct: entry.pct, complete: entry.complete }) : G.fromCode(code);
              from = 'your saved TALE CODE' + (entry && Array.isArray(entry.earned) ? ' and the badges your COMPLETION BOARD entry keeps' : '');
            }
          }catch(e){ /* fall back to the board entry */ }
        }
        if(!res && entry){ res = G.fromEntry(entry); from = 'the COMPLETION BOARD entry'; }
        const link = '<a href="/gn/">Guardians of the Nocturne page</a>';
        // Like every other game: no tale shared (no board entry) means no tab.
        if(!res) return null;
        const journey = res.complete ? 'NEW GAME+ '+res.journey+', COMPLETE (FREE PLAY)' : (res.journey ? 'NEW GAME+ '+res.journey : 'the first tale');
        return { note: res.pct+'%', earned: res.badges > 0, list: res.list,
          recent: (entry && entry.submittedAt) ? { name: res.pct+'% COMPLETE', at: entry.submittedAt } : null, html:
          '<h2 class="g-title">'+esc(G.name)+'</h2>'+
          '<div class="g-head"><div class="g-pct px tnum">'+res.pct+'%</div><div class="g-sum"><div class="tnum">'+res.badges+' of '+res.total+' badges'+(res.far && res.far.hid ? ' ('+res.far.hid+' remain in places not reached yet)' : '')+'</div>'+
          '<div class="bar"><i style="width:'+res.pct+'%"></i></div><div style="color:var(--dim)">Furthest journey: '+esc(journey)+'</div></div></div>'+
          badgeGrid(res.list)+
          '<p class="fine">Worked out from '+esc(from)+'. Completion % is the weighted share of the badges earned; 100% needs every badge, including those in places the tale has not reached yet (they stay unnamed until it does). '+
          (ctx.self ? 'Others see these badges once you submit your tale to the COMPLETION BOARD on the '+link+'.' : '')+'</p>' };
      }
    },
    {
      key:'bw', name:'Neo Bowling',
      // The 300 Club (verified perfect games) and tournament titles: same rules as the player's profile page.
      async load(ctx){
        await loadScript('/bw/bw-shared.js?v=4');
        const S = window.BW_SHARED;
        let game = null;
        try{ const d = await A.db.collection('games').doc('bw').get(); game = d.exists ? d.data() : null; }catch(e){}
        if(!S || !game) return null;
        const mine = ctx.scores.filter(d=>d.game === 'BW');
        if(!mine.length) return null;   // no Neo Bowling submissions: no tab, like the other games
        // the same Career stats visibility switch the profile uses (Off / Testers / On)
        // While Career stats is Off or Testers, the tab still shows but says why it is empty (Manage Game > Bowling
        // features is where it is switched On).
        if(!S.featureVisible(game, 'careerStats', ctx.viewer, A)){
          return { note:'testing', earned:false, list:[], html:
            '<h2 class="g-title">Neo Bowling</h2><div class="empty">Neo Bowling badges (the 300 CLUB, 250 and 200 CLUBs, TURKEY and tournament CHAMPION) are being tested and are not public yet.</div>' };
        }
        const perfect = S.perfectGames(mine), now = Date.now();
        const c250 = S.clubGames(mine, 250), c200 = S.clubGames(mine, 200), turkeys = S.turkeyGames(mine);
        const times = (k, one, many) => k > 1 ? k + ' ' + many : '1 ' + one;
        let titles = [];
        const finals = S.events(game).filter(ev=>S.status(ev, now) === 'final');
        const played = finals.some(ev=>mine.some(d=>d.version === 3 && d.verified === true && d.submittedAt >= ev.startsAt && d.submittedAt < ev.endsAt));
        if(played && S.featureVisible(game, 'tournaments', ctx.viewer, A)){
          try{
            const snap = await A.db.collection('scores').where('game','==','BW').where('approved','==',true).get();
            titles = S.champions(game, snap.docs.map(d=>d.data()), now).filter(c=>c.entry.k === ctx.uid);
          }catch(e){ /* titles are decoration: leave them out */ }
        }
        const list = [
          { grp:'', name:'300 CLUB', sub: perfect.length ? (perfect.length > 1 ? perfect.length+' perfect games: ' : 'Perfect game: ') + perfect.map(d=>fmtDate(d.submittedAt)).join(', ') : 'a verified perfect game (12 strikes)', at: (perfect[0] ? perfect[0].submittedAt : 0), on: perfect.length > 0, big:true },
          { grp:'', name:'250 CLUB', sub: c250.length ? times(c250.length, 'game', 'games') + ' of 250+, first ' + fmtDate(c250[0].submittedAt) : 'a verified game of 250 or more', at: (c250[0] ? c250[0].submittedAt : 0), on: c250.length > 0 },
          { grp:'', name:'200 CLUB', sub: c200.length ? times(c200.length, 'game', 'games') + ' of 200+, first ' + fmtDate(c200[0].submittedAt) : 'a verified game of 200 or more', at: (c200[0] ? c200[0].submittedAt : 0), on: c200.length > 0 },
          { grp:'', name:'TURKEY', sub: turkeys.length ? times(turkeys.length, 'game', 'games') + ' with three strikes in a row, first ' + fmtDate(turkeys[0].submittedAt) : 'three strikes in a row in a verified game', at: (turkeys[0] ? turkeys[0].submittedAt : 0), on: turkeys.length > 0 },
          { grp:'', name:'CHAMPION', sub: titles.length ? 'Won ' + titles.map(c=>c.ev.name).join(', ') : 'win a Neo Bowling tournament', at: titles.length ? Math.max.apply(null, titles.map(c=>c.ev.endsAt || 0)) : 0, on: titles.length > 0, big:true },
        ];
        const got = list.filter(b=>b.on).length, head = pctHead(got, list.length);
        return { note: head.pct+'%', earned: got > 0, list: list, html:
          '<h2 class="g-title">Neo Bowling</h2>'+head.html+badgeGrid(list)+
          '<p class="fine">Perfect games, the 200 and 250 Clubs and turkeys are counted from verified scores; tournament titles from finished events.</p>' };
      }
    },
    {
      key:'tm', name:'Neo Turf Masters',
      // From the player's approved hole-by-hole cards (scores with game 'TM'). Rounds played with the Golf Set of
      // Legend never count (the board ranks them last too). Pars per course: the same table as tm/index.html.
      async load(ctx){
        const PARS = [[4,4,3,4,5,4,4,5,3, 4,5,4,4,3,4,5,3,4], [4,4,3,5,4,4,4,5,3, 4,5,3,4,4,3,4,5,4], [4,4,3,5,4,4,5,3,4, 5,3,4,4,3,4,4,5,4],
                      [4,4,3,5,4,4,5,3,4, 4,4,3,4,4,5,3,4,5], [4,4,4,3,5,4,5,3,4, 4,4,3,4,5,4,3,5,4]];
        const COURSES = ['Japan', 'U.S.A.', 'Germany', 'Australia', 'Scotland'];
        const all = ctx.scores.filter(d=>d.game === 'TM' && Array.isArray(d.holes) && d.holes.length === 18 && PARS[d.course]);
        if(!all.length) return null;
        const rounds = all.filter(d=>!d.legend).sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
        const first = (test)=>{ const d = rounds.find(test); return d ? d : null; };
        const diffs = (d)=>d.holes.map((s,i)=>s - PARS[d.course][i]);
        const par = (d)=>PARS[d.course].reduce((a,b)=>a+b,0);
        const under = (d)=>d.total < par(d);
        const when = (d)=>d ? ' (' + COURSES[d.course] + ', ' + fmtDate(d.submittedAt) + ')' : '';
        const ace = first(d=>d.holes.some(s=>s === 1));
        const alb = first(d=>diffs(d).some(x=>x <= -3));
        const eagle = first(d=>diffs(d).some(x=>x <= -2));
        const train = first(d=>{ const x = diffs(d); for(let i=0;i<16;i++) if(x[i]<0 && x[i+1]<0 && x[i+2]<0) return true; return false; });
        const clean = first(d=>diffs(d).every(x=>x <= 0));
        const up = first(under);
        const pro = first(d=>d.total <= par(d) - 10);
        const vh = first(d=>d.level === 3 && under(d));
        // date of the round that completed a set (all five courses, all six golfers): rounds are oldest first
        const doneAt = (rs, key, n)=>{ const seen = new Set(); for(const d of rs){ seen.add(key(d)); if(seen.size >= n) return d.submittedAt || 0; } return 0; };
        const validGolfer = (d)=>Number.isInteger(d.golfer) && d.golfer >= 0 && d.golfer <= 5;
        const played = new Set(rounds.map(d=>d.course)), slam = new Set(rounds.filter(under).map(d=>d.course));
        const cast = new Set(rounds.filter(d=>Number.isInteger(d.golfer) && d.golfer >= 0 && d.golfer <= 5).map(d=>d.golfer));   // TM2 cards only
        // TM3 cards only: the round's fairways hit, greens in regulation and putts
        const r3 = (test)=>first(d=>(d.formatVersion === '3' || d.formatVersion === '4') && Number.isInteger(d.putts) && test(d));   // TM3 / TM4 cards
        const fwHoles = (d)=>PARS[d.course].filter(p=>p > 3).length;
        const fwAll = r3(d=>d.fairways >= fwHoles(d));
        const pin = r3(d=>d.gir >= 15);
        const flaw = r3(d=>d.fairways >= fwHoles(d) && d.gir === 18);
        const hot = r3(d=>d.putts <= 27);
        const onep = r3(d=>d.putts <= 18);
        const scr = r3(d=>under(d) && d.gir < 9);
        const stars = new Set(rounds.filter(d=>under(d) && Number.isInteger(d.golfer) && d.golfer >= 0 && d.golfer <= 5).map(d=>d.golfer));
        const list = [
          { grp:'', name:'HOLE IN ONE', sub: ace ? 'Aced a hole'+when(ace) : 'ace any hole', at: (ace ? ace.submittedAt : 0), on: !!ace, big:true },
          { grp:'', name:'ALBATROSS', sub: alb ? '3 under on a hole'+when(alb) : '3 under par on a single hole', at: (alb ? alb.submittedAt : 0), on: !!alb },
          { grp:'', name:'EAGLE', sub: eagle ? '2 under on a hole'+when(eagle) : '2 under par on a single hole', at: (eagle ? eagle.submittedAt : 0), on: !!eagle },
          { grp:'', name:'BIRDIE TRAIN', sub: train ? '3 in a row'+when(train) : 'three birdies (or better) in a row', at: (train ? train.submittedAt : 0), on: !!train },
          { grp:'', name:'BOGEY-FREE', sub: clean ? 'No hole over par'+when(clean) : 'a round with no hole over par', at: (clean ? clean.submittedAt : 0), on: !!clean },
          { grp:'', name:'UNDER PAR', sub: up ? 'Finished under par'+when(up) : 'finish a round under par', at: (up ? up.submittedAt : 0), on: !!up },
          { grp:'', name:'TOUR PRO', sub: pro ? '10 or more under'+when(pro) : 'a round 10 or more under par', at: (pro ? pro.submittedAt : 0), on: !!pro },
          { grp:'', name:'VERY HARD', sub: vh ? 'Under par on Very Hard'+when(vh) : 'an under-par round on Very Hard', at: (vh ? vh.submittedAt : 0), on: !!vh },
          { grp:'', name:'GLOBETROTTER', sub: played.size === 5 ? 'Played all five courses' : 'play a round on all five courses (' + played.size + ' of 5)', at: doneAt(rounds, d=>d.course, 5), on: played.size === 5 },
          { grp:'', name:'FULL ROSTER', sub: cast.size === 6 ? 'Played a round with all six golfers' : 'play a round with all six golfers (' + cast.size + ' of 6)', at: doneAt(rounds.filter(validGolfer), d=>d.golfer, 6), on: cast.size === 6 },
          { grp:'', name:'FAIRWAY FINDER', sub: fwAll ? 'Hit every fairway'+when(fwAll) : 'hit every fairway in a round', at: (fwAll ? fwAll.submittedAt : 0), on: !!fwAll },
          { grp:'', name:'PIN SEEKER', sub: pin ? '15+ greens in regulation'+when(pin) : '15 or more greens in regulation in a round', at: (pin ? pin.submittedAt : 0), on: !!pin },
          { grp:'', name:'FLAWLESS', sub: flaw ? 'Every fairway and all 18 greens'+when(flaw) : 'every fairway and all 18 greens in regulation in a round', at: (flaw ? flaw.submittedAt : 0), on: !!flaw, big:true },
          { grp:'', name:'HOT PUTTER', sub: hot ? '27 putts or fewer'+when(hot) : 'a round of 27 putts or fewer', at: (hot ? hot.submittedAt : 0), on: !!hot },
          { grp:'', name:'ONE-PUTT ROUND', sub: onep ? '18 putts or fewer'+when(onep) : 'a round of 18 putts or fewer', at: (onep ? onep.submittedAt : 0), on: !!onep },
          { grp:'', name:'SCRAMBLER', sub: scr ? 'Under par with under 9 greens'+when(scr) : 'finish under par while hitting fewer than 9 greens', at: (scr ? scr.submittedAt : 0), on: !!scr },
          { grp:'', name:'ALL-STAR', sub: stars.size === 6 ? 'Under par with all six golfers' : 'an under-par round with each of the six golfers (' + stars.size + ' of 6)', at: doneAt(rounds.filter(d=>under(d) && validGolfer(d)), d=>d.golfer, 6), on: stars.size === 6, big:true },
          { grp:'', name:'GRAND SLAM', sub: slam.size === 5 ? 'Under par on all five courses' : 'under par on all five courses (' + slam.size + ' of 5)', at: doneAt(rounds.filter(under), d=>d.course, 5), on: slam.size === 5, big:true },
        ];
        const got = list.filter(b=>b.on).length, head = pctHead(got, list.length);
        return { note: head.pct+'%', earned: got > 0, list: list, html:
          '<h2 class="g-title">Neo Turf Masters</h2>'+head.html+badgeGrid(list)+
          '<p class="fine">Counted from approved hole-by-hole cards on the <a href="/tm/">Turf Masters leaderboard</a>. Rounds played with the Legend clubs do not count toward badges. Fairway, green and putt badges need cards from the TM3 patch (fairways, greens and putts on the card).</p>' };
      }
    }
  ];

  // ---- Score-board games: every badge is a test over the player's approved scores for one game. Each def is
  // {name, sub (how to earn it), test(d) -> true when that score earns it, big?}; the first earning score dates it.
  function boardProvider(key, name, game, defs, fine, extra){
    return { key:key, name:name, async load(ctx){
      const mine = ctx.scores.filter(d=>d.game === game).sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
      if(!mine.length) return null;
      const list = defs.map(b=>{
        const hit = mine.find(b.test);
        return { grp:b.grp||'', name:b.name, sub: hit ? (b.got ? b.got(hit) : 'Earned ' + fmtDate(hit.submittedAt)) : b.sub, at: hit ? hit.submittedAt : 0, on: !!hit, big: !!b.big };
      });
      const got = list.filter(b=>b.on).length, head = pctHead(got, list.length);
      return { note: head.pct+'%', earned: got > 0, list: list, html:
        '<h2 class="g-title">'+esc(name)+'</h2>'+head.html+badgeGrid(list)+'<p class="fine">'+fine+'</p>' };
    } };
  }
  const pts = (n, label)=>({ name:label, sub:'a score of '+n.toLocaleString()+' or more', test:d=>d.score >= n,
                             got:d=>'Scored '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt) });
  const mmss = (t)=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
  PROVIDERS.push(
    // The 2048 board keeps only the score, not the tile: a tile of 2^n needs at least (n-1)*2^n points of merging.
    boardProvider('2k','2048','2K',[
      { name:'512 TILE',  sub:'a score of 4,096 or more',  test:d=>d.score >= 4096,  got:d=>'Scored '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt) },
      { name:'1024 TILE', sub:'a score of 9,216 or more',  test:d=>d.score >= 9216,  got:d=>'Scored '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt) },
      { name:'2048 TILE', sub:'a score of 20,480 or more', test:d=>d.score >= 20480, got:d=>'Scored '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt), big:true },
    ], 'The board stores your score, not the tile, so these use the score that reaching each tile guarantees. Counted from approved scores on the <a href="/2k/">2048 leaderboard</a>.'),
    boardProvider('tt','Tetris','TT',[ pts(10000,'10K'), pts(50000,'50K'), pts(100000,'100K') ],
      'Counted from approved scores on the <a href="/tt/">Tetris leaderboard</a>.'),
    boardProvider('bk','Breakout','BK',[ pts(5000,'5K'), pts(15000,'15K') ],
      'Counted from approved scores on the <a href="/bk/">Breakout leaderboard</a>.'),
    boardProvider('ms','Minesweeper','MS',[
      { name:'EASY CLEARED',   sub:'clear an Easy board',   test:d=>d.difficulty === 0, got:d=>'Cleared in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { name:'NORMAL CLEARED', sub:'clear a Normal board',  test:d=>d.difficulty === 1, got:d=>'Cleared in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
    ], 'Counted from approved times on the <a href="/ms/">Minesweeper leaderboard</a>.'),
    boardProvider('sd','Sudoku','SD',[
      { grp:'Solved', name:'EASY',   sub:'solve an Easy puzzle',   test:d=>d.difficulty === 'E', got:d=>'Solved in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { grp:'Solved', name:'MEDIUM', sub:'solve a Medium puzzle',  test:d=>d.difficulty === 'M', got:d=>'Solved in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { grp:'Solved', name:'HARD',   sub:'solve a Hard puzzle',    test:d=>d.difficulty === 'H', got:d=>'Solved in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { grp:'Speed',  name:'EASY SPEED',   sub:'an Easy puzzle in under 3:00',   test:d=>d.difficulty === 'E' && d.time < 180, got:d=>'Easy in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { grp:'Speed',  name:'MEDIUM SPEED', sub:'a Medium puzzle in under 5:00',  test:d=>d.difficulty === 'M' && d.time < 300, got:d=>'Medium in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
      { grp:'Speed',  name:'HARD SPEED',   sub:'a Hard puzzle in under 6:00',    test:d=>d.difficulty === 'H' && d.time < 360, got:d=>'Hard in '+mmss(d.time)+', '+fmtDate(d.submittedAt) },
    ], 'Counted from approved times on the <a href="/sd/">Sudoku leaderboard</a>.'),
    // Sokoban keeps one progressive entry per player, so levelsSolved / stars only ever go up.
    boardProvider('sk','Sokoban','SK',[
      { name:'10 LEVELS', sub:'solve 10 levels', test:d=>d.levelsSolved >= 10 },
      { name:'20 LEVELS', sub:'solve 20 levels', test:d=>d.levelsSolved >= 20 },
      { name:'30 LEVELS', sub:'solve all 30 levels', test:d=>d.levelsSolved >= 30, big:true },
      { name:'PERFECT',   sub:'all 90 stars',    test:d=>d.stars >= 90, got:d=>'All 90 stars, '+fmtDate(d.submittedAt), big:true },
    ], 'Counted from your progress entry on the <a href="/sk/">Sokoban leaderboard</a>.'),
    boardProvider('yz','Neo Yahtzee','YZ',[
      pts(200,'200 CLUB'), pts(300,'300 CLUB'),
      { name:'YAHTZEE!', sub:'score a Yahtzee in a game', big:true,
        test:d=>Array.isArray(d.categoryScores) && d.categoryScores[11] === 50, got:d=>'Rolled a Yahtzee, '+fmtDate(d.submittedAt) },
    ], 'Counted from approved games on the <a href="/yz/">Neo Yahtzee leaderboard</a>.'),
    boardProvider('ca','Carcassonne','CA',[ pts(100,'100 POINTS'), pts(200,'200 POINTS'), pts(250,'250 POINTS') ],
      'Counted from approved scores on the <a href="/ca/">Carcassonne leaderboard</a>.'),
    boardProvider('sb','Shut the Box','SB',[
      { name:'SHUT THE BOX', sub:'shut the box in a round (a round total of 0)', big:true,
        test:d=>Array.isArray(d.rounds) && d.rounds.some(r=>r === 0), got:d=>'Shut the box, '+fmtDate(d.submittedAt) },
    ], 'Counted from approved series on the <a href="/sb/">Shut the Box leaderboard</a>.')
  );

  // Metal Slug 1st Mission: mission codes (MS1M, one doc per mission tally) plus the older total-only codes (MS1).
  PROVIDERS.push({ key:'ms1', name:'Metal Slug 1st Mission', async load(ctx){
    const all = ctx.scores.filter(d=>(d.game === 'MS1M' || d.game === 'MS1') && d.level >= 2).sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
    const ms = all.filter(d=>d.game === 'MS1M');
    if(!all.length) return null;
    const first = (arr, f)=>arr.find(f);
    const reach = (arr, n)=>{ const set = new Set(); for(const d of arr){ if(d.mission < 23) set.add(d.mission); if(set.size >= n) return d; } return null; };
    const on = (hit, b, got)=>({ grp:b[0], name:b[1], sub: hit ? (got ? got(hit) : 'Earned '+fmtDate(hit.submittedAt)) : b[2], at: hit ? hit.submittedAt : 0, on: !!hit, big: !!b[3] });
    const tot = (d)=>'Total '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt);
    const list = [
      on(ms[0], ['Missions','BOOTS ON THE GROUND','submit a mission code']),
      on(reach(ms, 10), ['Missions','TOUR OF DUTY','record 10 different missions']),
      on(first(all, d=>d.cleared >= 12), ['Missions','VETERAN','12 missions cleared'], d=>d.cleared+' missions cleared, '+fmtDate(d.submittedAt)),
      on(first(all, d=>d.cleared >= 23), ['Missions','MISSION ACCOMPLISHED','all 23 missions cleared', true]),
      on(first(all, d=>d.score >= 10000), ['Score','10K','a total score of 10,000 or more'], tot),
      on(first(all, d=>d.score >= 50000), ['Score','50K','a total score of 50,000 or more'], tot),
      on(first(all, d=>d.score >= 100000), ['Score','100K','a total score of 100,000 or more', true], tot),
      on(first(ms, d=>d.mscore >= 5000), ['Score','HIGH VALUE TARGET','5,000 or more in a single mission'], d=>d.mscore.toLocaleString()+' in mission '+(d.mission < 23 ? d.mission+1 : '?')+', '+fmtDate(d.submittedAt)),
    ];
    const got = list.filter(b=>b.on).length, head = pctHead(got, list.length);
    return { note: head.pct+'%', earned: got > 0, list: list, html:
      '<h2 class="g-title">Metal Slug 1st Mission</h2>'+head.html+badgeGrid(list)+
      '<p class="fine">Counted from your approved codes on the <a href="/ms1/">Metal Slug 1st Mission leaderboard</a>.</p>' };
  } });

  // Metal Slug 2nd Mission: mission codes (MS2M, one doc per MISSION COMPLETE) and Time Attack times (MS2).
  // Some badges add up across codes (missions recorded, POWs saved, both characters, all 8 stages).
  PROVIDERS.push({ key:'ms2', name:'Metal Slug 2nd Mission', async load(ctx){
    const ms = ctx.scores.filter(d=>d.game === 'MS2M' && d.level >= 2).sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
    const ta = ctx.scores.filter(d=>d.game === 'MS2').sort((a,b)=>(a.submittedAt||0)-(b.submittedAt||0));
    if(!ms.length && !ta.length) return null;
    const first = (arr, f)=>arr.find(f);
    // first code at which a running total / distinct set reaches n
    const reach = (arr, step, n)=>{ let acc = null; for(const d of arr){ acc = step(acc, d); if(acc.n >= n) return d; } return null; };
    const sumPows = (acc, d)=>({ n: (acc ? acc.n : 0) + (d.pows||0) });
    const distinct = (key)=>(acc, d)=>{ const set = acc ? acc.set : new Set(); set.add(key(d)); return { set:set, n:set.size }; };
    const on = (hit, b, got)=>({ grp:b[0], name:b[1], sub: hit ? (got ? got(hit) : 'Earned '+fmtDate(hit.submittedAt)) : b[2], at: hit ? hit.submittedAt : 0, on: !!hit, big: !!b[3] });
    const list = [
      on(first(ms, d=>d.pows >= 1), ['Rescue','FIRST RESCUE','free a POW in a recorded mission']),
      on(first(ms, d=>d.pows >= 5), ['Rescue','SQUAD LEADER','free 5 POWs in one mission'], d=>d.pows+' POWs in mission '+(d.mission+1)+', '+fmtDate(d.submittedAt)),
      on(reach(ms, sumPows, 100), ['Rescue','LIFELINE','100 POWs saved across your recorded missions']),
      on(ms[0], ['Missions','BOOTS ON THE GROUND','submit a mission code']),
      on(reach(ms, distinct(d=>d.mission), 10), ['Missions','TOUR OF DUTY','record 10 different missions']),
      on(first(ms, d=>d.cleared >= 20), ['Missions','VETERAN','20 missions cleared'], d=>d.cleared+' missions cleared, '+fmtDate(d.submittedAt)),
      on(first(ms, d=>d.cleared >= 37), ['Missions','MISSION ACCOMPLISHED','all 37 missions cleared', true]),
      on(first(ms, d=>d.score >= 100000), ['Score','100K','a total score of 100,000 or more'], d=>'Total '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt)),
      on(first(ms, d=>d.score >= 500000), ['Score','500K','a total score of 500,000 or more'], d=>'Total '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt)),
      on(first(ms, d=>d.score >= 1000000), ['Score','1 MILLION','a total score of 1,000,000 or more', true], d=>'Total '+d.score.toLocaleString()+', '+fmtDate(d.submittedAt)),
      on(first(ms, d=>d.mscore >= 20000), ['Score','HIGH VALUE TARGET','20,000 or more in a single mission'], d=>d.mscore.toLocaleString()+' in mission '+(d.mission+1)+', '+fmtDate(d.submittedAt)),
      on(reach(ms, distinct(d=>d.character), 2), ['Characters','DOUBLE DUTY','record missions as both Marco and Fio']),
      on(ta[0], ['Time Attack','ON THE CLOCK','submit a Time Attack time']),
      on(reach(ta, distinct(d=>d.stage), 8), ['Time Attack','FULL SWEEP','a Time Attack time on all 8 stages']),
    ];
    const got = list.filter(b=>b.on).length, head = pctHead(got, list.length);
    return { note: head.pct+'%', earned: got > 0, list: list, html:
      '<h2 class="g-title">Metal Slug 2nd Mission</h2>'+head.html+badgeGrid(list)+
      '<p class="fine">Counted from your approved mission codes and Time Attack times on the <a href="/ms2/">Metal Slug 2nd Mission leaderboard</a>.</p>' };
  } });

window.NGPC_BADGES = { PROVIDERS: PROVIDERS, esc: esc, fmtDate: fmtDate };
})();
