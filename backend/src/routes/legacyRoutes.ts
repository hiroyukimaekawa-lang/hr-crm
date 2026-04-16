import express from 'express';
import { getLegacyEvents, migrateLegacyEvent } from '../controllers/legacyController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getLegacyEvents);
router.post('/:id/migrate', authenticate, migrateLegacyEvent);

export default router;
