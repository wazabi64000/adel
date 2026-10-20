import multer from 'multer';
import config from '../config/env.js';
import { HttpError } from '../utils/http.js';

/**
 * Upload en mémoire : le buffer est ensuite envoyé à Cloudinary
 * (aucun fichier n'est écrit sur le disque du serveur).
 */
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!config.uploads.allowedMime.includes(file.mimetype)) {
    return cb(new HttpError(422, `Format d'image non autorisé : ${file.mimetype}`));
  }
  return cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxFileSize, files: 4 },
});

/** Upload multi-fichiers (builder programme : plusieurs GIF d'exercices). */
export const uploadMany = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxFileSize, files: 40 },
});

function handleMulterError(err, next) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Image trop volumineuse (max ${Math.round(config.uploads.maxFileSize / 1024 / 1024)} Mo).`
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Trop de fichiers envoyés d’un coup.'
          : `Erreur d'upload : ${err.message}`;
    return next(new HttpError(422, msg));
  }
  return next(err);
}

/** Wrapper qui convertit les erreurs multer en HttpError lisibles. */
export function single(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      return handleMulterError(err, next);
    });
  };
}

/** Accepte plusieurs fichiers (noms libres, ex. gif_0_1). */
export function anyFiles() {
  return (req, res, next) => {
    uploadMany.any()(req, res, (err) => {
      if (!err) return next();
      return handleMulterError(err, next);
    });
  };
}
