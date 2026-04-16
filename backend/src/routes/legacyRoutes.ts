import express from 'express';
import { getLegacyEvents, migrateLegacyEvent, getLegacyEventParticipants } from '../controllers/legacyController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getLegacyEvents);
router.post('/:id/migrate', authenticate, migrateLegacyEvent);
router.get('/:id/participants', authenticate, getLegacyEventParticipants);


export default router;
