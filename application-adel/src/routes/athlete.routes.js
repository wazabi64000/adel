import { Router } from 'express';
import * as controller from '../controllers/athlete/portal.controller.js';
import { requireAthlete } from '../middlewares/auth.js';

const router = Router();

router.use(requireAthlete);

router.get('/', controller.dashboard);
router.get('/stats', controller.stats);
router.get('/programme/:id', controller.program);
router.get('/programme/:id/jour/:dayId', controller.day);
router.post('/log', controller.recordLog);

export default router;
