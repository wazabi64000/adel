import qs from 'qs';
import * as programDayRepo from '../repositories/programDay.repo.js';
import * as exerciseRepo from '../repositories/exercise.repo.js';
import { resolveCatalogGif } from './exerciseCatalog.service.js';
import { clean, toInt } from '../utils/http.js';

/** Multer laisse souvent sessions[0][title] à plat — on recompose l'arbre. */
function nestFormBody(body) {
  if (!body || typeof body !== 'object') return {};
  if (Array.isArray(body.sessions) || (body.sessions && typeof body.sessions === 'object')) {
    return body;
  }
  const hasBracket = Object.keys(body).some((k) => k.includes('['));
  if (!hasBracket) return body;
  return qs.parse(body, { allowDots: false, depth: 10, arrayLimit: 200 });
}

/** Jours de la semaine (1=lun … 7=dim) selon le nombre de séances/semaine. */
export const WEEKDAY_SLOTS = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

export const BODY_FOCUS_OPTIONS = [
  'Tout le corps',
  'Pectoraux',
  'Dos',
  'Épaules',
  'Bras',
  'Jambes',
  'Fessiers',
  'Abdominaux',
  'Haut du corps',
  'Bas du corps',
];

/** Partie du corps : uniquement les options listées (pas de saisie libre). */
export function normalizeSessionFocus(raw) {
  const value = clean(raw) || 'Tout le corps';
  const hit = BODY_FOCUS_OPTIONS.find((o) => o.toLowerCase() === value.toLowerCase());
  return hit || 'Tout le corps';
}

export function sessionTypeFromFocus(focus, fallbackType) {
  const normalized = normalizeSessionFocus(focus);
  if (normalized === 'Tout le corps') return 'full_body';
  if (clean(fallbackType) === 'full_body' && !focus) return 'full_body';
  return 'body_part';
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Parse les modèles de séance depuis le body du formulaire builder.
 * Chaque exercice référence le catalogue via `catalog_id` (GIF obligatoire).
 */
export function parseSessionTemplates(body) {
  const nested = nestFormBody(body);
  const rawSessions = asArray(nested.sessions);
  const templates = [];

  rawSessions.forEach((raw, sessionIndex) => {
    if (!raw || typeof raw !== 'object') return;
    const focus = normalizeSessionFocus(raw.focus);
    const sessionType = sessionTypeFromFocus(focus, raw.session_type);
    const title =
      clean(raw.title) ||
      (sessionType === 'full_body' ? `Séance full body ${sessionIndex + 1}` : `Séance ${focus}`);

    const exercises = [];
    asArray(raw.exercises).forEach((ex) => {
      if (!ex || typeof ex !== 'object') return;
      const catalogId = clean(ex.catalog_id);
      const fromCatalog = catalogId ? resolveCatalogGif(catalogId) : null;
      const name = clean(ex.name) || fromCatalog?.name;
      if (!name || !fromCatalog) return;
      exercises.push({
        name,
        sets: toInt(ex.sets),
        reps: clean(ex.reps),
        imageUrl: fromCatalog.imageUrl,
        catalogId: fromCatalog.catalogId,
        muscleGroup: (fromCatalog.bodyParts || [])[0] || null,
        equipment: (fromCatalog.equipments || [])[0] || null,
      });
    });

    templates.push({
      sessionType,
      focus,
      title,
      exercises,
    });
  });

  return templates;
}

/** Normalise les exercices (déjà résolus depuis le catalogue). */
export async function resolveExerciseImages(templates) {
  return templates.map((session) => ({
    ...session,
    exercises: session.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      imageUrl: ex.imageUrl,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
    })),
  }));
}

/**
 * Génère weeks × sessions jours + exercices à partir des modèles.
 * @returns {Promise<{days:number, exercises:number}>}
 */
export async function generateFromTemplates(programId, weeks, sessionsPerWeek, templates) {
  const slots = WEEKDAY_SLOTS[sessionsPerWeek] || WEEKDAY_SLOTS[3];
  const count = Math.min(sessionsPerWeek, slots.length, templates.length);
  let daysCreated = 0;
  let exercisesCreated = 0;

  for (let week = 1; week <= weeks; week += 1) {
    for (let i = 0; i < count; i += 1) {
      const template = templates[i];
      const dayOfWeek = slots[i];
      const day = await programDayRepo.createDay({
        programId,
        weekNumber: week,
        dayOfWeek,
        title: template.title,
        focus: template.focus,
        sessionType: template.sessionType,
        isRestDay: false,
      });
      daysCreated += 1;

      let order = 0;
      for (const ex of template.exercises) {
        await exerciseRepo.create({
          programDayId: day.id,
          name: ex.name,
          description: null,
          muscleGroup: ex.muscleGroup || (template.sessionType === 'body_part' ? template.focus : null),
          equipment: ex.equipment || null,
          type: 'force',
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: null,
          weight: null,
          imageUrl: ex.imageUrl,
          videoUrl: null,
          orderIndex: order,
        });
        order += 1;
        exercisesCreated += 1;
      }
    }
  }

  return { days: daysCreated, exercises: exercisesCreated };
}
