import * as programRepo from '../../repositories/program.repo.js';
import * as programDayRepo from '../../repositories/programDay.repo.js';
import * as exerciseRepo from '../../repositories/exercise.repo.js';
import * as athleteRepo from '../../repositories/athlete.repo.js';
import { programStats } from '../../services/stats.service.js';
import { validateProgram } from '../../validators/index.js';
import { asyncHandler, clean, paginate, HttpError } from '../../utils/http.js';

export const list = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 12 });
  const { rows, total } = await programRepo.list({
    athleteId: clean(req.query.athlete_id),
    location: clean(req.query.location),
    status: clean(req.query.status),
    search: clean(req.query.q) ?? '',
    limit,
    offset,
  });
  const [athletes] = [await athleteRepo.findAllActive()];
  return res.render('admin/programs/list', {
    title: 'Programmes',
    programs: rows,
    athletes,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
    filters: {
      q: req.query.q ?? '',
      status: req.query.status ?? '',
      location: req.query.location ?? '',
      athlete_id: req.query.athlete_id ?? '',
    },
  });
});

export const newForm = asyncHandler(async (req, res) => {
  const athletes = await athleteRepo.findAllActive();
  return res.render('admin/programs/form', {
    title: 'Nouveau programme',
    program: null,
    athletes,
    presetAthleteId: clean(req.query.athlete_id),
    formErrors: {},
    formData: {},
  });
});

export const create = asyncHandler(async (req, res) => {
  const athletes = await athleteRepo.findAllActive();
  const { ok, errors, data } = validateProgram(req.body);
  if (!ok) {
    return res.status(422).render('admin/programs/form', {
      title: 'Nouveau programme',
      program: null,
      athletes,
      presetAthleteId: null,
      formErrors: errors,
      formData: req.body,
    });
  }
  data.createdBy = req.currentUser.id;
  const id = await programRepo.create(data);
  req.flash('success', 'Programme créé. Ajoute maintenant les jours et les exercices.');
  return res.redirect(`/admin/programs/${id}`);
});

export const show = asyncHandler(async (req, res) => {
  const program = await programRepo.findById(req.params.id);
  if (!program) throw new HttpError(404, 'Programme introuvable.');

  const days = await programDayRepo.listByProgram(program.id);
  const daysWithExercises = await Promise.all(
    days.map(async (day) => ({
      ...day,
      exercises: await exerciseRepo.listByDay(day.id),
    })),
  );
  const stats = await programStats(program);

  return res.render('admin/programs/show', {
    title: program.title,
    program,
    days: daysWithExercises,
    stats,
  });
});

export const editForm = asyncHandler(async (req, res) => {
  const [program, athletes] = await Promise.all([
    programRepo.findById(req.params.id),
    athleteRepo.findAllActive(),
  ]);
  if (!program) throw new HttpError(404, 'Programme introuvable.');
  return res.render('admin/programs/form', {
    title: `Éditer — ${program.title}`,
    program,
    athletes,
    presetAthleteId: null,
    formErrors: {},
    formData: program,
  });
});

export const update = asyncHandler(async (req, res) => {
  const program = await programRepo.findById(req.params.id);
  if (!program) throw new HttpError(404, 'Programme introuvable.');

  const athletes = await athleteRepo.findAllActive();
  const { ok, errors, data } = validateProgram(req.body);
  if (!ok) {
    return res.status(422).render('admin/programs/form', {
      title: `Éditer — ${program.title}`,
      program,
      athletes,
      presetAthleteId: null,
      formErrors: errors,
      formData: req.body,
    });
  }
  await programRepo.update(program.id, data);
  req.flash('success', 'Programme mis à jour.');
  return res.redirect(`/admin/programs/${program.id}`);
});

export const setStatus = asyncHandler(async (req, res) => {
  const allowed = ['draft', 'active', 'archived'];
  const status = clean(req.body.status);
  if (!allowed.includes(status)) throw new HttpError(422, 'Statut invalide.');
  await programRepo.setStatus(req.params.id, status);
  req.flash('success', 'Statut du programme mis à jour.');
  return res.redirect(`/admin/programs/${req.params.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  await programRepo.remove(req.params.id);
  req.flash('success', 'Programme supprimé.');
  return res.redirect('/admin/programs');
});
