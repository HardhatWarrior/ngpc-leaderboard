# NGPC Hiscores Cloud Functions

One function: `sendMail` (see [index.js](index.js)). It's the in-house replacement for Firebase's
prebuilt "Trigger Email" extension, which is being sunset in March 2027 -- fires on every new doc
in the `mail/{id}` collection (unchanged: `auth.js`'s `notifyAdmin()`/`notifyUser()` and
`firestore.rules`' own validation of who can write there are exactly the same as before) and sends
the email itself via `support@ngpc-dev.com`'s own SMTP (Namecheap Private Email), instead of
routing through a third party.

## Requirements

- The Firebase project must be on the **Blaze** (pay-as-you-go) plan -- Cloud Functions can't make
  outbound network connections (needed here for SMTP) on the free Spark plan. Check under
  Firebase Console → Project Settings → Usage and billing.
- Node 20 locally (to match `engines.node` above and avoid a runtime mismatch at deploy time).

## One-time setup

```bash
npm install -g firebase-tools    # if you don't already have it
firebase login                   # opens a browser sign-in

cd functions
npm install

# Type the support@ngpc-dev.com mailbox password at the interactive prompt this opens --
# it goes straight into Firebase's own Secret Manager, never into this repo or any chat/log.
firebase functions:secrets:set SMTP_PASSWORD
```

## Deploy

```bash
firebase deploy --only functions
```

(or `npm run deploy` from inside `functions/`, same command).

## After deploying: verify, then retire the old extension

1. Approve a test account (or trigger any other `mail/` write) and confirm the email actually
   arrives from `support@ngpc-dev.com`.
2. Check `firebase functions:log` if it doesn't -- every failure is also written back onto the
   `mail/{id}` doc itself as a `delivery: {state: 'ERROR', error: ...}` field.
3. Once confirmed working, uninstall the old "Trigger Email" extension from Firebase Console →
   Extensions, so a `mail/` doc doesn't briefly get processed twice. This is a console click, not
   something this repo can do for you.

## Debugging

```bash
firebase functions:log                 # tail recent logs
firebase functions:log --only sendMail # just this function
```
