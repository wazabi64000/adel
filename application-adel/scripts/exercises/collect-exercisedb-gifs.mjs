#!/usr/bin/env node
/**
 * Collecte les GIF ExerciseDB (tier gratuit 180p) + catalogue indexé
 * par partie du corps, équipement et muscle cible.
 *
 * Licence free tier : NON COMMERCIAL + attribution AscendAPI.
 * Ne pas déployer en prod commerciale sans plan payant.
 *
 * Usage :
 *   node scripts/exercises/collect-exercisedb-gifs.mjs
 *   node scripts/exercises/collect-exercisedb-gifs.mjs --limit=50   # smoke test
 *   node scripts/exercises/collect-exercisedb-gifs.mjs --resume
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data', 'exercises');
const STORAGE = path.join(ROOT, 'storage', 'exercises');
const MEDIA_DIR = path.join(STORAGE, 'media');
const BY_BODY = path.join(STORAGE, 'by-body-part');
const BY_EQUIP = path.join(STORAGE, 'by-equipment');
const BY_MUSCLE = path.join(STORAGE, 'by-target-muscle');
const PROGRESS_FILE = path.join(STORAGE, 'download-progress.json');
const API = 'https://oss.exercisedb.dev/api/v1/exercises';
const ALLOWED_HOST = 'static.exercisedb.dev';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const LIMIT = args.limit ? Number(args.limit) : null;
const DELAY_MS = Number(args.delay || 450);
const PAGE_DELAY_MS = Number(args['page-delay'] || 1100);

const BODY_PART_MAP = {
  neck: 'shoulders',
  shoulders: 'shoulders',
  chest: 'pectorals',
  back: 'back',
  waist: 'abs',
  cardio: 'full-body',
  'upper arms': 'biceps',
  'lower arms': 'forearms',
  'upper legs': 'quads',
  'lower legs': 'calves',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slug(value) {
  return String(value || 'unknown')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

async function ensureDirs() {
  for (const d of [DATA_DIR, MEDIA_DIR, BY_BODY, BY_EQUIP, BY_MUSCLE, path.join(STORAGE, 'indexes')]) {
    await fs.mkdir(d, { recursive: true });
  }
}

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'adel-exercisedb-collector/1.0 (+https://adelcoaching.com)' },
  });
  if (res.status === 429) {
    const wait = Math.min(30000, 2000 * attempt);
    console.warn(`[rate-limit] 429 — pause ${wait}ms`);
    await sleep(wait);
    if (attempt < 8) return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function listAllExercises() {
  const all = [];
  let after = null;
  let page = 0;
  for (;;) {
    const url = after ? `${API}?after=${encodeURIComponent(after)}` : API;
    const payload = await fetchJson(url);
    const batch = payload.data || [];
    if (!batch.length) break;
    all.push(...batch);
    page += 1;
    after = batch[batch.length - 1].exerciseId;
    const hasNext = Boolean(payload.meta?.hasNextPage);
    console.log(`[list] page ${page} +${batch.length} → ${all.length} (hasNext=${hasNext})`);
    if (LIMIT && all.length >= LIMIT) {
      return all.slice(0, LIMIT);
    }
    if (!hasNext) break;
    await sleep(PAGE_DELAY_MS);
  }
  return all;
}

function isAllowedGifUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST && u.pathname.endsWith('.gif');
  } catch {
    return false;
  }
}

async function downloadGif(url, destPath) {
  if (!isAllowedGifUrl(url)) throw new Error(`URL non autorisée : ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'adel-exercisedb-collector/1.0 (+https://adelcoaching.com)' },
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`Redirection refusée (${res.status})`);
  }
  if (!res.ok) throw new Error(`GIF HTTP ${res.status}`);
  const ctype = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ctype && ctype !== 'image/gif') throw new Error(`MIME invalide : ${ctype}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 16 || buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) {
    throw new Error('Signature GIF invalide');
  }
  await fs.writeFile(destPath, buf);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return { bytes: buf.length, sha256, mime: 'image/gif' };
}

async function linkInto(dir, id, mediaRel) {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `${id}.gif`);
  const absMedia = path.join(MEDIA_DIR, `${id}.gif`);
  try {
    await fs.unlink(target);
  } catch {
    /* ignore */
  }
  try {
    await fs.link(absMedia, target);
  } catch {
    await fs.copyFile(absMedia, target);
  }
  return path.relative(ROOT, target).split(path.sep).join('/');
}

