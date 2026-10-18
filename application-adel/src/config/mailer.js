import nodemailer from 'nodemailer';
import config from './env.js';

let transporter = null;

/** Crée (une seule fois) le transporteur SMTP Brevo. */
export function getTransporter() {
  if (transporter) return transporter;
  if (!config.mail.enabled) return null;

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465, // 465 = SSL, 587 = STARTTLS
    auth: {
      user: config.mail.user,
      pass: config.mail.password,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });

  return transporter;
}

export default { getTransporter };
