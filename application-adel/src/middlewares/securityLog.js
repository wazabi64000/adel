/**
 * Journalisation sécurité au format Fail2Ban (lignes stables, 1 événement / ligne).
 *
 * Exemple de matching Fail2Ban :
 *   failregex = ^\s*\[adel-security\]\s+AUTH_FAIL\s+ip=<HOST>\b
 *               ^\s*\[adel-security\]\s+RATE_LIMIT\s+ip=<HOST>\b
 */

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '-';
}

/**
 * @param {string} event AUTH_FAIL | RATE_LIMIT | SLOW_DOWN | CSRF | FORBIDDEN
 * @param {import('express').Request} req
 * @param {Record<string, string|number|boolean|null|undefined>} [extra]
 */
export function securityLog(event, req, extra = {}) {
  const parts = [
    '[adel-security]',
    String(event).toUpperCase(),
    `ip=${clientIp(req)}`,
    `method=${req.method || '-'}`,
    `path=${(req.originalUrl || req.url || '-').split('?')[0]}`,
  ];
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null || v === '') continue;
    const safe = String(v).replace(/[\s=]+/g, '_').slice(0, 120);
    parts.push(`${k}=${safe}`);
  }
  console.warn(parts.join(' '));
}

/** Middleware : loggue les 401/403/429 après la réponse. */
export function securityResponseLogger(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode === 401) securityLog('AUTH_FAIL', req, { status: 401 });
    else if (res.statusCode === 403) securityLog('FORBIDDEN', req, { status: 403 });
    else if (res.statusCode === 429) securityLog('RATE_LIMIT', req, { status: 429 });
  });
  next();
}
