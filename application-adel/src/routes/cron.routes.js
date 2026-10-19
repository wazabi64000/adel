import { Router } from 'express';
import * as cronController from '../controllers/cron.controller.js';

const router = Router();

router.get('/session-reminders', cronController.sessionReminders);
router.post('/session-reminders', cronController.sessionReminders);

export default router;
