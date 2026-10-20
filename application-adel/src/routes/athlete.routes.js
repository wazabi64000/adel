import { Router } from 'express';
import * as controller from '../controllers/athlete/portal.controller.js';
import * as photos from '../controllers/athlete/photos.controller.js';
import { requireAthlete } from '../middlewares/auth.js';
import { anyFiles } from '../middlewares/upload.js';

const router = Router();

router.use(requireAthlete);

router.get('/', controller.dashboard);
router.get('/stats', controller.stats);
router.get('/programme/:id', controller.program);
router.get('/programme/:id/jour/:dayId', controller.day);
router.post('/log', controller.recordLog);

/* ---------- Suivi photographique privé ---------- */
router.get('/photos', photos.list);
router.get('/photos/new', photos.newForm);
router.post('/photos', anyFiles(), photos.create);
router.get('/photos/:id', photos.show);
router.delete('/photos/:id', photos.remove);

/* Accès sécurisé à une image privée (vérifie la propriété + token crypto). */
router.get(
  '/photos/:sessionId/file/:viewKey',
  photos.serveFile,
);

/* Commentaires sur une séance (propriétaire uniquement). */
router.post(
  '/photos/:sessionId/comments',
  photos.addComment,
);
router.delete(
  '/photos/:sessionId/comments/:commentId',
  photos.deleteComment,
);

router.get('/photos/compare', photos.compareForm);
router.get('/photos/compare/result', photos.compareResult);

export default router;
