import * as articleRepo from '../repositories/article.repo.js';
import { robotsTxt, agentsXml, sitemapXml, securityTxt } from '../services/policy.service.js';
import { mentionsLegales, confidentialite, cookies } from '../content/legal.js';
import { asyncHandler } from '../utils/http.js';

function sendText(res, body, type) {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type(type);
  return res.send(body);
}

export const robots = (req, res) => sendText(res, robotsTxt(), 'text/plain; charset=utf-8');

export const agents = (req, res) => sendText(res, agentsXml(), 'application/xml; charset=utf-8');

export const security = (req, res) => sendText(res, securityTxt(), 'text/plain; charset=utf-8');

export const sitemap = asyncHandler(async (req, res) => {
  const { rows } = await articleRepo.list({ status: 'published', limit: 500, offset: 0 });
  return sendText(res, sitemapXml(rows), 'application/xml; charset=utf-8');
});

function legal(page) {
  return (req, res) => {
    res.locals.seo = {
      ...(res.locals.seo || {}),
      title: page.title,
      description: page.description,
      robots: 'index, follow',
    };
    return res.render('public/legal', {
      title: `${page.title} — Coach Adel`,
      pageTitle: page.title,
      blocks: page.blocks,
    });
  };
}

export const mentions = legal(mentionsLegales);
export const privacy = legal(confidentialite);
export const cookiePolicy = legal(cookies);
