import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary.js';
import config, { PUBLIC_DIR } from '../config/env.js';

/**
 * Téléverse un buffer image.
 * - Cloudinary si configuré (production).
 * - Sinon, repli local dans public/uploads (dev sans credentials).
 * @returns {Promise<{url: string, publicId: string|null, provider: 'cloudinary'|'local'}>}
 */
export async function uploadImage(buffer, { folder = 'misc', originalName = 'image' } = {}) {
  if (!buffer || !buffer.length) return null;

  if (isCloudinaryEnabled()) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `${config.cloudinary.folder}/${folder}`, resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id, provider: 'cloudinary' });
        },
      );
      stream.end(buffer);
    });
  }

  // Repli local (développement).
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const safe = `${crypto.randomUUID()}${ext}`;
  const dir = path.join(PUBLIC_DIR, 'uploads', folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safe), buffer);
  return { url: `/uploads/${folder}/${safe}`, publicId: null, provider: 'local' };
}

/** Supprime un asset Cloudinary si possible (ignore les URLs locales). */
export async function destroyImage(publicId) {
  if (!publicId || !isCloudinaryEnabled()) return false;
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch {
    return false;
  }
}
