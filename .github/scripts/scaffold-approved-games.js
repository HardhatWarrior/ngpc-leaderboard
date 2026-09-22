#!/usr/bin/env node
// Runs on a schedule (see .github/workflows/scaffold-approved-games.yml). Finds every games/{slug}
// doc that doesn't yet have a <slug>/index.html on disk in this checkout, looks up the
// gameSubmissions doc it was approved from (same convention scaffold-game-lib.js's own
// findSubmissionAndSlug() uses), and generates its leaderboard + play pages -- the piece of
// "approve a submission" that previously required running scaffold-game.js by hand from a
// computer with service-account.json. This is what lets an approval made from a phone (via
// /admin/'s browser Approve button) actually produce a live draft page without anyone sitting
// down at a keyboard. The workflow commits whatever this script writes.
'use strict';
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { generateAndWrite } = require('./scaffold-game-lib.js');

const REPO_ROOT = path.join(__dirname, '..', '..');

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT env var not set');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const db = admin.firestore();

  const gamesSnap = await db.collection('games').get();
  let generatedAny = false;

  for (const gameDoc of gamesSnap.docs) {
    const slug = gameDoc.id;
    const game = gameDoc.data();
    const lbPath = path.join(REPO_ROOT, slug, 'index.html');
    if (fs.existsSync(lbPath)) continue; // already scaffolded, or a hand-built page -- never touch it

    let subsSnap = await db.collection('gameSubmissions').where('reviewNote', '==', 'Approved as games/' + slug).get();
    if (subsSnap.empty && game.code) {
      subsSnap = await db.collection('gameSubmissions').where('proposedCode', '==', game.code).get();
    }
    if (subsSnap.empty) continue; // no submission on file to generate from (e.g. a hand-created games/ doc)

    const doc = subsSnap.docs[0];
    const sub = Object.assign({ _id: doc.id }, doc.data());
    if (!sub.payloadFields || !sub.payloadFields.length) continue; // nothing to generate from

    console.log('Scaffolding ' + slug + ' ("' + sub.proposedName + '")...');
    try {
      const result = generateAndWrite(sub, slug, { apply: true, force: false });
      if (result.written) {
        generatedAny = true;
        console.log('  wrote ' + result.lbPath);
        console.log('  wrote ' + result.playPath);
        console.log('  wrote ' + result.rulesSnippetPath);
        if (result.manualFields.length) console.log('  NEEDS HAND-EDITING: ' + result.manualFields.join(', '));
        if (result.hasScorecardNote) console.log('  NEEDS HAND-EDITING: scorecardFormula TODO left in ' + slug + '/index.html');
      }
    } catch (e) {
      console.error('  failed: ' + e.message);
    }
  }

  console.log(generatedAny ? '\nDone -- see files above.' : '\nNothing to scaffold.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
