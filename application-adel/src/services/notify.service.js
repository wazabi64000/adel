import * as athleteRepo from '../repositories/athlete.repo.js';
import * as programRepo from '../repositories/program.repo.js';
import { sendProgramUpdate } from './mail.service.js';

/**
 * Envoie un e-mail au sportif lié à un programme (si e-mail disponible).
 * Ne bloque jamais le flux métier.
 */
export async function notifyProgramChange(programId, kind) {
  try {
    const program = await programRepo.findById(programId);
    if (!program) return { sent: false, skipped: true };

    const athlete = await athleteRepo.findById(program.athlete_id);
    if (!athlete) return { sent: false, skipped: true };

    const email = (athlete.email || athlete.login_email || '').trim();
    if (!email) return { sent: false, skipped: true, reason: 'no-email' };

    return sendProgramUpdate({
      name: athlete.first_name,
      email,
      programTitle: program.title,
      programId: program.id,
      kind,
    });
  } catch (err) {
    console.error('[notify] programme :', err.message);
    return { sent: false, error: err.message };
  }
}

/** Notifie seulement si le programme est actif (évite le spam en brouillon). */
export async function notifyActiveProgramContent(programId) {
  const program = await programRepo.findById(programId);
  if (!program || program.status !== 'active') return { sent: false, skipped: true };
  return notifyProgramChange(programId, 'content');
}
