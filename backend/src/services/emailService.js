import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST || (EMAIL_USER && EMAIL_USER.endsWith('@gmail.com') ? 'smtp.gmail.com' : null);
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

let transporterPromise = null;

async function getTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
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
          connectionTimeout: 3000, // 3s fast fail on blocked cloud ports
          greetingTimeout: 3000,
          socketTimeout: 5000
        };
      } else {
        transportConfig = {
          service: 'gmail',
          auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
          },
          connectionTimeout: 3000,
          greetingTimeout: 3000,
          socketTimeout: 5000
        };
      }

      return nodemailer.createTransport(transportConfig);
    })();
  }

  return transporterPromise;
}

export async function sendPayslipEmail({ to, subject, html, attachments }) {
  // Option 1: Resend HTTP API (Recommended for Render - uses HTTPS port 443, never blocked)
  if (RESEND_API_KEY) {
    try {
      const fromAddress = process.env.EMAIL_FROM || EMAIL_USER || 'Payroll <onboarding@resend.dev>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: subject,
          html: html
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log('[Email] Payslip sent via Resend API to:', to);
        return { success: true, messageId: data.id };
      } else {
        console.error('[Email] Resend API error:', data);
        return { success: false, error: data.message || 'Resend API error' };
      }
    } catch (err) {
      console.error('[Email] Resend API exception:', err);
      return { success: false, error: err.message };
    }
  }

  // Option 2: Nodemailer SMTP
  const transporter = await getTransporter();
  if (!transporter) {
    return {
      success: false,
      skipped: true,
      reason: 'Email not configured (missing EMAIL_USER / EMAIL_PASS or RESEND_API_KEY).'
    };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || EMAIL_USER,
      to,
      subject,
      html,
      attachments: attachments || []
    });
    console.log('[Email] Payslip sent via SMTP to:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send email via SMTP:', error.message || error);
    return {
      success: false,
      error: `SMTP timeout on cloud host. Render blocks outbound SMTP ports (25/465/587). Add RESEND_API_KEY to Render environment variables to send emails via HTTP API.`
    };
  }
}
