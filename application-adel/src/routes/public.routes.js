import { Router } from 'express';
import * as controller from '../controllers/public.controller.js';
import * as policy from '../controllers/policy.controller.js';
import { formLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.get('/robots.txt', policy.robots);
router.get('/sitemap.xml', policy.sitemap);
router.get('/agents.xml', policy.agents);
router.get('/.well-known/security.txt', policy.security);
router.get('/mentions-legales', policy.mentions);
router.get('/confidentialite', policy.privacy);
router.get('/cookies', policy.cookiePolicy);

router.get('/', controller.home);
router.get('/health', controller.health);
router.get('/articles', controller.articlesList);
router.get('/articles/:slug', controller.articleDetail);
router.get('/preinscription/valider/:uuid', controller.validatePreRegistration);
router.post('/contact', formLimiter, controller.submitContact);
router.post('/acces-sportif', formLimiter, controller.submitAccessRequest);

export default router;
