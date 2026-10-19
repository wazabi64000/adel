import { z } from 'zod';
import { clean, toInt, toFloat } from '../utils/http.js';

/** Messages FR partagés. */
const msg = {
  required: 'Ce champ est obligatoire.',
  email: 'Adresse e-mail invalide.',
  max: (n) => `Maximum ${n} caractères.`,
  min: (n) => `Minimum ${n} caractères.`,
  int: 'Doit être un nombre entier.',
  range: (a, b) => `Doit être entre ${a} et ${b}.`,
  choice: 'Valeur non autorisée.',
  url: 'URL invalide (http:// ou https://).',
  date: 'Date invalide (AAAA-MM-JJ).',
  time: 'Heure invalide (HH:MM).',
};

const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const optionalString = (maxLen) =>
  z.preprocess(
    emptyToNull,
    z.union([z.null(), z.string().max(maxLen, { message: msg.max(maxLen) })]).optional(),
  );

const requiredString = (label, maxLen) =>
  z.preprocess(
    emptyToNull,
    z
      .string({ required_error: `${label} est obligatoire.`, invalid_type_error: `${label} est obligatoire.` })
      .min(1, { message: `${label} est obligatoire.` })
      .max(maxLen, { message: msg.max(maxLen) }),
  );

const emailField = ({ required = false } = {}) =>
  z.preprocess(emptyToNull, (required
    ? z.string({ required_error: 'Adresse e-mail obligatoire.' }).min(1, { message: 'Adresse e-mail obligatoire.' })
    : z.union([z.null(), z.string()]).optional()
  ).pipe(
    z.union([
      z.null(),
      z.undefined(),
      z.string().email({ message: msg.email }),
    ]),
  ));

const intField = (label, { min, max, required = false, fallback } = {}) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return required ? undefined : fallback ?? null;
      const n = Number.parseInt(String(v), 10);
      return Number.isNaN(n) ? v : n;
    },
    required
      ? z
          .number({ required_error: `${label} est obligatoire.`, invalid_type_error: msg.int })
          .int({ message: msg.int })
          .min(min ?? Number.MIN_SAFE_INTEGER, { message: msg.range(min, max) })
          .max(max ?? Number.MAX_SAFE_INTEGER, { message: msg.range(min, max) })
      : z
          .union([
            z.null(),
            z
              .number({ invalid_type_error: msg.int })
              .int({ message: msg.int })
              .min(min ?? Number.MIN_SAFE_INTEGER, { message: min != null ? msg.range(min, max) : msg.int })
              .max(max ?? Number.MAX_SAFE_INTEGER, { message: max != null ? msg.range(min, max) : msg.int }),
          ])
          .optional(),
  );

const dateField = optionalString(10).refine(
  (v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  { message: msg.date },
);

const timeField = z.preprocess(
  emptyToNull,
  z
    .union([
      z.null(),
      z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, { message: msg.time }),
    ])
    .optional(),
);

/**
 * Transforme une ZodError en { field: "message" } (1 message clair / champ).
 * @param {z.ZodError} error
 */
