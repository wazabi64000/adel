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

/** Wrapper qui convertit les erreurs multer en HttpError lisibles. */
export function single(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Image trop volumineuse (max ${Math.round(config.uploads.maxFileSize / 1024 / 1024)} Mo).`
            : `Erreur d'upload : ${err.message}`;
        return next(new HttpError(422, msg));
      }
      return next(err);
    });
  };
}
