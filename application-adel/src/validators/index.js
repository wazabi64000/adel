import { clean, toInt, toFloat } from '../utils/http.js';

/** Accumule les erreurs de validation. */
function makeValidator() {
  const errors = {};
  return {
    errors,
    required(field, label, value) {
      if (value === null || value === undefined || String(value).trim() === '') {
        errors[field] = `${label} est obligatoire.`;
      }
      return this;
    },
    email(field, value, { required = false } = {}) {
      const v = clean(value);
      if (!v) {
        if (required) errors[field] = 'Adresse e-mail obligatoire.';
        return this;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[field] = 'Adresse e-mail invalide.';
      return this;
    },
    max(field, label, value, n) {
      if (value && String(value).length > n) errors[field] = `${label} ne doit pas dépasser ${n} caractères.`;
      return this;
    },
    in(field, label, value, allowed) {
      if (value != null && value !== '' && !allowed.includes(value)) {
        errors[field] = `${label} invalide.`;
      }
      return this;
    },
    ok() {
      return Object.keys(errors).length === 0;
    },
  };
}

export function validateLogin(body) {
  const v = makeValidator();
  v.required('email', "L'e-mail", body.email);
  v.required('password', 'Le mot de passe', body.password);
  return { ok: v.ok(), errors: v.errors };
}

export function validateArticle(body) {
  const v = makeValidator();
  v.required('title', 'Le titre', body.title).max('title', 'Le titre', body.title, 220);
  v.in('status', 'Le statut', clean(body.status) ?? 'draft', ['draft', 'published']);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      title: clean(body.title),
      excerpt: clean(body.excerpt),
      content: clean(body.content),
      category: clean(body.category),
      status: clean(body.status) ?? 'draft',
      readMinutes: toInt(body.read_minutes),
    },
  };
}

export function validatePost(body) {
  const v = makeValidator();
  v.required('content', 'Le contenu', body.content);
  v.in('status', 'Le statut', clean(body.status) ?? 'draft', ['draft', 'published']);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      title: clean(body.title),
      content: clean(body.content),
      status: clean(body.status) ?? 'draft',
    },
  };
}

export function validateAthlete(body) {
  const v = makeValidator();
  v.required('first_name', 'Le prénom', body.first_name).max('first_name', 'Le prénom', body.first_name, 100);
  v.required('last_name', 'Le nom', body.last_name).max('last_name', 'Le nom', body.last_name, 100);
  v.email('email', body.email);
  v.in('level', 'Le niveau', clean(body.level) ?? 'debutant', ['debutant', 'intermediaire', 'avance']);
  v.in('gender', 'Le genre', clean(body.gender), ['femme', 'homme', 'autre', null, '']);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      firstName: clean(body.first_name),
      lastName: clean(body.last_name),
      email: clean(body.email),
      phone: clean(body.phone),
      birthdate: clean(body.birthdate),
      gender: clean(body.gender),
      heightCm: toInt(body.height_cm),
      weightKg: toFloat(body.weight_kg),
      level: clean(body.level) ?? 'debutant',
      goal: clean(body.goal),
      notes: clean(body.notes),
      isActive: body.is_active === '1' || body.is_active === 'on' || body.is_active === true,
    },
  };
}

export function validateProgram(body) {
  const v = makeValidator();
  v.required('title', 'Le titre', body.title).max('title', 'Le titre', body.title, 190);
  v.required('athlete_id', "L'athlète", body.athlete_id);
  v.in('location', 'Le lieu', clean(body.location) ?? 'salle', ['salle', 'home']);
  v.in('level', 'Le niveau', clean(body.level) ?? 'debutant', ['debutant', 'intermediaire', 'avance']);
  v.in('status', 'Le statut', clean(body.status) ?? 'active', ['draft', 'active', 'archived']);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      athleteId: toInt(body.athlete_id),
      title: clean(body.title),
      description: clean(body.description),
      location: clean(body.location) ?? 'salle',
      goal: clean(body.goal),
      level: clean(body.level) ?? 'debutant',
      weeks: toInt(body.weeks) ?? 4,
      startDate: clean(body.start_date),
      endDate: clean(body.end_date),
      status: clean(body.status) ?? 'active',
    },
  };
}

export function validateExercise(body) {
  const v = makeValidator();
  v.required('name', "Le nom de l'exercice", body.name).max('name', 'Le nom', body.name, 190);
  v.in('type', 'Le type', clean(body.type) ?? 'force', [
    'force',
    'cardio',
    'mobilite',
    'gainage',
    'etirement',
    'autre',
  ]);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      name: clean(body.name),
      description: clean(body.description),
      muscleGroup: clean(body.muscle_group),
      equipment: clean(body.equipment),
      type: clean(body.type) ?? 'force',
      sets: toInt(body.sets),
      reps: clean(body.reps),
      restSeconds: toInt(body.rest_seconds),
      weight: clean(body.weight),
      videoUrl: clean(body.video_url),
    },
  };
}

export function validateLog(body) {
  const v = makeValidator();
  v.required('exercise_id', "L'exercice", body.exercise_id);
  v.required('log_date', 'La date', body.log_date);
  return {
    ok: v.ok(),
    errors: v.errors,
    data: {
      exerciseId: toInt(body.exercise_id),
      logDate: clean(body.log_date),
      weekNumber: toInt(body.week_number) ?? 1,
      setsDone: toInt(body.sets_done),
      repsDone: clean(body.reps_done),
      weightUsed: clean(body.weight_used),
      durationMin: toInt(body.duration_min),
      rpe: toInt(body.rpe),
      feeling: clean(body.feeling),
      notes: clean(body.notes),
    },
  };
}

export function validateContact(body) {
  const v = makeValidator();
  v.required('name', 'Le nom', body.name);
  v.required('email', "L'e-mail", body.email);
  v.email('email', body.email, { required: true });
  v.required('message', 'Le message', body.message);
  return { ok: v.ok(), errors: v.errors };
}
