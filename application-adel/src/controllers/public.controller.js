import * as articleRepo from '../repositories/article.repo.js';
import * as postRepo from '../repositories/post.repo.js';
import * as galleryRepo from '../repositories/gallery.repo.js';
import * as contactRepo from '../repositories/contact.repo.js';
import * as accessRepo from '../repositories/accessRequest.repo.js';
import { sendContactNotification, sendAccessRequestNotification } from '../services/mail.service.js';
import { validateContact } from '../validators/index.js';
import { clean, asyncHandler, HttpError } from '../utils/http.js';
import config from '../config/env.js';

/** Page d'accueil : reprend la landing + articles & posts publiés. */
export const home = asyncHandler(async (req, res) => {
  const [articles, posts] = await Promise.all([
    articleRepo.listPublished(6),
    postRepo.listPublished(6),
  ]);
  let galleryPhotos = [];
  try {
    galleryPhotos = await galleryRepo.listPublished();
  } catch {
    // Table pas encore créée (db:setup non réexécuté) : galerie vide en attendant.
    galleryPhotos = [];
  }
  res.locals.seo = {
    ...res.locals.seo,
    title: 'Coach Adel — coach sportif, nutrition et préparation mentale',
    description: 'Coach sportif : accompagnement physique, nutrition et préparation mentale. Programme personnalisé, coaching à distance et préinscription gratuite.',
  };
  return res.render('public/home', {
    title: 'Coach Adel — coach sportif, nutrition et préparation mentale',
    articles,
    posts,
    galleryPhotos,
  });
});

/** Liste complète des conseils (articles). */
export const articlesList = asyncHandler(async (req, res) => {
  const { rows } = await articleRepo.list({ status: 'published', limit: 60, offset: 0 });
  res.locals.seo = {
    ...res.locals.seo,
    title: 'Conseils sport, nutrition et mental — Coach Adel',
    description: 'Conseils pour bouger régulièrement, mieux manger et renforcer son équilibre mental, avec Coach Adel.',
  };
  return res.render('public/articles', { title: 'Conseils sport, nutrition et mental — Coach Adel', articles: rows });
});

/** Détail d'un article. */
export const articleDetail = asyncHandler(async (req, res) => {
  const article = await articleRepo.findBySlug(req.params.slug);
  if (!article || article.status !== 'published') throw new HttpError(404, 'Article introuvable.');
  const { rows: related } = await articleRepo.list({ status: 'published', limit: 3, offset: 0 });
  const image = article.cover_url
    ? (/^https?:\/\//i.test(article.cover_url)
      ? article.cover_url
      : `${config.appUrl.replace(/\/$/, '')}${article.cover_url.startsWith('/') ? '' : '/'}${article.cover_url}`)
    : '';
  res.locals.seo = {
    ...res.locals.seo,
    title: `${article.title} — Coach Adel`,
    description: article.excerpt || 'Conseil de Coach Adel : mouvement, nutrition et équilibre mental.',
    ogType: 'article',
    image,
  };
  return res.render('public/article', {
    title: `${article.title} — Coach Adel`,
    article,
    related: related.filter((a) => a.id !== article.id).slice(0, 3),
  });
});

/** Enregistre un message de contact + notifie le coach par e-mail. */
export const submitContact = asyncHandler(async (req, res) => {
  const { ok, errors } = validateContact(req.body);
  if (!ok) {
    req.flash('error', 'Merci de compléter correctement le formulaire.');
    return res.redirect('/#contact');
  }

  const payload = {
    name: clean(req.body.name),
    email: clean(req.body.email),
    phone: clean(req.body.phone),
    message: clean(req.body.message),
  };
  await contactRepo.create(payload);
  await sendContactNotification(payload);

  req.flash('success', 'Message bien reçu ! Coach Adel te répondra rapidement.');
  return res.redirect('/#contact');
});

/** Pré-inscription au programme : crée la demande + notifie le coach (lien de validation par UUID). */
export const submitAccessRequest = asyncHandler(async (req, res) => {
  const fullName = clean(req.body.full_name);
  const email = clean(req.body.email);
  if (req.body.consent !== '1') {
    req.flash('error', 'Le consentement au traitement de tes données est obligatoire.');
    return res.redirect('/#rejoindre');
  }
  if (!fullName || !email) {
    req.flash('error', 'Nom et e-mail obligatoires.');
    return res.redirect('/#rejoindre');
  }
  const payload = {
    fullName,
    email,
    phone: clean(req.body.phone),
    message: clean(req.body.message),
  };
  const { uuid } = await accessRepo.create(payload);
  const approveUrl = `${config.appUrl}/preinscription/valider/${uuid}`;
  await sendAccessRequestNotification({ ...payload, approveUrl, uuid });
  req.flash('success', 'Ta pré-inscription est envoyée. Le coach te valide rapidement.');
  return res.redirect('/#rejoindre');
});

/** Validation d'une pré-inscription par le coach, via le lien e-mail contenant l'UUID. */
export const validatePreRegistration = asyncHandler(async (req, res) => {
  const uuid = String(req.params.uuid || '').trim();
  const request = uuid ? await accessRepo.findByUuid(uuid) : null;

  if (!request) {
    return res.status(404).render('public/preinscription', {
      title: 'Lien de validation',
      status: 'invalid',
    });
  }

  if (request.status === 'approved') {
    return res.render('public/preinscription', {
      title: 'Pré-inscription déjà validée',
      status: 'already',
      request,
    });
  }

  const updated = await accessRepo.approveByUuid(uuid);
  return res.render('public/preinscription', {
    title: 'Pré-inscription validée',
    status: 'validated',
    request: updated,
  });
});

/** Health check applicatif (sans information sensible). */
export const health = asyncHandler(async (req, res) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});
