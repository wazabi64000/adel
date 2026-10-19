import { getTransporter } from '../config/mailer.js';
import config from '../config/env.js';

/* -------------------------------------------------------------------------- */
/*  Enveloppe HTML commune                                                    */
/* -------------------------------------------------------------------------- */
function layout({ title, body }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#1c1a18;color:#f5f1ea;font-family:Barlow,system-ui,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <p style="font-size:22px;font-weight:700;letter-spacing:.04em;margin:0 0 16px;font-family:Bebas Neue,Impact,sans-serif">COACH<span style="color:#ef8a2c">ADEL</span></p>
      <div style="background:#252220;border:1px solid rgba(255,255,255,.1);border-radius:2px;padding:24px">
        <h1 style="font-size:20px;margin:0 0 12px;font-family:Bebas Neue,Impact,sans-serif;letter-spacing:.03em">${title}</h1>
        ${body}
      </div>
      <p style="color:#a39d94;font-size:12px;margin-top:16px">
        Cet e-mail a été envoyé automatiquement — merci de ne pas y répondre directement.
      </p>
    </div>
  </body></html>`;
}

const pStyle = 'color:#a39d94;line-height:1.6;margin:8px 0';
const btnStyle =
  'display:inline-block;background:#ef8a2c;color:#1c1a18;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:2px;letter-spacing:.08em;text-transform:uppercase;font-size:13px';

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
      body: `<p style="${pStyle}"><strong style="color:#f5f1ea">${name}</strong></p>
        <p style="${pStyle}">E-mail : ${email}${phone ? ` — Tél : ${phone}` : ''}</p>
        <p style="${pStyle};white-space:pre-line">${String(message).replace(/</g, '&lt;')}</p>`,
    }),
  });
}

export function sendAccessRequestNotification({ fullName, email, phone, message, approveUrl, uuid }) {
  const button = approveUrl
    ? `<p style="${pStyle};margin-top:16px">
         <a href="${approveUrl}" style="${btnStyle}">Valider cette pré-inscription</a>
       </p>
       <p style="color:#a39d94;font-size:12px;word-break:break-all">Référence : ${uuid}<br>Lien : ${approveUrl}</p>`
    : '';
  return sendMail({
    to: config.mail.fromEmail,
    replyTo: email,
    subject: `Pré-inscription — ${fullName}`,
    html: layout({
      title: 'Nouvelle pré-inscription au programme',
      body: `<p style="${pStyle}"><strong style="color:#f5f1ea">${fullName}</strong></p>
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
        <p style="${pStyle}"><strong style="color:#f5f1ea">Identifiant :</strong> ${email}<br>
        <strong style="color:#f5f1ea">Mot de passe provisoire :</strong> ${tempPassword}</p>
        <p style="${pStyle}">À ta première connexion, tu devras choisir ton propre mot de passe.</p>
        <p style="${pStyle};margin-top:16px"><a href="${config.appUrl}/login" style="${btnStyle}">Accéder à mon espace</a></p>`,
    }),
    text: `Bienvenue ${name}. Identifiant : ${email} — Mot de passe provisoire : ${tempPassword}. Tu devras le changer à la première connexion. Connexion : ${config.appUrl}/login`,
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
        <p style="${pStyle};margin-top:16px"><a href="${resetUrl}" style="${btnStyle}">Choisir un nouveau mot de passe</a></p>`,
    }),
    text: `Réinitialisation du mot de passe : ${resetUrl}`,
  });
}

/**
 * Informe le sportif d'un changement sur son programme.
 * @param {'created'|'updated'|'activated'|'archived'|'content'} kind
 */
export function sendProgramUpdate({ name, email, programTitle, kind }) {
  const copy = {
    created: {
      subject: `Nouveau programme : ${programTitle}`,
      title: 'Nouveau programme disponible',
      lead: `Coach Adel t'a préparé un programme : <strong style="color:#f5f1ea">${programTitle}</strong>.`,
    },
    updated: {
      subject: `Programme mis à jour : ${programTitle}`,
      title: 'Ton programme a été mis à jour',
      lead: `Des modifications ont été apportées à <strong style="color:#f5f1ea">${programTitle}</strong>.`,
    },
    activated: {
      subject: `Programme activé : ${programTitle}`,
      title: 'Ton programme est actif',
      lead: `<strong style="color:#f5f1ea">${programTitle}</strong> est maintenant actif. Tu peux commencer tes séances.`,
    },
    archived: {
      subject: `Programme archivé : ${programTitle}`,
      title: 'Programme archivé',
      lead: `<strong style="color:#f5f1ea">${programTitle}</strong> a été archivé. Il reste consultable dans ton historique.`,
    },
    content: {
      subject: `Séances mises à jour : ${programTitle}`,
      title: 'Tes séances ont évolué',
      lead: `Des jours ou exercices ont été modifiés dans <strong style="color:#f5f1ea">${programTitle}</strong>.`,
    },
  }[kind] || {
    subject: `Mise à jour : ${programTitle}`,
    title: 'Mise à jour de ton programme',
    lead: `Une mise à jour concerne <strong style="color:#f5f1ea">${programTitle}</strong>.`,
  };

  return sendMail({
    to: email,
    subject: copy.subject,
    html: layout({
      title: copy.title,
      body: `<p style="${pStyle}">Bonjour ${name},</p>
        <p style="${pStyle}">${copy.lead}</p>
        <p style="${pStyle}">Connecte-toi pour voir le détail jour par jour.</p>
        <p style="${pStyle};margin-top:16px"><a href="${config.appUrl}/mon-espace" style="${btnStyle}">Ouvrir mon espace</a></p>`,
    }),
    text: `Bonjour ${name}. ${copy.title} — ${programTitle}. Espace : ${config.appUrl}/mon-espace`,
  });
}

export default {
  sendMail,
  sendContactNotification,
  sendAccessRequestNotification,
  sendAthleteWelcome,
  sendPasswordReset,
  sendProgramUpdate,
};
