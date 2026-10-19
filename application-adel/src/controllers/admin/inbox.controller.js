import crypto from 'node:crypto';
import * as contactRepo from '../../repositories/contact.repo.js';
import * as accessRepo from '../../repositories/accessRequest.repo.js';
import * as athleteRepo from '../../repositories/athlete.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as authService from '../../services/auth.service.js';
import { sendAthleteWelcome } from '../../services/mail.service.js';
import { asyncHandler, paginate, HttpError } from '../../utils/http.js';

/* ----------------------------- Messages de contact ----------------------------- */

export const messages = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 20 });
  const { rows, total } = await contactRepo.list({ limit, offset });
  return res.render('admin/messages/list', {
    title: 'Messages',
    messages: rows,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
  });
});

export const markMessageRead = asyncHandler(async (req, res) => {
  await contactRepo.markRead(req.params.id);
  return res.redirect('/admin/messages');
});

export const deleteMessage = asyncHandler(async (req, res) => {
  await contactRepo.remove(req.params.id);
  req.flash('success', 'Message supprimé.');
  return res.redirect('/admin/messages');
});

/* --------------------------- Demandes d'accès sportif --------------------------- */

export const accessRequests = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 20 });
  const { rows, total } = await accessRepo.list({ status: req.query.status || undefined, limit, offset });
  return res.render('admin/requests/list', {
    title: "Demandes d'accès",
    requests: rows,
    filters: { status: req.query.status ?? '' },
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
  });
});

export const setRequestStatus = asyncHandler(async (req, res) => {
  const allowed = ['pending', 'approved', 'rejected'];
  const status = allowed.includes(req.body.status) ? req.body.status : 'pending';
  await accessRepo.setStatus(req.params.id, status);
  req.flash('success', 'Statut de la demande mis à jour.');
  return res.redirect('/admin/demandes');
});

export const deleteRequest = asyncHandler(async (req, res) => {
  await accessRepo.remove(req.params.id);
  req.flash('success', 'Demande supprimée.');
  return res.redirect('/admin/demandes');
});

/**
 * Crée l'accès sportif à partir d'une pré-inscription validée :
 * profil athlète + compte (mot de passe provisoire) + e-mail de bienvenue.
 */
export const createAccessFromRequest = asyncHandler(async (req, res) => {
  const request = await accessRepo.findById(req.params.id);
  if (!request) throw new HttpError(404, 'Demande introuvable.');
  if (request.athlete_id) {
    req.flash('info', 'Un accès existe déjà pour cette pré-inscription.');
    return res.redirect('/admin/demandes');
  }

  const email = String(request.email).trim().toLowerCase();
  const parts = String(request.full_name).trim().split(/\s+/);
  const firstName = parts.shift() || 'Sportif';
  const lastName = parts.join(' ') || '—';

  const tempPassword = crypto.randomBytes(4).toString('hex');
  const existing = await userRepo.findByEmail(email);
  let userId;
  if (existing) {
    userId = existing.id;
    await authService.changePasswordByAdmin(userId, tempPassword);
  } else {
    userId = await userRepo.create({
      name: `${firstName} ${lastName}`,
      email,
      passwordHash: await authService.hashPassword(tempPassword),
      role: 'athlete',
      isActive: 1,
      mustChangePassword: 1,
    });
  }

  const athleteId = await athleteRepo.create({
    userId,
    firstName,
    lastName,
    email,
    phone: request.phone ?? null,
    goal: request.message ?? null,
    level: 'debutant',
    isActive: 1,
  });

  await accessRepo.linkAthlete(request.id, athleteId);
  await accessRepo.setStatus(request.id, 'approved');
  const mail = await sendAthleteWelcome({ name: firstName, email, tempPassword });

  if (mail.sent) {
    req.flash(
      'success',
      `Accès créé pour ${firstName}. Identifiants envoyés à ${email}. Mot de passe provisoire : ${tempPassword}`,
    );
  } else if (mail.skipped) {
    req.flash(
      'info',
      `Accès créé pour ${firstName} (e-mail non envoyé : SMTP non configuré). Mot de passe provisoire : ${tempPassword}`,
    );
  } else {
    req.flash(
      'error',
      `Accès créé pour ${firstName}, mais l'e-mail a échoué. Mot de passe provisoire : ${tempPassword}`,
    );
  }
  return res.redirect(`/admin/athletes/${athleteId}`);
});
