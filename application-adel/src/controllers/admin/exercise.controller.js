import * as exerciseRepo from '../../repositories/exercise.repo.js';
import * as programDayRepo from '../../repositories/programDay.repo.js';
import { uploadImage } from '../../services/upload.service.js';
import { validateExercise } from '../../validators/index.js';
import { asyncHandler, clean, toInt, HttpError } from '../../utils/http.js';

function readForm(body) {
  const { ok, errors, data } = validateExercise(body);
  return { ok, errors, data };
}

/** Ajoute un exercice à une journée. */
export const create = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');

  const { ok, errors, data } = readForm(req.body);
  if (!ok) {
    req.flash('error', Object.values(errors)[0]);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }
  data.programDayId = day.id;
  // Upload prioritaire ; sinon lien collé dans image_url.
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'exercises', originalName: req.file.originalname });
    data.imageUrl = url;
  }
  await exerciseRepo.create(data);
  req.flash('success', 'Exercice ajouté.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

/** Met à jour un exercice (image remplaçable). */
export const update = asyncHandler(async (req, res) => {
  const exercise = await exerciseRepo.findById(req.params.id);
  if (!exercise) throw new HttpError(404, 'Exercice introuvable.');
  const day = await programDayRepo.findById(exercise.program_day_id);

  const { ok, errors, data } = readForm(req.body);
  if (!ok) {
    req.flash('error', Object.values(errors)[0]);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }
  // Upload > lien collé > image déjà enregistrée.
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'exercises', originalName: req.file.originalname });
    data.imageUrl = url;
  } else if (!data.imageUrl) {
    data.imageUrl = exercise.image_url;
  }
  await exerciseRepo.update(exercise.id, data);
  req.flash('success', 'Exercice mis à jour.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  const exercise = await exerciseRepo.findById(req.params.id);
  if (!exercise) throw new HttpError(404, 'Exercice introuvable.');
  const day = await programDayRepo.findById(exercise.program_day_id);
  await exerciseRepo.remove(exercise.id);
  req.flash('success', 'Exercice supprimé.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});
