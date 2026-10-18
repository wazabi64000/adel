import * as articleRepo from '../../repositories/article.repo.js';
import { uploadImage } from '../../services/upload.service.js';
import { validateArticle } from '../../validators/index.js';
import { slugify } from '../../utils/slugify.js';
import { asyncHandler, clean, paginate, HttpError } from '../../utils/http.js';

/** Génère un slug unique (ajoute -2, -3… si déjà pris). */
async function ensureUniqueSlug(title, exceptId = null) {
  const base = slugify(title) || `article-${Date.now()}`;
  let slug = base;
  let i = 2;
  while (await articleRepo.slugExists(slug, exceptId)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export const list = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 12 });
  const { rows, total } = await articleRepo.list({
    search: clean(req.query.q) ?? '',
    status: clean(req.query.status),
    limit,
    offset,
  });
  return res.render('admin/articles/list', {
    title: 'Articles',
    articles: rows,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
    filters: { q: req.query.q ?? '', status: req.query.status ?? '' },
  });
});

export const newForm = asyncHandler(async (req, res) => {
  return res.render('admin/articles/form', {
    title: 'Nouvel article',
    article: null,
    formErrors: {},
    formData: {},
  });
});

export const create = asyncHandler(async (req, res) => {
  const { ok, errors, data } = validateArticle(req.body);
  if (!ok) {
    return res.status(422).render('admin/articles/form', {
      title: 'Nouvel article',
      article: null,
      formErrors: errors,
      formData: req.body,
    });
  }

  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'articles', originalName: req.file.originalname });
    data.coverUrl = url;
  }
  data.slug = await ensureUniqueSlug(data.title);
  data.authorId = req.currentUser.id;
  data.publishedAt = data.status === 'published' ? new Date() : null;

  await articleRepo.create(data);
  req.flash('success', 'Article créé.');
  return res.redirect('/admin/articles');
});

export const editForm = asyncHandler(async (req, res) => {
  const article = await articleRepo.findById(req.params.id);
  if (!article) throw new HttpError(404, 'Article introuvable.');
  return res.render('admin/articles/form', {
    title: `Éditer — ${article.title}`,
    article,
    formErrors: {},
    formData: article,
  });
});

export const update = asyncHandler(async (req, res) => {
  const article = await articleRepo.findById(req.params.id);
  if (!article) throw new HttpError(404, 'Article introuvable.');

  const { ok, errors, data } = validateArticle(req.body);
  if (!ok) {
    return res.status(422).render('admin/articles/form', {
      title: `Éditer — ${article.title}`,
      article,
      formErrors: errors,
      formData: req.body,
    });
  }

  data.coverUrl = article.cover_url;
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'articles', originalName: req.file.originalname });
    data.coverUrl = url;
  }
  data.slug = await ensureUniqueSlug(data.title, article.id);
  data.publishedAt =
    data.status === 'published' ? article.published_at ?? new Date() : null;

  await articleRepo.update(article.id, data);
  req.flash('success', 'Article mis à jour.');
  return res.redirect('/admin/articles');
});

export const remove = asyncHandler(async (req, res) => {
  await articleRepo.remove(req.params.id);
  req.flash('success', 'Article supprimé.');
  return res.redirect('/admin/articles');
});
