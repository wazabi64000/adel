import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth, redirectIfAuthenticated } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimit.js';

const router = Router();

router.get('/login', redirectIfAuthenticated, controller.loginForm);
router.post('/login', authLimiter, controller.login);
router.post('/logout', controller.logout);

router.get('/forgot-password', redirectIfAuthenticated, controller.forgotForm);
router.post('/forgot-password', authLimiter, controller.forgot);
router.get('/reset-password', controller.resetForm);
router.post('/reset-password', authLimiter, controller.reset);

router.get('/compte', requireAuth, controller.account);
router.post('/compte/mot-de-passe', requireAuth, controller.updatePassword);

export default router;
