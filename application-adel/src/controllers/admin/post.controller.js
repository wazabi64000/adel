import * as postRepo from '../../repositories/post.repo.js';
import { uploadImage } from '../../services/upload.service.js';
import { validatePost } from '../../validators/index.js';
import { asyncHandler, clean, paginate, HttpError } from '../../utils/http.js';

export const list = asyncHandler(async (req, res) => {
  const { page, perPage, offset, limit } = paginate(req.query, { perPage: 12 });
  const { rows, total } = await postRepo.list({ status: clean(req.query.status), limit, offset });
  return res.render('admin/posts/list', {
    title: 'Posts',
    posts: rows,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) || 1 },
    filters: { status: req.query.status ?? '' },
  });
});

export const newForm = asyncHandler(async (req, res) => {
  return res.render('admin/posts/form', {
    title: 'Nouveau post',
    post: null,
    formErrors: {},
    formData: {},
  });
});

export const create = asyncHandler(async (req, res) => {
  const { ok, errors, data } = validatePost(req.body);
  if (!ok) {
    return res.status(422).render('admin/posts/form', {
      title: 'Nouveau post',
      post: null,
      formErrors: errors,
      formData: req.body,
    });
  }
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'posts', originalName: req.file.originalname });
    data.imageUrl = url;
  }
  data.authorId = req.currentUser.id;
  data.publishedAt = data.status === 'published' ? new Date() : null;

  await postRepo.create(data);
  req.flash('success', 'Post créé.');
  return res.redirect('/admin/posts');
});

export const editForm = asyncHandler(async (req, res) => {
  const post = await postRepo.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Post introuvable.');
  return res.render('admin/posts/form', {
    title: 'Éditer un post',
    post,
    formErrors: {},
    formData: post,
  });
});

export const update = asyncHandler(async (req, res) => {
  const post = await postRepo.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Post introuvable.');

  const { ok, errors, data } = validatePost(req.body);
  if (!ok) {
    return res.status(422).render('admin/posts/form', {
      title: 'Éditer un post',
      post,
      formErrors: errors,
      formData: req.body,
    });
  }
  data.imageUrl = post.image_url;
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, { folder: 'posts', originalName: req.file.originalname });
    data.imageUrl = url;
  }
  data.publishedAt = data.status === 'published' ? post.published_at ?? new Date() : null;

  await postRepo.update(post.id, data);
  req.flash('success', 'Post mis à jour.');
  return res.redirect('/admin/posts');
});

export const remove = asyncHandler(async (req, res) => {
  await postRepo.remove(req.params.id);
  req.flash('success', 'Post supprimé.');
  return res.redirect('/admin/posts');
});
