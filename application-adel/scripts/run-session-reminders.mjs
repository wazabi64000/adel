#!/usr/bin/env node
/**
 * Cron local / AlwaysData :
 *   */10 * * * * cd /path/application-adel && node scripts/run-session-reminders.mjs
 *
 * Ou via HTTP :
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://adelcoaching.com/internal/cron/session-reminders
 */
import { processSessionReminders } from '../src/services/reminder.service.js';

const stats = await processSessionReminders();
console.log('[reminders]', JSON.stringify(stats));
process.exit(stats.errors ? 1 : 0);
