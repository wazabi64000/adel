import Twig from 'twig';
import path from 'node:path';
import fs from 'node:fs';
import config, { VIEWS_DIR } from './env.js';

/* -------------------------------------------------------------------------- */
/*  Helpers exposés aux templates sous forme de fonctions Twig                */
/* -------------------------------------------------------------------------- */

/** Construit une URL absolue à partir de l'APP_URL. */
Twig.extendFunction('url', (p = '/') => {
  if (/^https?:\/\//.test(p)) return p;
  return `${config.appUrl.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`;
});

/** Chemin vers un asset public. */
Twig.extendFunction('asset', (p = '') => {
  const clean = String(p).replace(/^\/+/, '');
  return `/${clean}`;
});

/** Récupère une valeur d'un objet sans planter si absent. */
Twig.extendFunction('get', (obj, key, fallback = '') => {
  if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== undefined) {
    return obj[key];
  }
  return fallback;
});

/** Formate une date (Date | string | null) en "jj/mm/aaaa". */
Twig.extendFunction('date_fr', (value, withTime = false) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
});

/** Formate une date en ISO (aaaa-mm-jj) pour les champs `type=date`. */
Twig.extendFunction('date_iso', (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
});

/** Libellé court d'un jour de semaine (1 = lundi). */
const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
Twig.extendFunction('day_name', (n) => DAYS[Number(n)] || '');

/** Découpe un texte en paragraphes (pour l'affichage sécurisé, sans HTML brut). */
Twig.extendFunction('paragraphs', (text) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean),
);

/** Tronque un texte à n caractères. */
Twig.extendFilter('truncate', (value, length = 120) => {
  const str = String(value ?? '');
  return str.length > length ? `${str.slice(0, length - 1).trimEnd()}…` : str;
});

/** Rend un champ de formulaire pré-rempli (valeur précédente) ou vide. */
Twig.extendFunction('old', (form, key, fallback = '') => {
  if (form && form[key] !== undefined && form[key] !== null) return form[key];
  return fallback;
});

/** Convertit un statut technique en libellé lisible. */
const STATUS_LABELS = {
  draft: 'Brouillon',
  published: 'Publié',
  active: 'Actif',
  archived: 'Archivé',
  salle: 'Salle',
  home: 'À la maison (home)',
};
Twig.extendFunction('label', (value) => STATUS_LABELS[value] || value || '');

Twig.cache(false);

/* -------------------------------------------------------------------------- */
/*  Enregistrement du moteur de vues Express                                  */
/* -------------------------------------------------------------------------- */

/**
 * Moteur de vue Express basé sur Twig.
 * Permet `res.render('public/home', { ... })`.
 */
export function configureViews(app) {
  app.set('views', VIEWS_DIR);
  app.set('view engine', 'twig');

  app.engine('twig', (filePath, options, callback) => {
    try {
      const template = Twig.twig({
        path: filePath,
        base: VIEWS_DIR,
        async: false,
        allowInlineIncludes: true,
        cache: false,
        autoescape: true,
      });
      const html = template.render(options);
      // twig.js renvoie un objet String() : on le convertit en primitive
      // pour qu'Express l'envoie comme HTML et non comme JSON.
      callback(null, String(html));
    } catch (err) {
      callback(err);
    }
  });
}

/** Vérifie au démarrage que le dossier de vues existe. */
export function assertViewsPresent() {
  if (!fs.existsSync(VIEWS_DIR)) {
    throw new Error(`Dossier de vues introuvable : ${path.relative(process.cwd(), VIEWS_DIR)}`);
  }
}

export default Twig;
