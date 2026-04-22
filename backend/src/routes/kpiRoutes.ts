import express from 'express';
import { authenticate } from '../middlewares/auth';
import { getMatcherFunnelKpi } from '../controllers/studentController';
import {
    kpiOverview,
    kpiEvents,
    kpiGoals,
    kpiGoalsBulk,
    kpiFunnel,
    kpiDecompose,
    kpiAllocation,
} from '../controllers/kpiController';

const router = express.Router();

// Legacy route — kept for backward compatibility
router.get('/matcher-funnel', authenticate, getMatcherFunnelKpi);

// New unified KPI endpoints
router.get('/overview', authenticate, kpiOverview);
router.get('/events', authenticate, kpiEvents);
router.get('/goals', authenticate, kpiGoals);
router.put('/goals/bulk', authenticate, kpiGoalsBulk);
router.get('/funnel', authenticate, kpiFunnel);

// Revenue-driven KPI endpoints
router.post('/decompose', authenticate, kpiDecompose);
router.put('/allocation', authenticate, kpiAllocation);

export default router;
