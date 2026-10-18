import { getTransporter } from '../config/mailer.js';
import config from '../config/env.js';

/* -------------------------------------------------------------------------- */
/*  Enveloppe HTML commune                                                    */
/* -------------------------------------------------------------------------- */
function layout({ title, body }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#191919;color:#fffef7;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <p style="font-size:20px;font-weight:900;letter-spacing:-.02em;margin:0 0 16px">COACH<span style="color:#ffd12f">ADEL</span></p>
      <div style="background:#212121;border:1px solid rgba(255,209,47,.14);border-radius:16px;padding:24px">
        <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
        ${body}
      </div>
      <p style="color:rgba(255,254,247,.5);font-size:12px;margin-top:16px">
        Cet e-mail a été envoyé automatiquement — merci de ne pas y répondre directement.
      </p>
    </div>
  </body></html>`;
}

const pStyle = 'color:rgba(255,254,247,.85);line-height:1.6;margin:8px 0';

/**
 * Envoi générique — ne fait jamais échouer le flux principal.
 * @returns {Promise<{sent:boolean, skipped?:boolean, error?:string}>}
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!config.mail.enabled) {
    console.warn(`[mail] SMTP non configuré — envoi ignoré (à: ${to}, sujet: ${subject})`);
    return { sent: false, skipped: true };
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${config.mail.fromName}" <${config.mail.fromEmail}>`,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    return { sent: true };
  } catch (err) {
    console.error('[mail] Échec envoi :', err.message);
    return { sent: false, error: err.message };
  }
}

export function sendContactNotification({ name, email, phone, message }) {
  return sendMail({
    to: config.mail.fromEmail,
    replyTo: email,
    subject: `Nouveau message de ${name}`,
    html: layout({
      title: 'Nouveau message depuis le site',
      body: `<p style="${pStyle}"><strong>${name}</strong></p>
        <p style="${pStyle}">E-mail : ${email}${phone ? ` — Tél : ${phone}` : ''}</p>
        <p style="${pStyle};white-space:pre-line">${String(message).replace(/</g, '&lt;')}</p>`,
    }),
  });
}

export function sendAccessRequestNotification({ fullName, email, phone, message, approveUrl, uuid }) {
  const button = approveUrl
    ? `<p style="${pStyle};margin-top:16px">
         <a href="${approveUrl}" style="display:inline-block;background:#ffd12f;color:#191919;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:10px">Valider cette pré-inscription</a>
       </p>
       <p style="color:rgba(255,254,247,.5);font-size:12px;word-break:break-all">Référence : ${uuid}<br>Lien : ${approveUrl}</p>`
    : '';
  return sendMail({
    to: config.mail.fromEmail,
    replyTo: email,
    subject: `Pré-inscription — ${fullName}`,
    html: layout({
      title: 'Nouvelle pré-inscription au programme',
      body: `<p style="${pStyle}"><strong>${fullName}</strong></p>
        <p style="${pStyle}">E-mail : ${email}${phone ? ` — Tél : ${phone}` : ''}</p>
        ${message ? `<p style="${pStyle};white-space:pre-line">${String(message).replace(/</g, '&lt;')}</p>` : ''}
        ${button}`,
    }),
    text: `Pré-inscription de ${fullName} (${email}${phone ? `, ${phone}` : ''}).${approveUrl ? ` Valider : ${approveUrl}` : ''}`,
  });
}

export function sendAthleteWelcome({ name, email, tempPassword }) {
  return sendMail({
    to: email,
    subject: 'Ton espace sportif Coach Adel est ouvert',
    html: layout({
      title: `Bienvenue ${name} !`,
      body: `<p style="${pStyle}">Ton accès au programme est validé. Tu peux y consulter tes programmes jour par jour et enregistrer tes séances.</p>
        <p style="${pStyle}"><strong>Identifiant :</strong> ${email}<br>
        <strong>Mot de passe provisoire :</strong> ${tempPassword}</p>
        <p style="${pStyle}">À ta première connexion, tu devras choisir ton propre mot de passe.</p>
        <p style="${pStyle}"><a href="${config.appUrl}/login" style="color:#ffd12f">Accéder à mon espace</a></p>`,
    }),
    text: `Bienvenue ${name}. Identifiant : ${email} — Mot de passe provisoire : ${tempPassword}. Tu devras le changer à la première connexion.`,
  });
}

export function sendPasswordReset({ email, resetUrl }) {
  return sendMail({
    to: email,
    subject: 'Réinitialisation de ton mot de passe',
    html: layout({
      title: 'Réinitialiser ton mot de passe',
      body: `<p style="${pStyle}">Une demande de réinitialisation a été effectuée pour ce compte.</p>
        <p style="${pStyle}">Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.</p>
        <p style="${pStyle}"><a href="${resetUrl}" style="color:#ffd12f">Choisir un nouveau mot de passe</a></p>`,
    }),
    text: `Réinitialisation du mot de passe : ${resetUrl}`,
  });
}

export default { sendMail, sendContactNotification, sendAccessRequestNotification, sendAthleteWelcome, sendPasswordReset };
