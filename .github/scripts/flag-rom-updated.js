#!/usr/bin/env node
// Bumps games/{slug}.romUpdatedAt / updatedUntil in Firestore for every play/*/*.ngp file that
// changed in this push -- mirrors exactly what admin/game/'s manual "Upload ROM" button already
// does to those two fields, just triggered by a git push instead of a manual re-upload.
'use strict';
const admin = require('firebase-admin');

// play/<folder>/<file>.ngp -> games/{slug} doc id. Kept as an explicit table rather than derived
// from the folder name because a couple of slugs (bw/tt/yz/fk/2k) don't match their play/ folder
// name at all -- see GAME_ROUTES in index.html, this is the same mapping.
const PATH_TO_SLUG = {
  'play/2048/2048.ngp': '2k',
  'play/bowling/bowling.ngp': 'bw',
  'play/farkle/farkle.ngp': 'fk',
  'play/gardenia/GARDENIA.ngp': 'gardenia',
  'play/overrev/overrev.ngp': 'overrev',
  'play/tetris/tetris.ngp': 'tt',
  'play/yahtzee/yahtzee.ngp': 'yz',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function main(){
  const changedPaths = process.argv.slice(2).map(p => p.trim()).filter(Boolean);
  if(changedPaths.length === 0){
    console.log('No changed ROM paths passed in -- nothing to do.');
    return Promise.resolve();
  }

  const slugs = new Set();
  for(const p of changedPaths){
    const slug = PATH_TO_SLUG[p];
    if(slug){
      slugs.add(slug);
    } else {
      console.log('Skipping (not a known ROM path): ' + p);
    }
  }
  if(slugs.size === 0){
    console.log('No changed path matched a known game ROM -- nothing to do.');
    return Promise.resolve();
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const now = Date.now();
  const batch = db.batch();
  for(const slug of slugs){
    console.log('Flagging games/' + slug + ' as UPDATED (romUpdatedAt=' + now + ')');
    batch.update(db.collection('games').doc(slug), {
      romUpdatedAt: now,
      updatedUntil: now + THIRTY_DAYS_MS,
    });
  }
  return batch.commit().then(() => {
    console.log('Done: ' + slugs.size + ' game(s) flagged.');
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
