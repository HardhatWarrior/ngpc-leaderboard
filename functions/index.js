/*
 * sendMail -- fires on every new doc in mail/{id}, same collection auth.js's notifyAdmin() and
 * notifyUser() already write to (new signups, new game submissions, account-approval notices).
 * This replaces Firebase's prebuilt "Trigger Email" extension, which is being sunset (March 2027)
 * -- everything upstream of this file (what gets written to mail/, and firestore.rules' own
 * validation of who's allowed to write what) is UNCHANGED. Only what actually sends the email is
 * new: real SMTP through support@ngpc-dev.com's own mailbox (Namecheap Private Email) instead of
 * whatever relay the extension used, so mail now genuinely comes from this project's own address
 * instead of a third-party sender.
 *
 * Deploy (one-time setup, run locally -- see functions/README.md):
 *   npm install -g firebase-tools   (once)
 *   firebase login                  (once)
 *   cd functions && npm install
 *   firebase functions:secrets:set SMTP_PASSWORD    <- type the mailbox password at the prompt;
 *                                                        never stored in this repo or given to an AI
 *   firebase deploy --only functions
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();

const SITE_ORIGIN = 'https://www.ngpc-dev.com';

// Only the password is a secret -- the mailbox address itself is already public (it's the site's
// own published support address), so there's nothing gained by hiding it too, and keeping it a
// plain constant means one less thing to configure per deploy.
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');
const SMTP_USER = 'support@ngpc-dev.com';
const SMTP_FROM = '"NGPC Hiscores" <support@ngpc-dev.com>';
// Namecheap Private Email's own SMTP server -- same one shown in the mailbox's own
// "Mail Client Configuration" panel (mail.privateemail.com, port 465 = implicit TLS).
const SMTP_HOST = 'mail.privateemail.com';
const SMTP_PORT = 465;

exports.sendMail = onDocumentCreated(
  { document: 'mail/{id}', secrets: [SMTP_PASSWORD], region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};

    // Mirrors firestore.rules' own mail/{id} shape check -- this function trusts whatever made it
    // past that rule (only two write paths exist: the fixed admin-alert address, or an admin
    // sending to an account's own verified recoveryEmail), but still guards against a malformed
    // doc crashing the function instead of just marking that one send as failed.
    const to = Array.isArray(data.to) ? data.to.filter(Boolean) : [];
    const message = data.message || {};
    if (!to.length || typeof message.subject !== 'string' || typeof message.text !== 'string') {
      logger.error('Malformed mail doc, skipping send', { id: event.params.id, data });
      await snap.ref.update({
        delivery: {
          state: 'ERROR',
          error: 'Malformed mail doc: missing to[] / message.subject / message.text',
          attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD.value() },
    });

    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: to.join(','),
        subject: message.subject,
        text: message.text,
      });
      await snap.ref.update({
        delivery: {
          state: 'SUCCESS',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    } catch (err) {
      // Logged AND written back onto the doc -- the doc-side record is what a future admin/
      // panel could surface ("this notification never went out"), the log is what actually shows
      // up in the Firebase Console / `firebase functions:log` while debugging a bad deploy.
      logger.error('sendMail failed', { id: event.params.id, to, error: String(err && err.message || err) });
      await snap.ref.update({
        delivery: {
          state: 'ERROR',
          error: String((err && err.message) || err),
          attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  }
);

/*
 * handlePasswordResetRequest -- fires on every new doc in passwordResetRequests/{id}, written by
 * either the sign-in modal's own "Forgot password?" form (auth.js) or the admin Players table's
 * "Reset password" button (admin/index.html) -- both write the exact same {uid, requestedAt}
 * shape (see firestore.rules), so this one function serves both entry points. Does the privileged
 * work a client can never do itself: looks up the account's recovery email (users/{uid}/private/
 * contact, normally admin/owner-only) and mints a one-time token, then hands the actual send off
 * to the existing sendMail pipeline by writing a mail/{id} doc -- no separate SMTP client here.
 *
 * Deliberately silent about whether a uid/account is real or has a recovery email on file --
 * logs it, but never writes anything back that a client could read, so the request side of this
 * flow can't be used to enumerate accounts either.
 */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RESET_THROTTLE_MS = 10 * 60 * 1000; // don't mint a second token for the same uid within this window

