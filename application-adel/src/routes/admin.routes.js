import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.js';
import { adminBadges } from '../middlewares/badges.js';
import { single, anyFiles } from '../middlewares/upload.js';
import { csrfCheck } from '../middlewares/csrf.js';
import { apiLimiter } from '../middlewares/rateLimit.js';
import * as catalogApi from '../controllers/admin/catalog.controller.js';

import * as dashboard from '../controllers/admin/dashboard.controller.js';
import * as article from '../controllers/admin/article.controller.js';
import * as post from '../controllers/admin/post.controller.js';
import * as athlete from '../controllers/admin/athlete.controller.js';
import * as program from '../controllers/admin/program.controller.js';
import * as day from '../controllers/admin/day.controller.js';
import * as exercise from '../controllers/admin/exercise.controller.js';
import * as inbox from '../controllers/admin/inbox.controller.js';
import * as gallery from '../controllers/admin/gallery.controller.js';
import * as follow from '../controllers/admin/follow.controller.js';

const router = Router();

// Toute la zone admin exige le rôle administrateur.
router.use(requireAdmin);
router.use(adminBadges);

/* ------------------------------- Tableau de bord ------------------------------- */
router.get('/', dashboard.index);
router.get('/suivi/sessions/:id', follow.show);
router.post('/suivi/sessions/:id/comments', follow.addComment);
router.post('/suivi/sessions/:id/rapport', follow.saveReport);
router.post('/suivi/sessions/:id/rapport/valider', follow.validateReport);

/* ---------------------------------- Articles ---------------------------------- */
router.get('/articles', article.list);
router.get('/articles/new', article.newForm);
router.post('/articles', single('cover'), csrfCheck, article.create);
router.get('/articles/:id/edit', article.editForm);
router.put('/articles/:id', single('cover'), csrfCheck, article.update);
router.delete('/articles/:id', article.remove);

/* ------------------------------------ Posts ----------------------------------- */
router.get('/posts', post.list);
router.get('/posts/new', post.newForm);
router.post('/posts', single('image'), csrfCheck, post.create);
router.get('/posts/:id/edit', post.editForm);
router.put('/posts/:id', single('image'), csrfCheck, post.update);
router.delete('/posts/:id', post.remove);

/* ---------------------------------- Athlètes ---------------------------------- */
router.get('/athletes', athlete.list);
router.get('/athletes/new', athlete.newForm);
router.post('/athletes', single('photo'), csrfCheck, athlete.create);
router.get('/athletes/:id', athlete.show);
router.get('/athletes/:id/edit', athlete.editForm);
router.put('/athletes/:id', single('photo'), csrfCheck, athlete.update);
router.delete('/athletes/:id', athlete.remove);
router.post('/athletes/:id/account', athlete.account);
router.post('/athletes/:id/photos', single('photo'), csrfCheck, athlete.uploadPhoto);
router.delete('/athletes/:id/photos/:photoId', athlete.deletePhoto);

/* --------------------------------- Programmes --------------------------------- */
router.get('/api/exercise-catalog', apiLimiter, catalogApi.search);
router.get('/api/exercise-catalog/body-parts', apiLimiter, catalogApi.bodyParts);

router.get('/programs', program.list);
router.get('/programs/new', program.newForm);
router.post('/programs', csrfCheck, program.create);
router.get('/programs/:id', program.show);
router.get('/programs/:id/edit', program.editForm);
router.put('/programs/:id', program.update);
router.delete('/programs/:id', program.remove);
router.post('/programs/:id/status', program.setStatus);
router.post('/programs/:id/days', day.ensure);

/* ------------------------------ Jours & exercices ----------------------------- */
router.put('/days/:dayId', day.update);
router.delete('/days/:dayId', day.remove);
router.post('/days/:dayId/exercises', csrfCheck, exercise.create);
router.put('/exercises/:id', csrfCheck, exercise.update);
router.delete('/exercises/:id', exercise.remove);

/* ---------------------------------- Galerie ---------------------------------- */
router.get('/gallery', gallery.list);
router.get('/gallery/new', gallery.newForm);
router.post('/gallery', anyFiles(), csrfCheck, gallery.create);
router.delete('/gallery/:id', gallery.remove);

/* --------------------------- Messages & demandes ------------------------------ */
router.get('/messages', inbox.messages);
router.post('/messages/:id/read', inbox.markMessageRead);
router.delete('/messages/:id', inbox.deleteMessage);

router.get('/demandes', inbox.accessRequests);
router.post('/demandes/:id/status', inbox.setRequestStatus);
router.post('/demandes/:id/acces', inbox.createAccessFromRequest);
router.delete('/demandes/:id', inbox.deleteRequest);

export default router;