function toCatalogEntry(ex, mediaMeta, mediaPath) {
  const bodyParts = ex.bodyParts || [];
  const equipments = ex.equipments || [];
  const primaryMuscle = (ex.targetMuscles || [])[0] || 'unknown';
  const mappedPrimary = BODY_PART_MAP[bodyParts[0]] || 'unknown';
  return {
    id: `edb-${slug(ex.exerciseId)}`,
    sourceExerciseId: ex.exerciseId,
    name: {
      fr: ex.name,
      original: ex.name,
      aliases: [],
    },
    description: null,
    equipment: equipments.map(slug),
    muscles: {
      primary: [mappedPrimary === 'unknown' ? 'unknown' : mappedPrimary],
      secondary: (ex.secondaryMuscles || []).map(slug),
      verified: false,
      sourceLabels: {
        bodyParts,
        targetMuscles: ex.targetMuscles || [],
        secondaryMuscles: ex.secondaryMuscles || [],
      },
    },
    movement: ['other'],
    level: 'intermediaire',
    appType: bodyParts.includes('cardio') ? 'cardio' : 'force',
    instructions: ex.instructions || [],
    commonMistakes: [],
    precautions: [],
    variants: [],
    alternatives: [],
    uncertainties: [
      'Noms/muscles issus d’ExerciseDB (EN) — à revue FR.',
      'Tier gratuit : usage non commercial uniquement.',
    ],
    media: {
      path: mediaPath ? `/${mediaPath}` : null,
      format: 'gif',
      mime: mediaMeta?.mime || 'image/gif',
      width: null,
      height: null,
      durationMs: null,
      frameCount: null,
      bytes: mediaMeta?.bytes ?? null,
      sha256: mediaMeta?.sha256 ?? null,
      sourceUrl: ex.gifUrl || null,
      animated: true,
      verified: Boolean(mediaMeta?.sha256),
    },
    rights: {
      sourceId: 'exercisedb-free',
      author: 'AscendAPI / ExerciseDB',
      license: 'ExerciseDB free tier — non-commercial use only; attribution required',
      licenseUrl: 'https://oss.exercisedb.dev/docs',
      attribution: 'Exercise data and GIFs: AscendAPI / ExerciseDB (free tier)',
      redistributionAllowed: false,
      commercialAllowed: false,
      notes: 'Pour adelcoaching.com en usage commercial : passer au plan payant ExerciseDB / RapidAPI.',
    },
    status: {
      availability: mediaMeta ? 'available' : 'missing',
      validation: mediaMeta ? 'valid' : 'unchecked',
    },
    collectedAt: new Date().toISOString(),
    taxonomy: {
      bodyParts,
      equipments,
      targetMuscles: ex.targetMuscles || [],
    },
  };
}

async function loadProgress() {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf8'));
  } catch {
    return { done: {}, errors: [] };
  }
}

async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, `${JSON.stringify(progress, null, 2)}\n`);
}

