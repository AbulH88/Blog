/**
 * Outbound transactional email via SMTP (MXroute).
 *
 * Configured by env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Falls back to a no-op transport in dev if SMTP_HOST is unset
 * — preserves console log of what WOULD have been sent so devs
 * can debug forgot-password flows without configuring SMTP.
 */
const nodemailer = require('nodemailer');

let transporter = null;
let transporterMode = 'noop';

function buildTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    transporter = {
      // No-op transport — log and pretend it sent
      sendMail: async (opts) => {
        console.log('[email:noop] would send to:', opts.to);
        console.log('[email:noop] subject:', opts.subject);
        console.log('[email:noop] preview:', String(opts.text || opts.html).slice(0, 200));
        return { messageId: `noop-${Date.now()}` };
      },
    };
    transporterMode = 'noop';
    console.warn('[email] SMTP env vars not set — email service is in NO-OP mode');
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
  });
  transporterMode = 'smtp';
  console.log(`[email] SMTP transporter ready (${host}:${port})`);
  return transporter;
}

/**
 * Send a transactional email.
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]   plain-text body
 * @param {string} [opts.html]   HTML body (preferred)
 */
async function sendEmail({ to, subject, text, html }) {
  const tx = buildTransporter();
  const from = process.env.SMTP_FROM
    || `noreply@${(process.env.SITE_URL || 'localhost').replace(/^https?:\/\//, '')}`;
  return tx.sendMail({ from, to, subject, text, html });
}

// ── Templates ──────────────────────────────────────────────────────

function brandedShell(title, bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a2422;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="padding:32px 36px 0;">
      <h1 style="margin:0 0 8px;font-size:1.4rem;letter-spacing:0.5px;">${title}</h1>
    </div>
    <div style="padding:14px 36px 32px;font-size:0.96rem;line-height:1.6;color:#3a322f;">
      ${bodyHtml}
    </div>
    <div style="padding:18px 36px;background:#FAF5EE;font-size:0.78rem;color:#9c8e88;text-align:center;border-top:1px solid rgba(0,0,0,0.04);">
      You received this email because someone (hopefully you) requested it.<br>
      If it wasn't you, you can safely ignore this message.
    </div>
  </div>
</body></html>`;
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const subject = 'Reset your password';
  const html = brandedShell('Reset your password', `
    <p>Hi ${username || 'there'},</p>
    <p>We got a request to reset the password on your account. Click the button below to set a new one — the link is valid for <strong>60 minutes</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#c45c3a;color:#fff;padding:12px 24px;border-radius:22px;text-decoration:none;font-weight:700;">Reset password</a>
    </p>
    <p style="font-size:0.84rem;color:#7a6f6a;">Or paste this link into your browser:<br><a href="${resetUrl}" style="color:#c45c3a;word-break:break-all;">${resetUrl}</a></p>
    <p style="font-size:0.84rem;color:#7a6f6a;">If you didn't ask for a reset, you can ignore this email — your password will stay the same.</p>
  `);
  const text = `Reset your password\n\nHi ${username || 'there'},\n\nClick this link to set a new password (valid for 60 minutes):\n\n${resetUrl}\n\nIf you didn't ask for this, ignore the email.\n`;
  return sendEmail({ to, subject, text, html });
}

async function sendEmailVerification({ to, username, verifyUrl }) {
  const subject = 'Verify your email address';
  const html = brandedShell('Verify your email', `
    <p>Welcome, ${username || 'fan'}!</p>
    <p>Tap the button below to confirm this is your email address. The link is valid for <strong>24 hours</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#c45c3a;color:#fff;padding:12px 24px;border-radius:22px;text-decoration:none;font-weight:700;">Verify email</a>
    </p>
    <p style="font-size:0.84rem;color:#7a6f6a;">Or paste this link:<br><a href="${verifyUrl}" style="color:#c45c3a;word-break:break-all;">${verifyUrl}</a></p>
  `);
  const text = `Verify your email\n\nTap to verify: ${verifyUrl}\n\nLink valid for 24 hours.\n`;
  return sendEmail({ to, subject, text, html });
}

function isConfigured() {
  buildTransporter();
  return transporterMode === 'smtp';
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  isConfigured,
};
