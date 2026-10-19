import * as exerciseRepo from '../../repositories/exercise.repo.js';
import * as programDayRepo from '../../repositories/programDay.repo.js';
import { resolveCatalogGif } from '../../services/exerciseCatalog.service.js';
import { notifyActiveProgramContent } from '../../services/notify.service.js';
import { validateExercise } from '../../validators/index.js';
import { asyncHandler, clean, HttpError } from '../../utils/http.js';

/** Enrichit le body avec nom + GIF catalogue avant validation. */
function withCatalog(body, { required = true } = {}) {
  const catalogId = clean(body.catalog_id);
  if (!catalogId) {
    if (required) return { ok: false, error: 'Choisis un exercice dans le catalogue.' };
    return { ok: true, body };
  }
  const fromCatalog = resolveCatalogGif(catalogId);
  if (!fromCatalog) return { ok: false, error: 'Exercice catalogue introuvable.' };
  return {
    ok: true,
    body: {
      ...body,
      name: clean(body.name) || fromCatalog.name,
      image_url: fromCatalog.imageUrl,
      muscle_group: clean(body.muscle_group) || (fromCatalog.bodyParts || [])[0] || '',
      equipment: clean(body.equipment) || (fromCatalog.equipments || [])[0] || '',
    },
  };
}

/** Ajoute un exercice à une journée (GIF via catalogue uniquement). */
export const create = asyncHandler(async (req, res) => {
  const day = await programDayRepo.findById(req.params.dayId);
  if (!day) throw new HttpError(404, 'Journée introuvable.');

  const enriched = withCatalog(req.body, { required: true });
  if (!enriched.ok) {
    req.flash('error', enriched.error);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }

  const { ok, errors, data } = validateExercise(enriched.body);
  if (!ok) {
    req.flash('error', Object.values(errors)[0]);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }
  data.programDayId = day.id;
  await exerciseRepo.create(data);
  await notifyActiveProgramContent(day.program_id);
  req.flash('success', 'Exercice ajouté.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

/** Met à jour un exercice (changement de GIF via catalogue). */
export const update = asyncHandler(async (req, res) => {
  const exercise = await exerciseRepo.findById(req.params.id);
  if (!exercise) throw new HttpError(404, 'Exercice introuvable.');
  const day = await programDayRepo.findById(exercise.program_day_id);

  const enriched = withCatalog(req.body, { required: Boolean(clean(req.body.catalog_id)) });
  if (!enriched.ok) {
    req.flash('error', enriched.error);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }

  const { ok, errors, data } = validateExercise({
    ...enriched.body,
    name: enriched.body.name || exercise.name,
    image_url: enriched.body.image_url || exercise.image_url,
  });
  if (!ok) {
    req.flash('error', Object.values(errors)[0]);
    return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
  }
  if (!data.imageUrl) data.imageUrl = exercise.image_url;
  await exerciseRepo.update(exercise.id, data);
  await notifyActiveProgramContent(day.program_id);
  req.flash('success', 'Exercice mis à jour.');
  return res.redirect(`/admin/programs/${day.program_id}#day-${day.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  const exercise = await exerciseRepo.findById(req.params.id);
  if (!exercise) throw new HttpError(404, 'Exercice introuvable.');
  const day = await programDayRepo.findById(exercise.program_day_id);
  await exerciseRepo.remove(exercise.id);
  await notifyActiveProgramContent(day.program_id);
  req.flash('success', 'Exercice supprimé.');
  return res.redirect(`/admin/programs/${day.program_id}`);
});
