import { adminDashboard } from '../../services/stats.service.js';
import * as logRepo from '../../repositories/log.repo.js';
import { asyncHandler, toInt } from '../../utils/http.js';

const VUES = ['seances', 'photos'];

function groupLogsByDay(logs) {
  const groups = [];
  for (const log of logs) {
    const d = log.log_date instanceof Date ? log.log_date : new Date(log.log_date);
    const key = Number.isNaN(d.getTime())
      ? String(log.log_date)
      : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, date: log.log_date, rows: [] };
      groups.push(group);
    }
    group.rows.push(log);
  }
  return groups;
}

export const index = asyncHandler(async (req, res) => {
  const data = await adminDashboard();
  const athleteId = toInt(req.query.athlete);
  const selectedAthlete = athleteId
    ? data.athleteFollowUp.find((athlete) => Number(athlete.id) === athleteId) || null
    : null;
  // Sans ?vue=, ouvrir directement le suivi photo s'il y en a — c'est là que les
  // athlètes envoient leurs images, et c'était souvent manqué derrière le résumé.
  let vue = VUES.includes(req.query.vue) ? req.query.vue : '';
  if (selectedAthlete && !vue && selectedAthlete.photoCount > 0) vue = 'photos';
  const athleteLogs = selectedAthlete && vue === 'seances'
    ? groupLogsByDay(await logRepo.listByAthlete(selectedAthlete.id, { limit: 80, offset: 0 }))
    : [];

  return res.render('admin/dashboard', {
    title: selectedAthlete
      ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
      : 'Tableau de bord',
    selectedAthlete,
    athleteVue: selectedAthlete ? vue : '',
    athleteLogs,
    ...data,
  });
});
