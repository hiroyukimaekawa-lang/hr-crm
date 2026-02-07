import express from 'express';
import {
    getStudents,
    createStudent,
    getStudentDetail,
    linkEvent,
    addInterviewLog,
    updateStudentStatus
} from '../controllers/studentController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getStudents);
router.post('/', authenticate, createStudent);
router.get('/:id', authenticate, getStudentDetail);
router.post('/:id/events', authenticate, linkEvent);
router.post('/interview-logs', authenticate, addInterviewLog); // Note: I'll stick to /api/students/interview-logs or similar if needed
router.put('/:id/status', authenticate, updateStudentStatus);

export default router;
