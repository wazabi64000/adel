import * as athleteRepo from '../repositories/athlete.repo.js';
import * as programRepo from '../repositories/program.repo.js';
import * as exerciseRepo from '../repositories/exercise.repo.js';
import * as articleRepo from '../repositories/article.repo.js';
import * as postRepo from '../repositories/post.repo.js';
import * as contactRepo from '../repositories/contact.repo.js';
import * as accessRepo from '../repositories/accessRequest.repo.js';
import * as logRepo from '../repositories/log.repo.js';
import * as photoSessionRepo from '../repositories/photoSession.repo.js';
import { query } from '../config/database.js';
import config from '../config/env.js';

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
    sessionStats,
    sentPhotos,
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
    logRepo.sessionStatsByAthlete(),
    photoSessionRepo.listAllSent(),
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
    athleteFollowUp: buildAthleteFollowUp(sessionStats, sentPhotos),
  };
}

const VIEW_ORDER = ['devant', 'dos', 'profil_gauche', 'profil_droit', 'complementaire'];

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(value) {
  const d = asDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone || 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatDate(value) {
  const d = asDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: config.timezone || 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Regroupe séances, fréquence récente et photos envoyées, par sportif. */
function buildAthleteFollowUp(sessionStats, sentPhotos) {
  const photosByAthlete = new Map();
  for (const photo of sentPhotos) {
    const id = Number(photo.athlete_id);
    if (!photosByAthlete.has(id)) photosByAthlete.set(id, []);
    const dates = photosByAthlete.get(id);
    const key = dateKey(photo.session_date);
    let group = dates.find((entry) => entry.key === key);
    if (!group) {
      group = {
        key,
        date: photo.session_date,
        dateLabel: formatDate(photo.session_date),
        notes: photo.notes || '',
        photos: [],
      };
      dates.push(group);
    } else if (!group.notes && photo.notes) {
      group.notes = photo.notes;
    }
    group.photos.push({
      view: photo.view_key,
      // Proxy admin same-origin (évite les blocages CSP / hotlink sur Cloudinary).
      url: `/admin/suivi/sessions/${photo.session_id}/file/${photo.view_key}`,
      sessionId: photo.session_id,
      reportStatus: photo.report_status || '',
    });
  }
  for (const dates of photosByAthlete.values()) {
    for (const group of dates) {
      group.photos.sort((a, b) => VIEW_ORDER.indexOf(a.view) - VIEW_ORDER.indexOf(b.view));
    }
  }

  return sessionStats
    .map((row) => {
      const sessionsCount = Number(row.sessions_count) || 0;
      const sessionsLast28 = Number(row.sessions_28) || 0;
      const perWeek = Math.round((sessionsLast28 / 4) * 10) / 10;
      const photoDates = photosByAthlete.get(Number(row.id)) || [];
      const photoCount = photoDates.reduce((sum, group) => sum + group.photos.length, 0);
      const latestPhoto = photoDates[0]?.date ?? null;
      return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        isActive: Boolean(row.is_active),
        sessionsCount,
        sessionsLast28,
        frequencyPerWeek: perWeek.toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }),
        lastSession: row.last_log,
        lastSessionLabel: formatDate(row.last_log),
        photoCount,
        photoDates,
        latestPhoto,
      };
    })
    .sort((a, b) => {
      const aTime = Math.max(timeOf(a.lastSession), timeOf(a.latestPhoto));
      const bTime = Math.max(timeOf(b.lastSession), timeOf(b.latestPhoto));
      if (aTime !== bTime) return bTime - aTime;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
    });
}

function timeOf(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
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
