/**
 * Initialise la base et insère un compte administrateur + données de démo.
 * Usage : npm run db:seed
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/env.js';
import { runSchema } from './setup.js';
import { pool } from '../config/database.js';

import * as userRepo from '../repositories/user.repo.js';
import * as athleteRepo from '../repositories/athlete.repo.js';
import * as programRepo from '../repositories/program.repo.js';
import * as programDayRepo from '../repositories/programDay.repo.js';
import * as exerciseRepo from '../repositories/exercise.repo.js';
import * as articleRepo from '../repositories/article.repo.js';
import * as postRepo from '../repositories/post.repo.js';
import * as contactRepo from '../repositories/contact.repo.js';
import { hashPassword } from '../services/auth.service.js';

async function seedAdmin() {
  const existing = await userRepo.findByEmail(config.seed.adminEmail.toLowerCase());
  if (existing) {
    console.log(`[seed] Admin déjà présent (${config.seed.adminEmail}).`);
    return existing.id;
  }
  const id = await userRepo.create({
    name: config.seed.adminName,
    email: config.seed.adminEmail.toLowerCase(),
    passwordHash: await hashPassword(config.seed.adminPassword),
    role: 'admin',
    isActive: 1,
  });
  console.log(`[seed] Admin créé : ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
  return id;
}

async function seedData(adminId) {
  const count = await athleteRepo.count();
  if (count > 0) {
    console.log('[seed] Données déjà présentes — étape démo ignorée.');
    return;
  }

  // --- Athlètes ---
  const athletes = [
    { firstName: 'Hami', lastName: 'B.', email: 'hami@example.com', level: 'intermediaire', goal: 'Reprendre une routine sportive', heightCm: 176, weightKg: 74.5 },
    { firstName: 'Snayh', lastName: 'K.', email: 'snayh@example.com', level: 'avance', goal: 'Gagner en force', heightCm: 182, weightKg: 81 },
    { firstName: 'Ahmed', lastName: 'R.', email: 'ahmed@example.com', level: 'debutant', goal: 'Se remettre au sport en douceur', heightCm: 170, weightKg: 88 },
  ];
  const createdAthletes = [];
  for (const a of athletes) {
    const id = await athleteRepo.create({ ...a, isActive: true, photoUrl: '/image/cardio-homme-course.jpg' });
    createdAthletes.push({ id, ...a });
  }

  // Compte d'accès pour le premier athlète.
  const tempPassword = 'athlete123';
  const userId = await userRepo.create({
    name: `${createdAthletes[0].firstName} ${createdAthletes[0].lastName}`,
    email: createdAthletes[0].email.toLowerCase(),
    passwordHash: await hashPassword(tempPassword),
    role: 'athlete',
    isActive: 1,
  });
  await athleteRepo.linkUser(createdAthletes[0].id, userId);
  console.log(`[seed] Compte sportif : ${createdAthletes[0].email} / ${tempPassword}`);

  // --- Programme (salle) ---
  const programId = await programRepo.create({
    athleteId: createdAthletes[0].id,
    title: 'Prise de masse — 4 semaines (salle)',
    description: 'Programme full-body sur 4 semaines, 3 séances par semaine.',
    location: 'salle',
    goal: 'Développer la force globale',
    level: 'intermediaire',
    weeks: 4,
    status: 'active',
    createdBy: adminId,
  });

  const plan = [
    { week: 1, day: 1, title: 'Haut du corps', focus: 'Pectoraux / Dos / Épaules', exercises: [
      { name: 'Développé couché', muscleGroup: 'Pectoraux', equipment: 'Barre', type: 'force', sets: 4, reps: '8-10', restSeconds: 90, imageUrl: '/image/9-16 at 13.52.41.jpeg' },
      { name: 'Tirage vertical', muscleGroup: 'Dos', equipment: 'Poulie', type: 'force', sets: 4, reps: '10-12', restSeconds: 75, imageUrl: '/image/cardio-homme-trail.jpg' },
      { name: 'Élévations latérales', muscleGroup: 'Épaules', equipment: 'Haltères', type: 'force', sets: 3, reps: '12-15', restSeconds: 60, imageUrl: '/image/cardio-homme-course.jpg' },
    ] },
    { week: 1, day: 3, title: 'Bas du corps', focus: 'Jambes / Fessiers', exercises: [
      { name: 'Squat', muscleGroup: 'Quadriceps', equipment: 'Barre', type: 'force', sets: 5, reps: '6-8', restSeconds: 120, imageUrl: '/image/9-16 at 13.52.41.jpeg' },
      { name: 'Fentes marchées', muscleGroup: 'Fessiers', equipment: 'Haltères', type: 'force', sets: 3, reps: '10 par jambe', restSeconds: 75, imageUrl: '/image/cardio-femme-course.jpg' },
      { name: 'Gainage planche', muscleGroup: 'Abdominaux', equipment: 'Poids du corps', type: 'gainage', sets: 3, reps: '45s', restSeconds: 45, imageUrl: '/image/cardio-homme-trail.jpg' },
    ] },
    { week: 1, day: 5, title: 'Cardio & mobilité', focus: 'Endurance / Récupération', exercises: [
      { name: 'Course fractionnée', muscleGroup: 'Cardio', equipment: 'Extérieur', type: 'cardio', sets: 6, reps: '1 min rapide / 1 min lent', restSeconds: 60, imageUrl: '/image/cardio-homme-trail.jpg' },
      { name: 'Étirements globaux', muscleGroup: 'Full body', equipment: 'Aucun', type: 'etirement', sets: 1, reps: '10 min', restSeconds: 0, imageUrl: '/image/cardio-femme-course.jpg' },
    ] },
  ];

  for (const d of plan) {
    const day = await programDayRepo.ensureDay(programId, d.week, d.day);
    await programDayRepo.update(day.id, { title: d.title, focus: d.focus, notes: null, isRestDay: false });
    for (const ex of d.exercises) {
      await exerciseRepo.create({ ...ex, programDayId: day.id });
    }
  }
  console.log(`[seed] Programme de démo créé (id ${programId}) avec ${plan.length} journées.`);

  // --- Articles ---
  await articleRepo.create({
    title: 'Bouger avec régularité : construire un rythme durable',
    slug: 'bouger-avec-regularite',
    excerpt: 'Le meilleur programme est celui qui respecte ton niveau, ta récupération et les activités que tu aimes.',
    content:
      "Commence par un rythme que tu peux réellement tenir et choisis des activités qui te font plaisir : marche, course, cardio ou musculation.\n\nObserve ton sommeil, ton énergie et tes douleurs. Une progression durable se construit en ajustant l'effort.",
    category: 'Physique',
    coverUrl: '/image/cardio-homme-trail.jpg',
    status: 'published',
    readMinutes: 5,
    publishedAt: new Date(),
    authorId: adminId,
  });
  await articleRepo.create({
    title: 'Renforcer son mental sans rechercher la perfection',
    slug: 'renforcer-son-mental',
    excerpt: "La constance naît d'objectifs réalistes et du droit de recommencer.",
    content:
      "Un écart n'efface pas tes efforts. Remplace la logique du « tout ou rien » par une question simple : quelle est la plus petite action utile que je peux faire aujourd'hui ?",
    category: 'Mental',
    coverUrl: '/image/WhatsApp Image 2026-09-16 at .52.42.jpeg',
    status: 'published',
    readMinutes: 4,
    publishedAt: new Date(),
    authorId: adminId,
  });

  // --- Posts ---
  await postRepo.create({
    title: 'Nouveau programme disponible',
    content: "Le programme « Prise de masse — 4 semaines » est en ligne dans l'espace sportif. Bon entraînement à tous !",
    imageUrl: '/image/cardio-homme-course.jpg',
    status: 'published',
    publishedAt: new Date(),
    authorId: adminId,
  });

  // --- Message de contact ---
  await contactRepo.create({
    name: 'Claire M.',
    email: 'claire@example.com',
    phone: '+33 6 00 00 00 00',
    message: "Bonjour, je souhaite un premier échange pour un accompagnement global.",
  });

  console.log('[seed] Données de démonstration insérées.');
}

async function main() {
  try {
    await runSchema();
    const adminId = await seedAdmin();
    await seedData(adminId);
    console.log('[seed] Terminé.');
  } catch (err) {
    console.error('[seed] Échec :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export { main };
