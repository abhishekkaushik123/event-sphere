const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

/**
 * Sends an email. When SMTP_HOST is not configured (local development) the message is
 * printed to the console instead, so the OTP flow can be tested without a mail account.
 * Email failures never break the main request: they are logged and swallowed.
 */
module.exports = async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { dev: true };
  }
  try {
    return await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'Event Sphere <no-reply@eventsphere.local>',
      to,
      subject,
      text,
      html: html || `<pre style="font-family:inherit">${text}</pre>`,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { error: err.message };
  }
};
