import * as authService from '../services/auth.service.js';
import * as userRepo from '../repositories/user.repo.js';
import { validateLogin } from '../validators/index.js';
import { asyncHandler } from '../utils/http.js';

const safeNext = (value) => {
  if (typeof value !== 'string') return null;
  // Uniquement des chemins internes (pas d'open redirect).
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
};

export const loginForm = asyncHandler(async (req, res) => {
  return res.render('auth/login', {
    title: 'Connexion',
    layout: 'layouts/auth',
    next: safeNext(req.query.next) ?? '',
    formErrors: {},
    formData: {},
  });
});

export const login = asyncHandler(async (req, res, next) => {
  const { ok, errors } = validateLogin(req.body);
  if (!ok) {
    return res.status(422).render('auth/login', {
      title: 'Connexion',
      layout: 'layouts/auth',
      next: safeNext(req.body.next) ?? '',
      formErrors: errors,
      formData: { email: req.body.email },
    });
  }

  try {
    const user = await authService.authenticate(req.body.email, req.body.password);
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.role = user.role;
      // Première connexion avec mot de passe provisoire : changement obligatoire.
      if (user.must_change_password) {
        req.flash('info', 'Choisis ton mot de passe personnel pour activer ton accès.');
        return req.session.save(() => res.redirect('/compte'));
      }
      req.flash('success', `Bonjour ${user.name} !`);
      const target =
        safeNext(req.body.next) ?? (user.role === 'admin' ? '/admin' : '/mon-espace');
      return req.session.save(() => res.redirect(target));
    });
  } catch (err) {
    return res.status(err.status || 401).render('auth/login', {
      title: 'Connexion',
      layout: 'layouts/auth',
      next: safeNext(req.body.next) ?? '',
      formErrors: { global: err.message },
      formData: { email: req.body.email },
    });
  }
});

export const logout = asyncHandler(async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('adel.sid');
    res.redirect('/login');
  });
});

/* ------------------------------ Mot de passe ------------------------------ */

export const forgotForm = asyncHandler(async (req, res) => {
  return res.render('auth/forgot-password', {
    title: 'Mot de passe oublié',
    layout: 'layouts/auth',
    formErrors: {},
    formData: {},
  });
});

export const forgot = asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? '').trim();
  if (!email) {
    return res.status(422).render('auth/forgot-password', {
      title: 'Mot de passe oublié',
      layout: 'layouts/auth',
      formErrors: { email: 'Adresse e-mail obligatoire.' },
      formData: { email },
    });
  }
  await authService.requestPasswordReset(email);
  req.flash('success', 'Si un compte existe, un e-mail de réinitialisation vient d\'être envoyé.');
  return res.redirect('/login');
});

export const resetForm = asyncHandler(async (req, res) => {
  return res.render('auth/reset-password', {
    title: 'Nouveau mot de passe',
    layout: 'layouts/auth',
    token: req.query.token ?? '',
    formErrors: {},
  });
});

export const reset = asyncHandler(async (req, res) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    req.flash('success', 'Mot de passe mis à jour. Tu peux te connecter.');
    return res.redirect('/login');
  } catch (err) {
    return res.status(err.status || 422).render('auth/reset-password', {
      title: 'Nouveau mot de passe',
      layout: 'layouts/auth',
      token: req.body.token ?? '',
      formErrors: { global: err.message },
    });
  }
});

/* ------------------------------- Compte ---------------------------------- */

export const account = asyncHandler(async (req, res) => {
  const user = await userRepo.findById(req.currentUser.id);
  return res.render('auth/account', {
    title: 'Mon compte',
    user,
    formErrors: {},
  });
});

export const updatePassword = asyncHandler(async (req, res) => {
  try {
    await authService.changePassword(
      req.currentUser.id,
      req.body.current_password,
      req.body.new_password,
    );
    req.flash('success', 'Mot de passe modifié.');
  } catch (err) {
    req.flash('error', err.message);
  }
  return res.redirect('/compte');
});
