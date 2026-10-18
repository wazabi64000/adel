import * as programDayRepo from '../../repositories/programDay.repo.js';
import * as programRepo from '../../repositories/program.repo.js';
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
  req.flash('success', 'Journée prête. Ajoute des exercices.');
  return res.redirect(`/admin/programs/${program.id}#day-${day.id}`);
});

/** Met à jour l'en-tête d'une journée. */
export const update = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');
  await programDayRepo.update(day.id, {
    title: clean(req.body.title),
    focus: clean(req.body.focus),
    notes: clean(req.body.notes),
    isRestDay: req.body.is_rest_day === '1' || req.body.is_rest_day === 'on',
  });
  req.flash('success', 'Journée mise à jour.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');
  await programDayRepo.remove(day.id);
  req.flash('success', 'Journée supprimée.');
  return res.redirect(`/admin/programs/${day.program_id}`);
});
