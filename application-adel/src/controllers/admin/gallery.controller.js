import * as galleryRepo from '../../repositories/gallery.repo.js';
import { uploadImage, destroyImage } from '../../services/upload.service.js';
import { validateGallery } from '../../validators/index.js';
import { asyncHandler, HttpError } from '../../utils/http.js';

export const list = asyncHandler(async (req, res) => {
  const { rows, total } = await galleryRepo.list({ status: '', limit: 100, offset: 0 });
  return res.render('admin/gallery/list', {
    title: 'Galerie photo',
    photos: rows,
    total,
  });
});

export const newForm = asyncHandler(async (req, res) => {
  return res.render('admin/gallery/form', {
    title: 'Ajouter des photos à la galerie',
    photo: null,
    formErrors: {},
    formData: { status: 'published' },
  });
});

/** Ajoute une ou plusieurs photos à la galerie (upload multiple). */
export const create = asyncHandler(async (req, res) => {
  const { ok, errors, data } = validateGallery(req.body);
  if (!ok) {
    return res.status(422).render('admin/gallery/form', {
      title: 'Ajouter des photos à la galerie',
      photo: null,
      formErrors: errors,
      formData: req.body,
    });
  }

  const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
  if (!files.length) {
    return res.status(422).render('admin/gallery/form', {
      title: 'Ajouter des photos à la galerie',
      photo: null,
      formErrors: { image: 'Au moins une image est obligatoire.' },
      formData: req.body,
    });
  }

  const added = [];
  for (const file of files) {
    const { url, publicId } = await uploadImage(file.buffer, {
      folder: 'gallery',
      originalName: file.originalname,
    });
    await galleryRepo.create({
      title: data.title ?? null,
      imageUrl: url,
      imagePublicId: publicId,
      status: data.status,
      createdBy: req.currentUser.id,
    });
    added.push(url);
  }

  req.flash(
    'success',
    added.length === 1
      ? 'Photo ajoutée à la galerie.'
      : `${added.length} photos ajoutées à la galerie.`,
  );
  return res.redirect('/admin/gallery');
});

export const remove = asyncHandler(async (req, res) => {
  const photo = await galleryRepo.findById(req.params.id);
  if (!photo) throw new HttpError(404, 'Photo introuvable.');

  await destroyImage(photo.image_public_id);
  await galleryRepo.remove(req.params.id);

  req.flash('success', 'Photo supprimée de la galerie.');
  return res.redirect('/admin/gallery');
});
