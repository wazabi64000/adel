import * as programDayRepo from '../../repositories/programDay.repo.js';
import * as programRepo from '../../repositories/program.repo.js';
import { notifyActiveProgramContent } from '../../services/notify.service.js';
import {
  normalizeSessionFocus,
  sessionTypeFromFocus,
} from '../../services/programBuilder.service.js';
import { validateProgramDay } from '../../validators/index.js';
import { asyncHandler, toInt, clean, HttpError } from '../../utils/http.js';

/** Crée (ou récupère) une journée de programme. */
export const ensure = asyncHandler(async (req, res) => {
  const program = await programRepo.findById(req.params.id);
  if (!program) throw new HttpError(404, 'Programme introuvable.');

  const weekNumber = toInt(req.body.week_number) ?? 1;
  const dayOfWeek = toInt(req.body.day_of_week);
  if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new HttpError(422, 'Jour de la semaine invalide (1 = lundi … 7 = dimanche).');
  }
  if (weekNumber < 1 || weekNumber > 52) {
    throw new HttpError(422, 'Numéro de semaine invalide.');
  }

  const day = await programDayRepo.ensureDay(program.id, weekNumber, dayOfWeek);
  await notifyActiveProgramContent(program.id);
  req.flash('success', 'Journée prête. Ajoute des exercices.');
  return res.redirect(`/admin/programs/${program.id}#day-${day.id}`);
});

/** Met à jour l'en-tête d'une journée. */
export const update = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');
  const { ok, errors, data } = validateProgramDay(req.body);
  if (!ok) {
    req.flash('error', Object.values(errors)[0] || 'Données de séance invalides.');
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }
  const focus = normalizeSessionFocus(data.focus ?? req.body.focus);
  await programDayRepo.update(day.id, {
    title: data.title,
    focus,
    sessionType: sessionTypeFromFocus(focus, data.sessionType ?? req.body.session_type),
    scheduledTime: data.scheduledTime || '18:00:00',
    notes: data.notes,
    isRestDay: data.isRestDay,
  });
  await notifyActiveProgramContent(day.program_id);
  req.flash('success', 'Journée mise à jour.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');
  await programDayRepo.remove(day.id);
  await notifyActiveProgramContent(day.program_id);
  req.flash('success', 'Journée supprimée.');
  return res.redirect(`/admin/programs/${day.program_id}`);
});
