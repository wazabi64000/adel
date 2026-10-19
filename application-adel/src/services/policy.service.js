import config from '../config/env.js';

const PRIVATE_PATHS = [
  '/admin',
  '/mon-espace',
  '/login',
  '/compte',
  '/forgot-password',
  '/reset-password',
  '/health',
  '/preinscription/valider',
];

/** Moteurs autorisés sur les pages publiques. */
const SEARCH_AGENTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Qwantify', 'Applebot', 'Slurp'];

/** Agents d'entraînement / scraping refusés (RGPD). */
const DENIED_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Bytespider',
  'Amazonbot',
  'FacebookBot',
  'meta-externalagent',
  'PerplexityBot',
  'cohere-ai',
  'Diffbot',
  'Omgilibot',
  'ImagesiftBot',
];

export function origin() {
  return String(config.appUrl || '').replace(/\/$/, '');
}

export function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function disallowLines() {
  return PRIVATE_PATHS.map((path) => `Disallow: ${path}`).join('\n');
}

/** robots.txt : indexation publique, espaces privés fermés, agents d'entraînement refusés. */
export function robotsTxt() {
  const base = origin();
  const search = SEARCH_AGENTS.map(
    (agent) => `User-agent: ${agent}\nAllow: /\n${disallowLines()}`,
  ).join('\n\n');
  const denied = DENIED_AGENTS.map((agent) => `User-agent: ${agent}\nDisallow: /`).join('\n\n');
  return [
    'User-agent: *',
    'Allow: /',
    disallowLines(),
    '',
    search,
    '',
    denied,
    '',
    `Sitemap: ${base}/sitemap.xml`,
    `# Agent policy: ${base}/agents.xml`,
    '',
  ].join('\n');
}

/** Politique lisible par les agents, en XML. */
export function agentsXml() {
  const base = origin();
  const allow = SEARCH_AGENTS.map(
    (name) => `    <agent name="${xmlEscape(name)}">
      <path>/</path>
      <path>/articles</path>
      <path>/mentions-legales</path>
      <path>/confidentialite</path>
      <path>/cookies</path>
    </agent>`,
  ).join('\n');
  const denyPrivate = `    <agent name="*">\n${PRIVATE_PATHS.map((path) => `      <path>${xmlEscape(path)}</path>`).join('\n')}\n    </agent>`;
  const denyAgents = DENIED_AGENTS.map(
    (name) => `    <agent name="${xmlEscape(name)}">\n      <path>/</path>\n    </agent>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<agent-policy xmlns="https://adelcoaching.com/ns/agent-policy" site="${xmlEscape(base)}">
  <allow>
${allow}
  </allow>
  <deny>
${denyPrivate}
${denyAgents}
  </deny>
</agent-policy>
`;
}

export function sitemapXml(articles) {
  const base = origin();
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = [
    { loc: `${base}/`, lastmod: today, priority: '1.0' },
    { loc: `${base}/articles`, lastmod: today, priority: '0.8' },
    { loc: `${base}/mentions-legales`, lastmod: today, priority: '0.3' },
    { loc: `${base}/confidentialite`, lastmod: today, priority: '0.3' },
    { loc: `${base}/cookies`, lastmod: today, priority: '0.3' },
  ];
  const articleUrls = articles.map((article) => {
    const raw = article.updated_at || article.published_at || article.created_at;
    const date = raw ? new Date(raw) : new Date();
    const lastmod = Number.isNaN(date.getTime()) ? today : date.toISOString().slice(0, 10);
    return {
      loc: `${base}/articles/${encodeURIComponent(article.slug)}`,
      lastmod,
      priority: '0.7',
    };
  });

  const body = [...staticUrls, ...articleUrls]
    .map(
      (url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function securityTxt() {
  const base = origin();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  return [
    'Contact: mailto:annabelle.adel300@gmail.com',
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: fr, en',
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/confidentialite`,
    '',
  ].join('\n');
}

export const PRIVATE_PREFIXES = PRIVATE_PATHS;