async function main() {
  await ensureDirs();
  console.log('[collect] listage des exercices…');
  const exercises = await listAllExercises();
  console.log(`[collect] ${exercises.length} exercices à traiter`);

  const progress = await loadProgress();
  const entries = [];
  const byBody = {};
  const byEquip = {};
  const byMuscle = {};
  const report = {
    startedAt: new Date().toISOString(),
    source: 'exercisedb-free',
    commercialAllowed: false,
    attribution: 'AscendAPI / ExerciseDB',
    requested: exercises.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i];
    const id = ex.exerciseId;
    const mediaFile = path.join(MEDIA_DIR, `${id}.gif`);
    const mediaRel = path.relative(ROOT, mediaFile).split(path.sep).join('/');
    process.stdout.write(`\r[gif] ${i + 1}/${exercises.length} ${id}          `);

    let meta = progress.done[id];
    try {
      if (!meta) {
        if (!ex.gifUrl) throw new Error('gifUrl manquant');
        meta = await downloadGif(ex.gifUrl, mediaFile);
        progress.done[id] = { ...meta, at: new Date().toISOString() };
        report.downloaded += 1;
        await saveProgress(progress);
        await sleep(DELAY_MS);
      } else {
        try {
          await fs.access(mediaFile);
          report.skipped += 1;
        } catch {
          meta = await downloadGif(ex.gifUrl, mediaFile);
          progress.done[id] = { ...meta, at: new Date().toISOString() };
          report.downloaded += 1;
          await saveProgress(progress);
          await sleep(DELAY_MS);
        }
      }

      for (const part of ex.bodyParts || ['unknown']) {
        await linkInto(path.join(BY_BODY, slug(part)), id, mediaRel);
        (byBody[part] ||= []).push(id);
      }
      for (const eq of ex.equipments || ['unknown']) {
        await linkInto(path.join(BY_EQUIP, slug(eq)), id, mediaRel);
        (byEquip[eq] ||= []).push(id);
      }
      for (const m of ex.targetMuscles || ['unknown']) {
        await linkInto(path.join(BY_MUSCLE, slug(m)), id, mediaRel);
        (byMuscle[m] ||= []).push(id);
      }

      entries.push(toCatalogEntry(ex, meta, mediaRel));
    } catch (err) {
      report.failed += 1;
      report.errors.push({ id, error: err.message });
      progress.errors.push({ id, error: err.message, at: new Date().toISOString() });
      await saveProgress(progress);
      entries.push(toCatalogEntry(ex, null, null));
      console.warn(`\n[fail] ${id}: ${err.message}`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\n[collect] écriture catalogue & index…');
  const catalog = {
    version: 2,
    schema: './schema.json',
    taxonomy: './taxonomy.json',
    sources: './sources.json',
    updatedAt: new Date().toISOString().slice(0, 10),
    status: 'partial_exercisedb_free',
    notes: [
      'Corpus ExerciseDB free tier (180p GIF).',
      'Usage NON COMMERCIAL — attribution AscendAPI obligatoire.',
      'Fichiers dans storage/exercises/ (hors Git).',
      'Index : by-body-part / by-equipment / by-target-muscle.',
    ],
    stats: {
      entries: entries.length,
      withVerifiedMedia: entries.filter((e) => e.media.verified).length,
      withGif: entries.filter((e) => e.media.format === 'gif' && e.media.verified).length,
      missingMedia: entries.filter((e) => !e.media.verified).length,
      licenseUncertain: 0,
      commercialAllowed: false,
    },
    entries,
  };

  await fs.writeFile(path.join(DATA_DIR, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);

  const picker = entries
    .filter((e) => e.media?.verified && e.sourceExerciseId)
    .map((e) => ({
      id: e.id,
      sourceId: e.sourceExerciseId,
      name: e.name?.original || e.name?.fr || e.id,
      bodyParts: e.taxonomy?.bodyParts || [],
      equipments: e.taxonomy?.equipments || e.equipment || [],
      gifUrl: `/media/exercises/${e.sourceExerciseId}.gif`,
    }));
  await fs.writeFile(path.join(DATA_DIR, 'picker-index.json'), `${JSON.stringify(picker)}\n`);
  console.log(`[collect] picker-index.json : ${picker.length} entrées`);
  await fs.writeFile(
    path.join(STORAGE, 'indexes', 'by-body-part.json'),
    `${JSON.stringify(byBody, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(STORAGE, 'indexes', 'by-equipment.json'),
    `${JSON.stringify(byEquip, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(STORAGE, 'indexes', 'by-target-muscle.json'),
    `${JSON.stringify(byMuscle, null, 2)}\n`,
  );

  report.finishedAt = new Date().toISOString();
  report.byBodyPartCounts = Object.fromEntries(
    Object.entries(byBody).map(([k, v]) => [k, v.length]),
  );
  report.byEquipmentCounts = Object.fromEntries(
    Object.entries(byEquip).map(([k, v]) => [k, v.length]),
  );
  await fs.writeFile(path.join(DATA_DIR, 'download-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const validation = {
    checkedAt: new Date().toISOString(),
    valid: entries.filter((e) => e.status.validation === 'valid').length,
    missing: entries.filter((e) => e.status.availability === 'missing').length,
    commercialAllowed: false,
    note: 'GIF décodés via signature MIME GIF87a/89a + hash SHA-256.',
  };
  await fs.writeFile(
    path.join(DATA_DIR, 'validation-report.json'),
    `${JSON.stringify(validation, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(STORAGE, 'NOTICE.txt'),
    `ExerciseDB free tier media
===========================
Source: https://oss.exercisedb.dev/docs
Attribution: AscendAPI / ExerciseDB
License: NON-COMMERCIAL use only (free tier). Attribution required.
Commercial / SaaS use requires a paid ExerciseDB / RapidAPI plan.
Collected: ${report.finishedAt}
`,
  );

  console.log('[collect] terminé', report);
}

main().catch((err) => {
  console.error('[collect] échec fatal', err);
  process.exit(1);
});
