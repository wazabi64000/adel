import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../config/env.js';

const PICKER_PATH = path.join(ROOT_DIR, 'data', 'exercises', 'picker-index.json');
const CATALOG_PATH = path.join(ROOT_DIR, 'data', 'exercises', 'catalog.json');
const TAXONOMY_PATH = path.join(ROOT_DIR, 'data', 'exercises', 'taxonomy.json');

/** Focus FR coach → bodyParts ExerciseDB. */
export const FOCUS_TO_BODY_PARTS = {
  Pectoraux: ['chest'],
  Dos: ['back'],
  Épaules: ['shoulders'],
  Bras: ['upper arms', 'lower arms'],
  Jambes: ['upper legs', 'lower legs'],
  Fessiers: ['upper legs'],
  Abdominaux: ['waist'],
  'Haut du corps': ['chest', 'back', 'shoulders', 'upper arms', 'neck'],
  'Bas du corps': ['upper legs', 'lower legs'],
  Autre: [],
  'Tout le corps': [],
};

/** ExerciseDB equipment → familles (multi-label possible). */
const EQUIP_TO_FAMILIES = {
  'smith machine': ['machines'],
  'leverage machine': ['machines'],
  'stepmill machine': ['machines', 'conditioning'],
  'elliptical machine': ['machines', 'conditioning'],
  'stationary bike': ['machines', 'conditioning'],
  'sled machine': ['machines', 'conditioning'],
  'upper body ergometer': ['machines', 'conditioning'],
  'ski ergometer': ['machines', 'conditioning'],
  cable: ['cables'],
  dumbbell: ['free-weights'],
  barbell: ['free-weights', 'compound'],
  'olympic barbell': ['free-weights', 'compound'],
  kettlebell: ['free-weights', 'functional'],
  hammer: ['free-weights'],
  tire: ['functional', 'conditioning'],
  weighted: ['free-weights'],
  'resistance band': ['bands'],
  bodyweight: ['bodyweight'],
  assisted: ['bodyweight', 'machines'],
  roller: ['mobility'],
  'bosu ball': ['functional', 'core'],
  'medicine ball': ['functional'],
  'ab wheel': ['core'],
  'trap bar': ['free-weights', 'compound'],
};

const BODY_TO_REGION = {
  chest: 'upper',
  back: 'upper',
  shoulders: 'upper',
  neck: 'upper',
  'upper arms': 'upper',
  'lower arms': 'upper',
  waist: 'core',
  'upper legs': 'lower',
  'lower legs': 'lower',
  cardio: 'full-body',
};

let pickerCache = null;
let taxonomyCache = null;

export function getTaxonomy() {
  if (taxonomyCache) return taxonomyCache;
  taxonomyCache = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  return taxonomyCache;
}

function deriveFamilies(entry) {
  const set = new Set();
  for (const eq of entry.equipments || []) {
    const key = String(eq).toLowerCase();
    for (const f of EQUIP_TO_FAMILIES[key] || []) set.add(f);
  }
  const parts = (entry.bodyParts || []).map((p) => String(p).toLowerCase());
  if (parts.includes('waist')) set.add('core');
  if (parts.includes('cardio')) set.add('conditioning');
  const name = String(entry.name || '').toLowerCase();
  if (/\bstretch|mobility|foam roll/.test(name)) {
    set.add(name.includes('stretch') ? 'stretch' : 'mobility');
  }
  if (!set.size) set.add('other');
  return [...set];
}

function deriveRegions(entry) {
  const set = new Set();
  for (const bp of entry.bodyParts || []) {
    const region = BODY_TO_REGION[String(bp).toLowerCase()];
    if (region) set.add(region);
  }
  if (!set.size) set.add('full-body');
  return [...set];
}

function enrich(entry) {
  return {
    ...entry,
    families: entry.families?.length ? entry.families : deriveFamilies(entry),
    regions: entry.regions?.length ? entry.regions : deriveRegions(entry),
  };
}

function buildPickerFromCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  return (catalog.entries || [])
    .filter((e) => e.media?.verified && e.sourceExerciseId)
    .map((e) =>
      enrich({
        id: e.id,
        sourceId: e.sourceExerciseId,
        name: e.name?.original || e.name?.fr || e.id,
        bodyParts: e.taxonomy?.bodyParts || e.muscles?.sourceLabels?.bodyParts || [],
        equipments: e.taxonomy?.equipments || e.equipment || [],
        gifUrl: `/media/exercises/${e.sourceExerciseId}.gif`,
      }),
    );
}

/** Index léger pour le sélecteur admin (mémoire). */
export function getPickerIndex() {
  if (pickerCache) return pickerCache;
  if (fs.existsSync(PICKER_PATH)) {
    pickerCache = JSON.parse(fs.readFileSync(PICKER_PATH, 'utf8')).map(enrich);
  } else {
    pickerCache = buildPickerFromCatalog();
  }
  return pickerCache;
}

export function invalidatePickerCache() {
  pickerCache = null;
  taxonomyCache = null;
}

/**
 * Recherche dans le catalogue.
 * @param {{ q?: string, bodyPart?: string, bodyParts?: string[], family?: string, region?: string, equipment?: string, limit?: number }} opts
 */
export function searchCatalog({
  q = '',
  bodyPart = '',
  bodyParts = [],
  family = '',
  region = '',
  equipment = '',
  limit = 80,
} = {}) {
  const query = String(q || '').trim().toLowerCase();
  const parts = [...bodyParts, ...(bodyPart ? [bodyPart] : [])]
    .map((p) => String(p).toLowerCase())
    .filter(Boolean);
  const fam = String(family || '').trim().toLowerCase();
  const reg = String(region || '').trim().toLowerCase();
  const equip = String(equipment || '').trim().toLowerCase();

  let rows = getPickerIndex();
  if (parts.length) {
    rows = rows.filter((e) =>
      (e.bodyParts || []).some((bp) => parts.includes(String(bp).toLowerCase())),
    );
  }
  if (fam) {
    rows = rows.filter((e) => (e.families || []).map(String).map((x) => x.toLowerCase()).includes(fam));
  }
  if (reg) {
    rows = rows.filter((e) => (e.regions || []).map(String).map((x) => x.toLowerCase()).includes(reg));
  }
  if (equip) {
    rows = rows.filter((e) =>
      (e.equipments || []).some((eq) => String(eq).toLowerCase().includes(equip)),
    );
  }
  if (query) {
    rows = rows.filter((e) => String(e.name).toLowerCase().includes(query));
  }
  return rows.slice(0, Math.min(200, Math.max(1, limit)));
}

export function findCatalogEntry(catalogId) {
  if (!catalogId) return null;
  const id = String(catalogId).trim();
  return getPickerIndex().find((e) => e.id === id || e.sourceId === id) || null;
}

/** Résout l'URL GIF publique depuis un id catalogue. */
export function resolveCatalogGif(catalogId) {
  const entry = findCatalogEntry(catalogId);
  if (!entry) return null;
  return {
    name: entry.name,
    imageUrl: entry.gifUrl,
    catalogId: entry.id,
    bodyParts: entry.bodyParts,
    equipments: entry.equipments,
    families: entry.families,
  };
}

export function bodyPartsForFocus(focus, sessionType) {
  const key = String(focus || '').trim();
  if (!key || key === 'Tout le corps') return [];
  // session_type full_body sans focus → pas de filtre ; avec une partie → on filtre toujours
  if (sessionType === 'full_body' && !key) return [];
  if (FOCUS_TO_BODY_PARTS[key]) return FOCUS_TO_BODY_PARTS[key];
  const hit = Object.entries(FOCUS_TO_BODY_PARTS).find(
    ([label]) => label.toLowerCase() === key.toLowerCase(),
  );
  return hit ? hit[1] : [];
}

export function listBodyParts() {
  const set = new Set();
  for (const e of getPickerIndex()) {
    for (const bp of e.bodyParts || []) set.add(bp);
  }
  return [...set].sort();
}

export function listFamilies() {
  return getTaxonomy().families || [];
}

export function listMuscleRegions() {
  return getTaxonomy().muscleRegions || [];
}

export function listSessionFocusOptions() {
  return getTaxonomy().sessionFocusOptions || [];
}