exports.handlePasswordResetRequest = onDocumentCreated(
  { document: 'passwordResetRequests/{id}', secrets: [], region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const { uid } = snap.data() || {};
    if (typeof uid !== 'string' || !uid) return;

    const db = admin.firestore();

    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) { logger.info('Password reset requested for unknown uid', { uid }); return; }

      const contactDoc = await db.collection('users').doc(uid).collection('private').doc('contact').get();
      const recoveryEmail = contactDoc.exists ? contactDoc.data().recoveryEmail : null;
      if (!recoveryEmail) { logger.info('Password reset requested but no recovery email on file', { uid }); return; }

      // Throttle: skip minting (and emailing) a new token if an unused, unexpired one already
      // exists for this uid -- prevents a burst of requests (accidental double-click, or someone
      // hammering the form) from spamming the account's real inbox with several links.
      // Single-field query (uid only) -- covered by Firestore's automatic single-field index, so
      // this never needs a manually-created composite index. used/expiresAt filtered in JS below.
      const now = Date.now();
      const recentSnap = await db.collection('passwordResets').where('uid', '==', uid).limit(10).get();
      const stillPending = recentSnap.docs.some(d => !d.data().used && (d.data().expiresAt || 0) > now);
      if (stillPending) { logger.info('Password reset already pending for uid, not re-sending', { uid }); return; }

      const token = crypto.randomBytes(32).toString('hex');
      await db.collection('passwordResets').doc(token).set({
        uid,
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: now + RESET_TOKEN_TTL_MS,
      });

      const username = userDoc.data().username || 'there';
      const resetUrl = SITE_ORIGIN + '/reset/?token=' + token;
      await db.collection('mail').add({
        to: [recoveryEmail],
        message: {
          subject: 'Reset your NGPC Hiscores password',
          text: 'Hi ' + username + ',\n\n'
            + 'Someone (hopefully you) requested a password reset for your NGPC Hiscores account.\n\n'
            + 'Reset your password: ' + resetUrl + '\n\n'
            + 'This link works once and expires in 30 minutes. If you didn’t request this, you can ignore this email -- your password won’t change.',
        },
      });
    } catch (err) {
      logger.error('handlePasswordResetRequest failed', { uid, error: String((err && err.message) || err) });
    }
  }
);

/*
 * confirmPasswordReset -- the one step of this flow that genuinely needs to be callable directly
 * from the browser (the /reset/ page), not routed through a Firestore doc: it takes a plaintext
 * new password, which has no business ever touching a Firestore document even transiently. A plain
 * HTTPS function (not onCall) so the client can hit it with a bare fetch() -- no Firebase Functions
 * SDK/script tag needed on every page, matching this site's existing fetch-based conventions.
 * CORS is locked to the site's own origin; nothing here trusts the caller's identity beyond
 * possession of the one-time token itself, same trust model as any other emailed reset link.
 */
exports.confirmPasswordReset = onRequest(
  { region: 'us-central1', cors: [SITE_ORIGIN] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ ok: false, error: 'Missing or invalid token/newPassword.' });
      return;
    }

    const db = admin.firestore();
    const tokenRef = db.collection('passwordResets').doc(token);

    try {
      const uid = await db.runTransaction(async (tx) => {
        const tokenDoc = await tx.get(tokenRef);
        if (!tokenDoc.exists) throw new Error('EXPIRED');
        const data = tokenDoc.data();
        if (data.used || !data.expiresAt || data.expiresAt < Date.now()) throw new Error('EXPIRED');
        tx.update(tokenRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
        return data.uid;
      });

      await admin.auth().updateUser(uid, { password: newPassword });
      res.status(200).json({ ok: true });
    } catch (err) {
      const expired = err && err.message === 'EXPIRED';
      if (!expired) logger.error('confirmPasswordReset failed', { error: String((err && err.message) || err) });
      res.status(expired ? 400 : 500).json({
        ok: false,
        error: expired ? 'This reset link is invalid or has expired -- request a new one.' : 'Something went wrong. Try again.',
      });
    }
  }
);
