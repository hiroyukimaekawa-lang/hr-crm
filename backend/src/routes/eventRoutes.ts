import express from 'express';
import { getEvents, createEvent, getEventDetail, updateParticipantStatus, deleteEvent, updateEvent, getKgiProgress } from '../controllers/eventController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getEvents);
router.post('/', authenticate, createEvent);
router.get('/kgi-progress', authenticate, getKgiProgress);
router.get('/:id', authenticate, getEventDetail);
router.put('/:id', authenticate, updateEvent);
router.put('/:id/participants/:studentId', authenticate, updateParticipantStatus);
router.delete('/:id', authenticate, deleteEvent);

export default router;
