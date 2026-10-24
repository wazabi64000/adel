import crypto from 'node:crypto';
import * as athleteRepo from '../../repositories/athlete.repo.js';
import * as programRepo from '../../repositories/program.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as progressRepo from '../../repositories/progressPhoto.repo.js';
import * as photoSessionRepo from '../../repositories/photoSession.repo.js';
import * as photoReportRepo from '../../repositories/photoReport.repo.js';
import * as authService from '../../services/auth.service.js';
import * as logRepo from '../../repositories/log.repo.js';
import { uploadImage, destroyImage } from '../../services/upload.service.js';
import { athleteStats } from '../../services/stats.service.js';
import { sendAthleteWelcome } from '../../services/mail.service.js';
import { validateAthlete } from '../../validators/index.js';
import { asyncHandler, clean, paginate, HttpError } from '../../utils/http.js';

const PHASES = ['avant', 'apres'];
const VIEWS = ['devant', 'dos', 'profil_droit', 'profil_gauche'];
const SESSION_VIEW_ORDER = ['devant', 'dos', 'profil_gauche', 'profil_droit', 'complementaire'];
const isoToday = () => new Date().toISOString().slice(0, 10);

/** Groupe les photos de séances envoyées par l'athlète (suivi) par séance. */
function groupSessionPhotos(rows) {
  const dates = [];
  const bySession = new Map();
  for (const photo of rows) {
    const sessionId = Number(photo.session_id);
    let group = bySession.get(sessionId);
    if (!group) {
      group = {
        key: String(sessionId),
        sessionId,
        date: photo.session_date,
        notes: photo.notes || '',
        reportStatus: photo.report_status || '',
        photos: [],
      };
      bySession.set(sessionId, group);
      dates.push(group);
    }
    group.photos.push({
      view: photo.view_key,
      url: `/admin/suivi/sessions/${sessionId}/file/${photo.view_key}`,
      sessionId,
      reportStatus: photo.report_status || '',
    });
  }
  for (const group of dates) {
    group.photos.sort(
      (a, b) => SESSION_VIEW_ORDER.indexOf(a.view) - SESSION_VIEW_ORDER.indexOf(b.view),
    );
  }
  return dates;
}

export const list = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 12 });
  const { rows, total } = await athleteRepo.list({
    search: clean(req.query.q) ?? '',
    level: clean(req.query.level),
    limit,
    offset,
  });
  return res.render('admin/athletes/list', {
    title: 'Profils sportifs',
    athletes: rows,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
    filters: { q: req.query.q ?? '', level: req.query.level ?? '' },
  });
});

export const show = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');
  const [programs, stats, logs, photos, photoReports, sentPhotoRows] = await Promise.all([
    programRepo.findByAthlete(athlete.id),
    athleteStats(athlete.id),
    logRepo.listByAthlete(athlete.id, { limit: 15, offset: 0 }),
    progressRepo.listByAthlete(athlete.id),
    photoReportRepo.listValidatedByAthlete(athlete.id),
    photoSessionRepo.listSentByAthlete(athlete.id),
  ]);
  return res.render('admin/athletes/show', {
    title: `${athlete.first_name} ${athlete.last_name}`,
    athlete,
    programs,
    stats,
    logs,
    photos,
    photoReports,
    sessionPhotoDates: groupSessionPhotos(sentPhotoRows),
    today: isoToday(),
  });
});

export const newForm = asyncHandler(async (req, res) => {
  return res.render('admin/athletes/form', {
    title: 'Nouveau profil sportif',
    athlete: null,
    formErrors: {},
    formData: {},
  });
});

export const create = asyncHandler(async (req, res) => {
  const { ok, errors, data } = validateAthlete(req.body);
  if (!ok) {
    return res.status(422).render('admin/athletes/form', {
      title: 'Nouveau profil sportif',
      athlete: null,
      formErrors: errors,
      formData: req.body,
    });
  }
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'athletes', originalName: req.file.originalname });
    data.photoUrl = url;
  }
  const id = await athleteRepo.create(data);

  // Création optionnelle d'un accès sportif + envoi des identifiants.
  if (req.body.create_account === '1') {
    if (!data.email) {
      req.flash('error', "Profil créé, mais l'accès n'a pas pu être ouvert : e-mail manquant.");
    } else {
      await provisionAccount(id, data, req);
    }
  } else {
    req.flash('success', 'Profil créé.');
  }
  return res.redirect(`/admin/athletes/${id}`);
});

export const editForm = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');
  return res.render('admin/athletes/form', {
    title: `Éditer — ${athlete.first_name} ${athlete.last_name}`,
    athlete,
    formErrors: {},
    formData: athlete,
  });
});

