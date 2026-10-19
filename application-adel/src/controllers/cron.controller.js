import { asyncHandler, HttpError } from '../utils/http.js';
import config from '../config/env.js';
import { processSessionReminders } from '../services/reminder.service.js';

function authorizeCron(req) {
  const secret = config.cron.secret;
  if (!secret) {
    // En prod sans secret : refuser. En dev : autoriser localhost.
    if (config.isProd) return false;
    return true;
  }
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = String(req.query.secret || '').trim();
  const headerSecret = String(req.get('x-cron-secret') || '').trim();
  return bearer === secret || querySecret === secret || headerSecret === secret;
}

/** GET/POST /internal/cron/session-reminders — rappel 1 h avant séance. */
export const sessionReminders = asyncHandler(async (req, res) => {
  if (!authorizeCron(req)) {
    throw new HttpError(401, 'Non autorisé.');
  }
  const stats = await processSessionReminders();
  console.info('[cron] session-reminders', JSON.stringify(stats));
  return res.json({ ok: true, ...stats });
});
