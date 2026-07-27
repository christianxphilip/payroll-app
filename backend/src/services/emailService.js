import nodemailer from 'nodemailer';

// Reuse the same EMAIL_USER / EMAIL_PASS config as the email-blaster app
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

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
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        }
      });

      try {
        await transporter.verify();
        console.log('[Email] SMTP connection verified.');
      } catch (error) {
        console.error('[Email] Failed to verify SMTP connection:', error);
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
    console.error('[Email] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}


