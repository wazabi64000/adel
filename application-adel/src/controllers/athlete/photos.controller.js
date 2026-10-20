import path from 'node:path';
import { query } from '../../config/database.js';
import { createImageAccessToken } from '../../services/photoSecurity.js';
import * as photoSessionRepo from '../../repositories/photoSession.repo.js';
import * as sessionPhotoRepo from '../../repositories/sessionPhoto.repo.js';
import * as photoCommentRepo from '../../repositories/photoComment.repo.js';
import { uploadImage, destroyImage } from '../../services/upload.service.js';
import { validatePhotoSession } from '../../validators/index.js';
import { asyncHandler, HttpError } from '../../utils/http.js';
import config from '../../config/env.js';

const VIEWS = ['devant', 'dos', 'profil_gauche', 'profil_droit', 'complementaire'];

export const list = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const sessions = await photoSessionRepo.listByAthlete(athlete.id);
  const sessionIds = sessions.map((s) => s.id);
  const photosBySession = {};
  if (sessionIds.length) {
    const photos = await query(
      `SELECT id, session_id, view_key, image_url, image_public_id, mime_type, file_size, created_at
       FROM session_photos WHERE session_id IN (?) ORDER BY session_id, view_key`,
      [sessionIds],
    );
    for (const p of photos) {
      if (!photosBySession[p.session_id]) photosBySession[p.session_id] = [];
      photosBySession[p.session_id].push(p);
    }
  }
  for (const s of sessions) s.photos = photosBySession[s.id] || [];
  return res.render('athlete/photos/list', {
    title: 'Suivi photographique',
    athlete,
    sessions,
  });
});

export const newForm = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  return res.render('athlete/photos/form', {
    title: 'Nouvelle séance photo',
    athlete,
    session: null,
    formErrors: {},
    formData: { session_date: new Date().toISOString().slice(0, 10) },
    views: VIEWS,
  });
});

export const create = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const { ok, errors, data } = validatePhotoSession(req.body);
  if (!ok) {
    return res.status(422).render('athlete/photos/form', {
      title: 'Nouvelle séance photo',
      athlete,
      session: null,
      formErrors: errors,
      formData: req.body,
      views: VIEWS,
    });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(422).render('athlete/photos/form', {
      title: 'Nouvelle séance photo',
      athlete,
      session: null,
      formErrors: { photo: 'Au moins une photo est obligatoire.' },
      formData: req.body,
      views: VIEWS,
    });
  }

  const sessionId = await photoSessionRepo.create({
    athleteId: athlete.id,
    sessionDate: data.sessionDate,
    notes: data.notes,
  });

  for (const file of files) {
    const viewKey = String(file.fieldname).replace(/^photo_/, '');
    if (!VIEWS.includes(viewKey)) continue;
    const { url, publicId } = await uploadImage(file.buffer, {
      folder: 'athletes/photos',
      originalName: file.originalname,
    });
    await sessionPhotoRepo.upsert({
      sessionId,
      viewKey,
      imageUrl: url,
      imagePublicId: publicId,
      mimeType: file.mimetype,
      fileSize: file.size,
    });
  }

  req.flash('success', 'Séance photo enregistrée.');
  return res.redirect(`/mon-espace/photos/${sessionId}`);
});

export const show = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const session = await photoSessionRepo.findByIdForAthlete(req.params.id, athlete.id);
  if (!session) throw new HttpError(404, 'Séance introuvable.');
  const photos = await sessionPhotoRepo.listBySession(session.id);
  const photosByView = {};
  for (const p of photos) {
    p.accessToken = createImageAccessToken(athlete.id, session.id, p.view_key);
    photosByView[p.view_key] = p;
  }
  const comments = await photoCommentRepo.listBySession(session.id, athlete.id);
  return res.render('athlete/photos/show', {
    title: 'Séance photo',
    athlete,
    session,
    photosByView,
    comments,
    views: VIEWS,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const session = await photoSessionRepo.findByIdForAthlete(req.params.id, athlete.id);
  if (!session) throw new HttpError(404, 'Séance introuvable.');
  const photos = await sessionPhotoRepo.listBySession(session.id);
  for (const p of photos) await destroyImage(p.image_public_id);
  await photoSessionRepo.remove(session.id, athlete.id);
  req.flash('success', 'Séance photo supprimée.');
  return res.redirect('/mon-espace/photos');
});

export const serveFile = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const session = await photoSessionRepo.findByIdForAthlete(
    req.params.sessionId,
    athlete.id,
  );
  if (!session) throw new HttpError(404, 'Séance introuvable.');

  const photos = await sessionPhotoRepo.listBySession(session.id);
  const photo = photos.find((p) => p.view_key === req.params.viewKey);
  if (!photo) throw new HttpError(404, 'Photo introuvable.');

  // Si l'image est sur Cloudinary (URL externe), redirige après vérification.
  if (photo.image_url.startsWith('http://') || photo.image_url.startsWith('https://')) {
    return res.redirect(photo.image_url);
  }

  // Sinon, fichier local stocké hors d'une URL publique permanente.
  const filePath = path.join(config.PUBLIC_DIR, photo.image_url.replace(/^\//, ''));
  res.sendFile(filePath, (err) => {
    if (err) throw new HttpError(404, 'Fichier introuvable.');
  });
});

export const addComment = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const session = await photoSessionRepo.findByIdForAthlete(req.params.sessionId, athlete.id);
  if (!session) throw new HttpError(404, 'Séance introuvable.');

  const content = String(req.body.content || '').trim();
  if (!content) {
    req.flash('error', 'Le commentaire ne peut pas être vide.');
    return res.redirect(`/mon-espace/photos/${req.params.sessionId}`);
  }

  await photoCommentRepo.create({
    sessionId: session.id,
    authorId: athlete.id,
    content,
  });

  req.flash('success', 'Commentaire ajouté.');
  return res.redirect(`/mon-espace/photos/${req.params.sessionId}`);
});

export const deleteComment = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  await photoCommentRepo.remove(req.params.commentId, athlete.id);
  req.flash('success', 'Commentaire supprimé.');
  return res.redirect(`/mon-espace/photos/${req.params.sessionId}`);
});

export const compareForm = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  return res.render('athlete/photos/compare', {
    title: 'Comparatif photo',
    athlete,
    views: VIEWS,
  });
});

export const compareResult = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const { view, date1, date2 } = req.query;
  if (!view || !VIEWS.includes(view)) throw new HttpError(400, 'Vue invalide.');
  const all = await photoSessionRepo.listWithView(athlete.id, view);
  let filtered = all;
  if (date1) filtered = filtered.filter((s) => String(s.session_date) >= date1);
  if (date2) filtered = filtered.filter((s) => String(s.session_date) <= date2);
  return res.render('athlete/photos/compare', {
    title: 'Comparatif photo',
    athlete,
    views: VIEWS,
    selectedView: view,
    date1,
    date2,
    photos: filtered,
  });
});