export const update = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');

  const { ok, errors, data } = validateAthlete(req.body);
  if (!ok) {
    return res.status(422).render('admin/athletes/form', {
      title: `Éditer — ${athlete.first_name} ${athlete.last_name}`,
      athlete,
      formErrors: errors,
      formData: req.body,
    });
  }
  data.photoUrl = athlete.photo_url;
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'athletes', originalName: req.file.originalname });
    data.photoUrl = url;
  }
  await athleteRepo.update(athlete.id, data);
  req.flash('success', 'Profil mis à jour.');
  return res.redirect(`/admin/athletes/${athlete.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (athlete?.user_id) {
    await userRepo.remove(athlete.user_id); // supprime aussi le profil (FK SET NULL) puis l'athlète
  }
  await athleteRepo.remove(req.params.id);
  req.flash('success', 'Profil supprimé.');
  return res.redirect('/admin/athletes');
});

/* ------------------------- Photos de progression ------------------------- */

/** Téléverse une photo avant/après (date + vue) pour un profil sportif. */
export const uploadPhoto = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');

  if (!req.file) {
    req.flash('error', 'Choisis une image à téléverser.');
    return res.redirect(`/admin/athletes/${athlete.id}#photos`);
  }

  const phase = PHASES.includes(req.body.phase) ? req.body.phase : 'avant';
  const view = VIEWS.includes(req.body.view_key) ? req.body.view_key : 'devant';
  const takenOn = /^\d{4}-\d{2}-\d{2}$/.test(req.body.taken_on || '')
    ? req.body.taken_on
    : isoToday();

  const { url, publicId } = await uploadImage(req.file.buffer, {
    folder: 'athletes/progress',
    originalName: req.file.originalname,
  });

  await progressRepo.create({
    athleteId: athlete.id,
    takenOn,
    phase,
    view,
    imageUrl: url,
    imagePublicId: publicId,
    notes: clean(req.body.notes),
  });

  req.flash('success', 'Photo de progression ajoutée.');
  return res.redirect(`/admin/athletes/${athlete.id}#photos`);
});

/** Supprime une photo de progression (vérifie l'appartenance à l'athlète). */
export const deletePhoto = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');

  const photo = await progressRepo.findById(req.params.photoId);
  if (photo && photo.athlete_id === athlete.id) {
    await destroyImage(photo.image_public_id);
    await progressRepo.remove(photo.id);
    req.flash('success', 'Photo supprimée.');
  }
  return res.redirect(`/admin/athletes/${athlete.id}#photos`);
});

/** Crée (ou réinitialise) le compte d'accès de l'athlète + e-mail de bienvenue. */
export const account = asyncHandler(async (req, res) => {
  const athlete = await athleteRepo.findById(req.params.id);
  if (!athlete) throw new HttpError(404, 'Profil introuvable.');
  if (!athlete.email) {
    req.flash('error', "Renseigne d'abord un e-mail sur le profil.");
    return res.redirect(`/admin/athletes/${athlete.id}`);
  }

  const tempPassword = crypto.randomBytes(4).toString('hex');
  if (athlete.user_id) {
    await authService.changePasswordByAdmin(athlete.user_id, tempPassword);
  } else {
    const userId = await userRepo.create({
      name: `${athlete.first_name} ${athlete.last_name}`,
      email: athlete.email.toLowerCase(),
      passwordHash: await authService.hashPassword(tempPassword),
      role: 'athlete',
      isActive: 1,
      mustChangePassword: 1,
    });
    await athleteRepo.linkUser(athlete.id, userId);
  }
  const mail = await sendAthleteWelcome({
    name: athlete.first_name,
    email: athlete.email,
    tempPassword,
  });

  if (mail.sent) {
    req.flash(
      'success',
      `Accès sportif activé. Identifiants envoyés à ${athlete.email}. Mot de passe provisoire : ${tempPassword}`,
    );
  } else if (mail.skipped) {
    req.flash(
      'info',
      `Accès activé (e-mail non envoyé : SMTP non configuré). Mot de passe provisoire : ${tempPassword}`,
    );
  } else {
    req.flash(
      'error',
      `Accès activé, mais l'e-mail a échoué. Mot de passe provisoire à transmettre manuellement : ${tempPassword}`,
    );
  }
  return res.redirect(`/admin/athletes/${athlete.id}`);
});

/** Utilitaire interne : crée le compte au moment de la création du profil. */
async function provisionAccount(athleteId, data, req) {
  const existing = await userRepo.findByEmail(data.email.toLowerCase());
  if (existing) {
    req.flash(
      'error',
      `Profil créé, mais cet e-mail (${data.email}) a déjà un compte. Relie ou réinitialise l'accès depuis la fiche.`,
    );
    return;
  }
  const tempPassword = crypto.randomBytes(4).toString('hex');
  const userId = await userRepo.create({
    name: `${data.firstName} ${data.lastName}`,
    email: data.email.toLowerCase(),
    passwordHash: await authService.hashPassword(tempPassword),
    role: 'athlete',
    isActive: 1,
    mustChangePassword: 1,
  });
  await athleteRepo.linkUser(athleteId, userId);
  const mail = await sendAthleteWelcome({ name: data.firstName, email: data.email, tempPassword });
  if (mail.sent) {
    req.flash(
      'success',
      `Profil et accès créés. Identifiants envoyés à ${data.email}. Mot de passe provisoire : ${tempPassword}`,
    );
  } else if (mail.skipped) {
    req.flash(
      'info',
      `Profil et accès créés (e-mail non envoyé : SMTP non configuré). Mot de passe provisoire : ${tempPassword}`,
    );
  } else {
    req.flash(
      'error',
      `Profil et accès créés, mais l'e-mail a échoué. Mot de passe provisoire : ${tempPassword}`,
    );
  }
}
