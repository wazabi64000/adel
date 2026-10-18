import * as athleteRepo from '../repositories/athlete.repo.js';
import * as programRepo from '../repositories/program.repo.js';
import * as exerciseRepo from '../repositories/exercise.repo.js';
import * as articleRepo from '../repositories/article.repo.js';
import * as postRepo from '../repositories/post.repo.js';
import * as contactRepo from '../repositories/contact.repo.js';
import * as accessRepo from '../repositories/accessRequest.repo.js';
import * as logRepo from '../repositories/log.repo.js';
import { query } from '../config/database.js';

/** Synthèse affichée sur le tableau de bord administrateur. */
export async function adminDashboard() {
  const [
    athletes,
    programsActive,
    programsTotal,
    exercises,
    articlesPublished,
    postsPublished,
    logsTotal,
    logsWeek,
    unreadMessages,
    pendingRequests,
    recentActivity,
    topAthletes,
    byLocation,
  ] = await Promise.all([
    athleteRepo.count(),
    programRepo.count({ status: 'active' }),
    programRepo.count(),
    exerciseRepo.count(),
    articleRepo.count({ status: 'published' }),
    postRepo.count({ status: 'published' }),
    logRepo.count(),
    logRepo.countThisWeek(),
    contactRepo.countUnread(),
    accessRepo.countPending(),
    logRepo.recentActivity(30),
    logRepo.topAthletes(5),
    programRepo.countByLocation(),
  ]);

  return {
    cards: {
      athletes,
      programsActive,
      programsTotal,
      exercises,
      articlesPublished,
      postsPublished,
      logsTotal,
      logsWeek,
      unreadMessages,
      pendingRequests,
    },
    recentActivity,
    topAthletes,
    byLocation,
  };
}

/** Statistiques détaillées d'un athlète. */
export async function athleteStats(athleteId) {
  const [summary, weekly, completion] = await Promise.all([
    logRepo.athleteSummary(athleteId),
    logRepo.athleteWeekly(athleteId),
    logRepo.completionForAthlete(athleteId),
  ]);

  const planned = completion?.planned_exercises ?? 0;
  const done = completion?.done_exercises ?? 0;
  const completionRate = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;

  return {
    summary: {
      logsCount: Number(summary?.logs_count ?? 0),
      sessionsCount: Number(summary?.sessions_count ?? 0),
      totalMinutes: Number(summary?.total_minutes ?? 0),
      avgRpe: summary?.avg_rpe ? Number(Number(summary.avg_rpe).toFixed(1)) : 0,
      firstLog: summary?.first_log ?? null,
      lastLog: summary?.last_log ?? null,
    },
    weekly: weekly.map((w) => ({
      weekNumber: Number(w.week_number),
      logsCount: Number(w.logs_count),
      sessionsCount: Number(w.sessions_count),
      totalMinutes: Number(w.total_minutes),
      avgRpe: Number(Number(w.avg_rpe).toFixed(1)),
    })),
    completion: { planned, done, rate: completionRate },
  };
}

/**
 * Avancement d'un programme : nombre d'exercices planifiés par semaine
 * et nombre de réalisations enregistrées par l'athlète.
 */
export async function programStats(program) {
  const rows = await query(
    `SELECT d.week_number,
       COUNT(e.id) AS exercises_planned,
       SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS exercises_done
     FROM program_days d
     LEFT JOIN exercises e ON e.program_day_id = d.id
     LEFT JOIN exercise_logs l
       ON l.exercise_id = e.id AND l.athlete_id = ?
     WHERE d.program_id = ?
     GROUP BY d.week_number
     ORDER BY d.week_number ASC`,
    [program.athlete_id, program.id],
  );

  const weeks = rows.map((r) => {
    const planned = Number(r.exercises_planned);
    const done = Number(r.exercises_done);
    return {
      weekNumber: Number(r.week_number),
      planned,
      done,
      rate: planned > 0 ? Math.round((done / planned) * 100) : 0,
    };
  });

  const totalPlanned = weeks.reduce((a, w) => a + w.planned, 0);
  const totalDone = weeks.reduce((a, w) => a + w.done, 0);

  return {
    weeks,
    totalPlanned,
    totalDone,
    rate: totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0,
  };
}

export default { adminDashboard, athleteStats, programStats };
