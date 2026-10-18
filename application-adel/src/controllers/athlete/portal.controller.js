import * as programRepo from '../../repositories/program.repo.js';
import * as programDayRepo from '../../repositories/programDay.repo.js';
import * as exerciseRepo from '../../repositories/exercise.repo.js';
import * as logRepo from '../../repositories/log.repo.js';
import { athleteStats, programStats } from '../../services/stats.service.js';
import { validateLog } from '../../validators/index.js';
import { asyncHandler, toInt, clean, HttpError } from '../../utils/http.js';

/** Vérifie que le programme appartient bien à l'athlète connecté (anti-IDOR). */
async function ownedProgramOrThrow(programId, athleteId) {
  const program = await programRepo.findById(programId);
  if (!program || program.athlete_id !== athleteId) {
    throw new HttpError(404, 'Programme introuvable.');
  }
  return program;
}

export const dashboard = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const [programs, stats, recentLogs] = await Promise.all([
    programRepo.findByAthlete(athlete.id, { status: 'active' }),
    athleteStats(athlete.id),
    logRepo.listByAthlete(athlete.id, { limit: 8, offset: 0 }),
  ]);
  return res.render('athlete/dashboard', {
    title: 'Mon espace',
    athlete,
    programs,
    stats,
    recentLogs,
  });
});

export const program = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const prog = await ownedProgramOrThrow(req.params.id, athlete.id);

  const view = ['jour', 'semaine', 'mois'].includes(req.query.view) ? req.query.view : 'semaine';
  const days = await programDayRepo.listByProgram(prog.id);
  const daysWithExercises = await Promise.all(
    days.map(async (day) => ({
      ...day,
      exercises: await exerciseRepo.listByDay(day.id),
    })),
  );
  const stats = await programStats(prog);

  const weeks = [...new Set(daysWithExercises.map((d) => d.week_number))].sort((a, b) => a - b);
  const currentWeek = toInt(req.query.week) ?? weeks[0] ?? 1;

  // Regroupement selon le mode d'affichage.
  let visibleDays = daysWithExercises;
  if (view === 'jour') {
    const day = toInt(req.query.day);
    visibleDays = daysWithExercises.filter((d) => (day ? d.id === day : true));
  } else if (view === 'semaine') {
    visibleDays = daysWithExercises.filter((d) => d.week_number === currentWeek);
  }

  // Historique des réalisations pour ce programme.
  const logs = await logRepo.listByAthlete(athlete.id, { limit: 200, offset: 0 });
  const programLogs = logs.filter((l) => l.program_id === prog.id);
  const doneByExercise = {};
  for (const l of programLogs) doneByExercise[l.exercise_id] = l;

  return res.render('athlete/program', {
    title: prog.title,
    athlete,
    program: prog,
    view,
    weeks,
    currentWeek,
    days: visibleDays,
    allDays: daysWithExercises,
    stats,
    doneByExercise,
  });
});

export const day = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const dayRow = await programDayRepo.findByIdWithProgram(req.params.dayId);
  if (!dayRow || dayRow.athlete_id !== athlete.id) {
    throw new HttpError(404, 'Journée introuvable.');
  }
  const exercises = await exerciseRepo.listByDay(dayRow.id);

  const logs = await logRepo.listByAthlete(athlete.id, { limit: 200, offset: 0 });
  const byExercise = {};
  for (const l of logs) byExercise[l.exercise_id] = l;

  return res.render('athlete/day', {
    title: `${dayRow.program_title} — Journée`,
    athlete,
    day: dayRow,
    exercises,
    doneByExercise: byExercise,
    formErrors: {},
    formData: {},
  });
});

/** Enregistre la réalisation d'un exercice. */
export const recordLog = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const { ok, errors, data } = validateLog(req.body);
  if (!ok) {
    req.flash('error', Object.values(errors)[0]);
    return res.redirect(req.get('referer') || '/mon-espace');
  }

  // Contrôle d'accès : l'exercice doit appartenir à un programme de l'athlète.
  const exercise = await exerciseRepo.findById(data.exerciseId);
  if (!exercise) throw new HttpError(404, 'Exercice introuvable.');
  const dayRow = await programDayRepo.findByIdWithProgram(exercise.program_day_id);
  if (!dayRow || dayRow.athlete_id !== athlete.id) {
    throw new HttpError(403, "Cet exercice n'appartient pas à tes programmes.");
  }

  data.athleteId = athlete.id;
  await logRepo.upsert(data);
  req.flash('success', 'Séance enregistrée. Bravo !');
  return res.redirect(req.get('referer') || '/mon-espace');
});

export const stats = asyncHandler(async (req, res) => {
  const athlete = req.currentAthlete;
  const [data, logs] = await Promise.all([
    athleteStats(athlete.id),
    logRepo.listByAthlete(athlete.id, { limit: 40, offset: 0 }),
  ]);
  return res.render('athlete/stats', {
    title: 'Mes statistiques',
    athlete,
    stats: data,
    logs,
  });
});
