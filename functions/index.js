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
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

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
