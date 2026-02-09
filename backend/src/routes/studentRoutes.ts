import express from 'express';
import {
    getStudents,
    createStudent,
    getStudentDetail,
    linkEvent,
    addInterviewLog,
    updateStudentStatus,
    updateStudentStaff,
    importStudents
} from '../controllers/studentController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getStudents);
router.post('/', authenticate, createStudent);
router.post('/import', authenticate, importStudents);
router.get('/:id', authenticate, getStudentDetail);
router.post('/:id/events', authenticate, linkEvent);
router.post('/interview-logs', authenticate, addInterviewLog);
router.put('/:id/status', authenticate, updateStudentStatus);
router.put('/:id/staff', authenticate, updateStudentStaff);

export default router;
