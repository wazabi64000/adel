import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/user.repo.js';
import * as resetRepo from '../repositories/passwordReset.repo.js';
import { sendPasswordReset } from './mail.service.js';
import config from '../config/env.js';
import { HttpError } from '../utils/http.js';

const ROUNDS = 12;

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Authentifie un utilisateur.
 * Message d'erreur uniforme pour éviter l'énumération de comptes.
 */
export async function authenticate(email, password) {
  const invalid = () => new HttpError(401, 'Identifiants incorrects.');

  if (!email || !password) throw invalid();

  const user = await userRepo.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    // Comparaison factice pour uniformiser le temps de réponse.
    await bcrypt.compare('x', '$2a$12$0000000000000000000000000000000000000000000000000000000');
    throw invalid();
  }
  if (!user.is_active) throw new HttpError(403, 'Ce compte est désactivé.');

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw invalid();

  await userRepo.touchLogin(user.id);
  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findByIdWithPassword(userId);
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) throw new HttpError(422, 'Mot de passe actuel incorrect.');
  if (!newPassword || newPassword.length < 8) {
    throw new HttpError(422, 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
  }
  await userRepo.updatePassword(userId, await hashPassword(newPassword));
}

/** Réinitialisation par l'administrateur (sans ancien mot de passe). */
export async function changePasswordByAdmin(userId, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new HttpError(422, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  // Mot de passe provisoire : l'utilisateur devra le changer à la 1re connexion.
  await userRepo.updatePassword(userId, await hashPassword(newPassword), { mustChangePassword: 1 });
}

/**
 * Démarre une réinitialisation de mot de passe.
 * Réponse toujours identique pour ne pas révéler l'existence d'un compte.
 */
export async function requestPasswordReset(email) {
  const user = await userRepo.findByEmail(String(email ?? '').trim().toLowerCase());
  if (!user || !user.is_active) return { ok: true };

  await resetRepo.invalidateForUser(user.id);
  const token = await resetRepo.create(user.id);
  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
  await sendPasswordReset({ email: user.email, resetUrl });
  return { ok: true };
}

/** Finalise la réinitialisation à partir du jeton. */
export async function resetPassword(token, newPassword) {
  if (!token) throw new HttpError(422, 'Jeton manquant.');
  if (!newPassword || newPassword.length < 8) {
    throw new HttpError(422, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  const record = await resetRepo.findValid(token);
  if (!record) throw new HttpError(422, 'Ce lien de réinitialisation est invalide ou expiré.');

  await userRepo.updatePassword(record.user_id, await hashPassword(newPassword));
  await resetRepo.markUsed(record.id);
  return { ok: true };
}
