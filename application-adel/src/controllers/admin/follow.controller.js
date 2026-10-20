import * as photoSessionRepo from '../../repositories/photoSession.repo.js';
import * as sessionPhotoRepo from '../../repositories/sessionPhoto.repo.js';
import * as photoCommentRepo from '../../repositories/photoComment.repo.js';
import * as photoReportRepo from '../../repositories/photoReport.repo.js';
import * as athleteRepo from '../../repositories/athlete.repo.js';
import { sendPhotoReview } from '../../services/mail.service.js';
import { asyncHandler, HttpError } from '../../utils/http.js';
import config from '../../config/env.js';

const VIEW_LABELS = {
  devant: 'Devant',
  dos: 'Dos',
  profil_gauche: 'Profil gauche',
  profil_droit: 'Profil droit',
  complementaire: 'Complémentaire',
};
const VIEW_ORDER = Object.keys(VIEW_LABELS);

function formatWhen(value, withTime = false) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: config.timezone || 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

async function loadSession(id) {
  const session = await photoSessionRepo.findById(id);
  if (!session) throw new HttpError(404, 'Séance photo introuvable.');
  return session;
}

async function reviewPayload(session, viewerId) {
  const [athlete, photos, comments, report] = await Promise.all([
    athleteRepo.findById(session.athlete_id),
    sessionPhotoRepo.listBySession(session.id),
    photoCommentRepo.listAllBySession(session.id),
    photoReportRepo.findBySession(session.id),
  ]);
  photos.sort((a, b) => VIEW_ORDER.indexOf(a.view_key) - VIEW_ORDER.indexOf(b.view_key));
  return {
    athlete: athlete
      ? { id: athlete.id, firstName: athlete.first_name, lastName: athlete.last_name }
      : null,
    session: {
      id: session.id,
      dateLabel: formatWhen(session.session_date),
      notes: session.notes || '',
    },
    photos: photos.map((p) => ({
      view: p.view_key,
      label: VIEW_LABELS[p.view_key] || p.view_key,
      url: p.image_url,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author_role === 'admin' ? 'Coach' : c.author_name,
      content: c.content,
      createdAt: formatWhen(c.created_at, true),
      mine: Number(c.author_id) === Number(viewerId),
    })),
    report: report
      ? {
          content: report.content,
          status: report.status,
          validatedAt: formatWhen(report.validated_at, true),
          sentAt: formatWhen(report.sent_at, true),
        }
      : null,
  };
}

function readContent(body, max) {
  const content = String(body?.content || '').trim();
  if (!content) return { error: 'Le texte ne peut pas être vide.' };
  if (content.length > max) return { error: `Le texte dépasse ${max} caractères.` };
  return { content };
}

export const show = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  return res.json(await reviewPayload(session, req.currentUser.id));
});

export const addComment = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  const { content, error } = readContent(req.body, 1000);
  if (error) throw new HttpError(422, error);
  await photoCommentRepo.create({
    sessionId: session.id,
    authorId: req.currentUser.id,
    content,
  });
  return res.status(201).json(await reviewPayload(session, req.currentUser.id));
});

export const saveReport = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  const { content, error } = readContent(req.body, 4000);
  if (error) throw new HttpError(422, error);
  await photoReportRepo.saveContent({
    sessionId: session.id,
    athleteId: session.athlete_id,
    authorId: req.currentUser.id,
    content,
  });
  return res.json(await reviewPayload(session, req.currentUser.id));
});

export const validateReport = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  const { content, error } = readContent(req.body, 4000);
  if (error) throw new HttpError(422, error);
  await photoReportRepo.validate({
    sessionId: session.id,
    athleteId: session.athlete_id,
    authorId: req.currentUser.id,
    content,
  });

  const athlete = await athleteRepo.findById(session.athlete_id);
  const email = (athlete?.email || athlete?.login_email || '').trim();
  const comments = await photoCommentRepo.listAllBySession(session.id);
  let sent = false;
  if (email) {
    const result = await sendPhotoReview({
      name: athlete.first_name,
      email,
      dateLabel: formatWhen(session.session_date),
      comments: comments.map((c) => ({
        author: c.author_role === 'admin' ? 'Coach' : c.author_name,
        content: c.content,
      })),
      report: content,
      sessionUrl: `${config.appUrl}/mon-espace/photos/${session.id}`,
    });
    sent = Boolean(result.sent);
    if (sent) await photoReportRepo.markSent(session.id);
  }

  const payload = await reviewPayload(session, req.currentUser.id);
  payload.delivery = sent
    ? { sent: true }
    : { sent: false, reason: email ? 'mail' : 'no-email' };
  return res.json(payload);
});
