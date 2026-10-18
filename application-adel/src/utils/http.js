/** Erreur HTTP avec code de statut. */
export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Enrobe un handler async pour propager les erreurs au middleware central. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Nettoie une valeur de formulaire : trim + null si vide. */
export function clean(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v === '' ? null : v;
}

/** Convertit en entier ou null. */
export function toInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Convertit en nombre décimal ou null. */
export function toFloat(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/** Vrai si la valeur est un entier positif (>=0). */
export function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

/** Échappe le HTML (sécurité affichage brut éventuel). */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pagination : calcule limit/offset/page à partir de la query. */
export function paginate(query, { perPage = 20 } = {}) {
  const perPageSafe = Math.min(Math.max(Number(perPage) || 20, 1), 100);
  const page = Math.max(Number.parseInt(query?.page, 10) || 1, 1);
  return { page, perPage: perPageSafe, offset: (page - 1) * perPageSafe, limit: perPageSafe };
}
