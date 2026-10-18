import * as userRepo from '../repositories/user.repo.js';
import * as athleteRepo from '../repositories/athlete.repo.js';

/** Charge l'utilisateur courant depuis la session et l'expose à la requête et aux vues. */
export async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentAthlete = null;
  if (!req.session?.userId) return next();

  try {
    const user = await userRepo.findById(req.session.userId);
    if (!user || !user.is_active) {
      req.session.userId = null;
      return next();
    }
    req.currentUser = user;
    res.locals.currentUser = user;

    if (user.role === 'athlete') {
      const athlete = await athleteRepo.findByUserId(user.id);
      req.currentAthlete = athlete;
      res.locals.currentAthlete = athlete;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Exige une session authentifiée. */
export function requireAuth(req, res, next) {
  if (req.currentUser) return next();
  const back = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${back}`);
}

/** Exige le rôle administrateur (coach). */
export function requireAdmin(req, res, next) {
  if (req.currentUser?.role === 'admin') {
    if (req.currentUser.must_change_password) return res.redirect('/compte');
    return next();
  }
  if (!req.currentUser) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/admin')}`);
  }
  return res.status(403).render('errors/403', { title: 'Accès refusé' });
}

/** Exige le rôle athlète avec un profil lié. */
export function requireAthlete(req, res, next) {
  if (req.currentUser?.role === 'athlete' && req.currentAthlete) {
    if (req.currentUser.must_change_password) return res.redirect('/compte');
    return next();
  }
  if (!req.currentUser) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/mon-espace')}`);
  }
  return res.status(403).render('errors/403', { title: 'Accès refusé' });
}

/** Interdit l'accès aux pages d'auth si déjà connecté. */
export function redirectIfAuthenticated(req, res, next) {
  if (!req.currentUser) return next();
  if (req.currentUser.role === 'admin') return res.redirect('/admin');
  return res.redirect('/mon-espace');
}