export function zodFieldErrors(error) {
  const flat = error.flatten();
  const errors = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors || {})) {
    if (messages?.length) errors[field] = messages[0];
  }
  if (flat.formErrors?.length) {
    errors.global = flat.formErrors[0];
  }
  // Chemins imbriqués sessions.0.focus → sessions
  for (const issue of error.issues || []) {
    if (!issue.path?.length) continue;
    const key = String(issue.path[0]);
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Valide un body avec un schéma Zod.
 * @returns {{ ok: true, data: T, errors: {} } | { ok: false, data: null, errors: Record<string,string> }}
 */
export function parseWithZod(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return { ok: true, data: result.data, errors: {} };
  return { ok: false, data: null, errors: zodFieldErrors(result.error) };
}

/* -------------------------------------------------------------------------- */
/*  Schémas                                                                   */
/* -------------------------------------------------------------------------- */

const asTrimmed = (v) => (v == null ? '' : String(v).trim());

export const loginSchema = z.object({
  email: z.preprocess(
    asTrimmed,
    z.string().min(1, { message: "L'e-mail est obligatoire." }),
  ),
  password: z.preprocess(
    asTrimmed,
    z.string().min(1, { message: 'Le mot de passe est obligatoire.' }),
  ),
});

export const contactSchema = z.object({
  name: requiredString('Le nom', 150),
  email: z.preprocess(
    emptyToNull,
    z
      .string({ required_error: "L'e-mail est obligatoire." })
      .min(1, { message: "L'e-mail est obligatoire." })
      .email({ message: msg.email }),
  ),
  phone: optionalString(40),
  message: requiredString('Le message', 5000),
});

export const articleSchema = z.object({
  title: requiredString('Le titre', 220),
  excerpt: optionalString(400),
  content: optionalString(200000),
  category: optionalString(80),
  status: z.preprocess(
    (v) => emptyToNull(v) ?? 'draft',
    z.enum(['draft', 'published'], { errorMap: () => ({ message: msg.choice }) }),
  ),
  read_minutes: intField('Le temps de lecture', { min: 1, max: 120 }),
});

export const postSchema = z.object({
  title: optionalString(220),
  content: requiredString('Le contenu', 20000),
  status: z.preprocess(
    (v) => emptyToNull(v) ?? 'draft',
    z.enum(['draft', 'published'], { errorMap: () => ({ message: msg.choice }) }),
  ),
});

export const athleteSchema = z.object({
  first_name: requiredString('Le prénom', 100),
  last_name: requiredString('Le nom', 100),
  email: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.string().email({ message: msg.email })]).optional(),
  ),
  phone: optionalString(40),
  birthdate: dateField,
  gender: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.enum(['femme', 'homme', 'autre'], { message: msg.choice })]).optional(),
  ),
  height_cm: intField('La taille', { min: 80, max: 250 }),
  weight_kg: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number.parseFloat(String(v).replace(',', '.'));
      return Number.isNaN(n) ? v : n;
    },
    z.union([z.null(), z.number().min(20).max(400)]).optional(),
  ),
  level: z.preprocess(
    (v) => emptyToNull(v) ?? 'debutant',
    z.enum(['debutant', 'intermediaire', 'avance'], { errorMap: () => ({ message: msg.choice }) }),
  ),
  goal: optionalString(255),
  notes: optionalString(10000),
  is_active: z.any().optional(),
});

export const programSchema = z
  .object({
    title: requiredString('Le titre', 190),
    athlete_id: intField("L'athlète", { min: 1, required: true }),
    description: optionalString(10000),
    location: z.preprocess(
      (v) => emptyToNull(v) ?? 'salle',
      z.enum(['salle', 'home'], { errorMap: () => ({ message: msg.choice }) }),
    ),
    goal: optionalString(255),
    level: z.preprocess(
      (v) => emptyToNull(v) ?? 'debutant',
      z.enum(['debutant', 'intermediaire', 'avance'], { errorMap: () => ({ message: msg.choice }) }),
    ),
    weeks: intField('La durée', { min: 1, max: 52, required: true, fallback: 4 }),
    sessions_per_week: intField('Les séances / semaine', { min: 1, max: 7, required: true, fallback: 3 }),
    start_date: dateField,
    end_date: dateField,
    status: z.preprocess(
      (v) => emptyToNull(v) ?? 'active',
      z.enum(['draft', 'active', 'archived'], { errorMap: () => ({ message: msg.choice }) }),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date de fin doit être après la date de début.',
        path: ['end_date'],
      });
    }
  });

export const exerciseSchema = z.object({
  name: requiredString("Le nom de l'exercice", 190),
  description: optionalString(10000),
  muscle_group: optionalString(100),
  equipment: optionalString(150),
  type: z.preprocess(
    (v) => emptyToNull(v) ?? 'force',
    z.enum(['force', 'cardio', 'mobilite', 'gainage', 'etirement', 'autre'], {
      errorMap: () => ({ message: msg.choice }),
    }),
  ),
  sets: intField('Les séries', { min: 0, max: 100 }),
  reps: optionalString(40),
  rest_seconds: intField('Le repos', { min: 0, max: 600 }),
  weight: optionalString(60),
  image_url: z.preprocess(
    emptyToNull,
    z
      .union([
        z.null(),
        z
          .string()
          .max(500, { message: msg.max(500) })
          .refine((u) => /^https?:\/\/.+/i.test(u), { message: msg.url }),
      ])
      .optional(),
  ),
  video_url: optionalString(500),
  catalog_id: optionalString(120),
});

export const logSchema = z.object({
  exercise_id: intField("L'exercice", { min: 1, required: true }),
  log_date: z.preprocess(
    emptyToNull,
    z
      .string({ required_error: 'La date est obligatoire.' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: msg.date }),
  ),
  week_number: intField('La semaine', { min: 1, max: 52, fallback: 1 }),
  sets_done: intField('Séries réalisées', { min: 0, max: 100 }),
  reps_done: optionalString(40),
  weight_used: optionalString(60),
  duration_min: intField('Durée', { min: 0, max: 600 }),
  rpe: intField('RPE', { min: 1, max: 10 }),
  feeling: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.enum(['facile', 'ok', 'difficile'], { message: msg.choice })]).optional(),
  ),
  notes: optionalString(5000),
});

