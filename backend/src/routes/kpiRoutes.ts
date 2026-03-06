import express from 'express';
import { authenticate } from '../middlewares/auth';
import { getMatcherFunnelKpi } from '../controllers/studentController';

const router = express.Router();

router.get('/matcher-funnel', authenticate, getMatcherFunnelKpi);

export default router;
