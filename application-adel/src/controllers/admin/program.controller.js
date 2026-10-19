import * as programRepo from '../../repositories/program.repo.js';
import * as programDayRepo from '../../repositories/programDay.repo.js';
import * as exerciseRepo from '../../repositories/exercise.repo.js';
import * as athleteRepo from '../../repositories/athlete.repo.js';
import { programStats } from '../../services/stats.service.js';
import { notifyProgramChange } from '../../services/notify.service.js';
import {
  BODY_FOCUS_OPTIONS,
  parseSessionTemplates,
  resolveExerciseImages,
  generateFromTemplates,
} from '../../services/programBuilder.service.js';
import {
  listFamilies,
  listMuscleRegions,
  listSessionFocusOptions,
} from '../../services/exerciseCatalog.service.js';
import { validateProgram } from '../../validators/index.js';
import { asyncHandler, clean, paginate, HttpError } from '../../utils/http.js';

function builderLocals(extra = {}) {
  const families = listFamilies();
  const regions = listMuscleRegions();
  const sessionFocus = listSessionFocusOptions();
  return {
    bodyFocusOptions: BODY_FOCUS_OPTIONS,
    bodyFocusOptionsJson: JSON.stringify(BODY_FOCUS_OPTIONS),
    catalogFamilies: families,
    catalogFamiliesJson: JSON.stringify(families),
    catalogRegions: regions,
    catalogRegionsJson: JSON.stringify(regions),
    sessionFocusOptions: sessionFocus,
    sessionFocusOptionsJson: JSON.stringify(sessionFocus),
    ...extra,
  };
}

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
  const athletes = await athleteRepo.findAllActive();
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
  return res.render(
    'admin/programs/form',
    builderLocals({
      title: 'Nouveau programme',
      program: null,
      athletes,
      presetAthleteId: clean(req.query.athlete_id),
      formErrors: {},
      formData: { weeks: 4, sessions_per_week: 3, status: 'active', location: 'salle', level: 'debutant' },
    }),
  );
});

export const create = asyncHandler(async (req, res) => {
  const athletes = await athleteRepo.findAllActive();
  const { ok, errors, data } = validateProgram(req.body);
  let templates = parseSessionTemplates(req.body);

  if (ok && templates.length === 0) {
    errors.sessions = 'Ajoute au moins une séance type avec un exercice.';
  }
  if (ok && templates.length > 0 && templates.every((t) => t.exercises.length === 0)) {
    errors.sessions = 'Chaque séance doit contenir au moins un exercice (nom).';
  }

  if (!ok || errors.sessions) {
    return res.status(422).render(
      'admin/programs/form',
      builderLocals({
        title: 'Nouveau programme',
        program: null,
        athletes,
        presetAthleteId: null,
        formErrors: errors,
        formData: req.body,
      }),
    );
  }

  // Aligner le nombre de modèles sur sessions_per_week.
  if (templates.length > data.sessionsPerWeek) {
    templates = templates.slice(0, data.sessionsPerWeek);
  }
  while (templates.length < data.sessionsPerWeek) {
    templates.push({
      sessionType: 'full_body',
      focus: 'Tout le corps',
      title: `Séance ${templates.length + 1}`,
      exercises: [],
    });
  }

  data.createdBy = req.currentUser.id;
  const id = await programRepo.create(data);

  try {
    const resolved = await resolveExerciseImages(templates);
    await generateFromTemplates(id, data.weeks, data.sessionsPerWeek, resolved);
  } catch (err) {
    await programRepo.remove(id);
    throw err;
  }

  const mail = await notifyProgramChange(id, data.status === 'active' ? 'activated' : 'created');
  req.flash(
    'success',
    mail.sent
      ? 'Programme créé avec ses séances. Le sportif a été informé par e-mail (lien vers le programme).'
      : 'Programme créé avec ses séances.',
  );
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

  return res.render(
    'admin/programs/show',
    builderLocals({
      title: program.title,
      program,
      days: daysWithExercises,
      stats,
    }),
  );
});

export const editForm = asyncHandler(async (req, res) => {
  const [program, athletes] = await Promise.all([
    programRepo.findById(req.params.id),
    athleteRepo.findAllActive(),
  ]);
  if (!program) throw new HttpError(404, 'Programme introuvable.');
  return res.render(
    'admin/programs/form',
    builderLocals({
      title: `Éditer — ${program.title}`,
      program,
      athletes,
      presetAthleteId: null,
      formErrors: {},
      formData: {
        ...program,
        sessions_per_week: program.sessions_per_week,
      },
    }),
  );
});

export const update = asyncHandler(async (req, res) => {
  const program = await programRepo.findById(req.params.id);
  if (!program) throw new HttpError(404, 'Programme introuvable.');

  const athletes = await athleteRepo.findAllActive();
  const { ok, errors, data } = validateProgram(req.body);
  if (!ok) {
    return res.status(422).render(
      'admin/programs/form',
      builderLocals({
        title: `Éditer — ${program.title}`,
        program,
        athletes,
        presetAthleteId: null,
        formErrors: errors,
        formData: req.body,
      }),
    );
  }
  await programRepo.update(program.id, data);
  const kind =
    data.status === 'active' && program.status !== 'active'
      ? 'activated'
      : data.status === 'archived' && program.status !== 'archived'
        ? 'archived'
        : 'updated';
  const mail = await notifyProgramChange(program.id, kind);
  const metaChanged =
    data.weeks !== program.weeks || data.sessionsPerWeek !== program.sessions_per_week;
  req.flash(
    'success',
    [
      mail.sent ? 'Programme mis à jour. Le sportif a été informé par e-mail.' : 'Programme mis à jour.',
      metaChanged
        ? ' Durée / séances/semaine enregistrées sans régénérer les séances existantes (édite-les sur la fiche programme).'
        : '',
    ].join(''),
  );
  return res.redirect(`/admin/programs/${program.id}`);
});

export const setStatus = asyncHandler(async (req, res) => {
  const allowed = ['draft', 'active', 'archived'];
  const status = clean(req.body.status);
  if (!allowed.includes(status)) throw new HttpError(422, 'Statut invalide.');
  await programRepo.setStatus(req.params.id, status);
  const kind = status === 'active' ? 'activated' : status === 'archived' ? 'archived' : 'updated';
  const mail = await notifyProgramChange(req.params.id, kind);
  req.flash(
    'success',
    mail.sent
      ? 'Statut du programme mis à jour. Le sportif a été informé par e-mail.'
      : 'Statut du programme mis à jour.',
  );
  return res.redirect(`/admin/programs/${req.params.id}`);
});

export const remove = asyncHandler(async (req, res) => {
  await programRepo.remove(req.params.id);
  req.flash('success', 'Programme supprimé.');
  return res.redirect('/admin/programs');
});
