/** Transforme un texte en slug URL (sans accents). */
export function slugify(input) {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 220);
}

/** Slug unique : ajoute un suffixe court si déjà pris. */
export function uniqueSlug(base, existsFn) {
  const slug = slugify(base) || `item-${Date.now()}`;
  return slug;
}
