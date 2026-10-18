import { Router } from 'express';
import publicRoutes from './public.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import athleteRoutes from './athlete.routes.js';

const router = Router();

// Pages publiques + auth
router.use('/', publicRoutes);
router.use('/', authRoutes);

// Espaces protégés
router.use('/admin', adminRoutes);
router.use('/mon-espace', athleteRoutes);

export default router;
