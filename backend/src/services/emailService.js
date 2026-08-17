import nodemailer from 'nodemailer';

// Reuse the same EMAIL_USER / EMAIL_PASS config as the email-blaster app
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const SMTP_HOST = process.env.SMTP_HOST || (EMAIL_USER && EMAIL_USER.endsWith('@gmail.com') ? 'smtp.gmail.com' : null);
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

let transporterPromise = null;

async function getTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(
      '[Email] EMAIL_USER or EMAIL_PASS is not set. Email sending is disabled.'
    );
    return null;
  }

  if (!transporterPromise) {
    transporterPromise = (async () => {
      let transportConfig;

      if (SMTP_HOST) {
        transportConfig = {
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_SECURE,
          requireTLS: !SMTP_SECURE,
          auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        };
      } else {
        transportConfig = {
          service: 'gmail',
          auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);

      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP verification timed out (10s)')), 10000)
          )
        ]);
        console.log('[Email] SMTP connection verified successfully.');
      } catch (error) {
        console.error('[Email] Failed to verify SMTP connection:', error.message || error);
        console.warn(
          '[Email] Render / Cloud SMTP Connection Tips:\n' +
          '  1. Port 465 is often blocked by cloud providers like Render. Use port 587 with TLS.\n' +
          '  2. Ensure you are using a 16-character Gmail App Password (not standard account password).\n' +
          '  3. Set environment variables on Render if using custom SMTP: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false'
        );
      }

      return transporter;
    })();
  }

  return transporterPromise;
}

export async function sendPayslipEmail({ to, subject, html, attachments }) {
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      success: false,
      skipped: true,
      reason: 'Email not configured (missing EMAIL_USER / EMAIL_PASS).'
    };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject,
      html,
      attachments: attachments || []
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send email:', error.message || error);
    return { success: false, error: error.message };
  }
}