export const programDaySchema = z.object({
  title: optionalString(150),
  focus: optionalString(150),
  session_type: z.preprocess(
    emptyToNull,
    z.enum(['full_body', 'body_part'], { message: msg.choice }).optional(),
  ),
  scheduled_time: timeField,
  notes: optionalString(5000),
  is_rest_day: z.any().optional(),
});

/* -------------------------------------------------------------------------- */
/*  API compatible (ok / errors / data)                                       */
/* -------------------------------------------------------------------------- */

export function validateLogin(body) {
  return parseWithZod(loginSchema, body);
}

export function validateContact(body) {
  const { ok, errors, data } = parseWithZod(contactSchema, body);
  return { ok, errors, data };
}

export function validateArticle(body) {
  const { ok, errors, data } = parseWithZod(articleSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      title: data.title,
      excerpt: data.excerpt ?? null,
      content: data.content ?? null,
      category: data.category ?? null,
      status: data.status ?? 'draft',
      readMinutes: data.read_minutes ?? null,
    },
  };
}

export function validatePost(body) {
  const { ok, errors, data } = parseWithZod(postSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      title: data.title ?? null,
      content: data.content,
      status: data.status ?? 'draft',
    },
  };
}

export function validateAthlete(body) {
  const { ok, errors, data } = parseWithZod(athleteSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      birthdate: data.birthdate ?? null,
      gender: data.gender ?? null,
      heightCm: data.height_cm ?? null,
      weightKg: data.weight_kg ?? null,
      level: data.level ?? 'debutant',
      goal: data.goal ?? null,
      notes: data.notes ?? null,
      isActive: body.is_active === '1' || body.is_active === 'on' || body.is_active === true,
    },
  };
}

export function validateProgram(body) {
  const { ok, errors, data } = parseWithZod(programSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      athleteId: data.athlete_id,
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? 'salle',
      goal: data.goal ?? null,
      level: data.level ?? 'debutant',
      weeks: data.weeks ?? 4,
      sessionsPerWeek: data.sessions_per_week ?? 3,
      startDate: data.start_date ?? null,
      endDate: data.end_date ?? null,
      status: data.status ?? 'active',
    },
  };
}

export function validateExercise(body) {
  const { ok, errors, data } = parseWithZod(exerciseSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      name: data.name,
      description: data.description ?? null,
      muscleGroup: data.muscle_group ?? null,
      equipment: data.equipment ?? null,
      type: data.type ?? 'force',
      sets: data.sets ?? null,
      reps: data.reps ?? null,
      restSeconds: data.rest_seconds ?? null,
      weight: data.weight ?? null,
      imageUrl: data.image_url ?? null,
      videoUrl: data.video_url ?? null,
      catalogId: data.catalog_id ?? null,
    },
  };
}

export function validateLog(body) {
  const { ok, errors, data } = parseWithZod(logSchema, body);
  if (!ok) return { ok, errors, data: null };
  return {
    ok: true,
    errors: {},
    data: {
      exerciseId: data.exercise_id,
      logDate: data.log_date,
      weekNumber: data.week_number ?? 1,
      setsDone: data.sets_done ?? null,
      repsDone: data.reps_done ?? null,
      weightUsed: data.weight_used ?? null,
      durationMin: data.duration_min ?? null,
      rpe: data.rpe ?? null,
      feeling: data.feeling ?? null,
      notes: data.notes ?? null,
    },
  };
}

export function validateProgramDay(body) {
  const { ok, errors, data } = parseWithZod(programDaySchema, body);
  if (!ok) return { ok, errors, data: null };
  let scheduledTime = data.scheduled_time ?? null;
  if (scheduledTime && scheduledTime.length === 5) scheduledTime = `${scheduledTime}:00`;
  return {
    ok: true,
    errors: {},
    data: {
      title: data.title ?? null,
      focus: data.focus ?? null,
      sessionType: data.session_type ?? null,
      scheduledTime,
      notes: data.notes ?? null,
      isRestDay: body.is_rest_day === '1' || body.is_rest_day === 'on' || body.is_rest_day === true,
    },
  };
}

// Réexport utilitaires legacy utilisés ailleurs
export { clean, toInt, toFloat };
