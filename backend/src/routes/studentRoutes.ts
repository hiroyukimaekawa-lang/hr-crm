import express from 'express';
import {
    getStudents,
    createStudent,
    getStudentDetail,
    linkEvent,
    addInterviewLog,
    deleteInterviewLog,
    updateStudentBasic,
    updateStudentStatus,
    updateStudentStaff,
    updateStudentMeta,
    addStudentTask,
    deleteStudentTask,
    deleteStudent,
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
router.delete('/interview-logs/:id', authenticate, deleteInterviewLog);
router.put('/:id', authenticate, updateStudentBasic);
router.put('/:id/status', authenticate, updateStudentStatus);
router.put('/:id/staff', authenticate, updateStudentStaff);
router.put('/:id/meta', authenticate, updateStudentMeta);
router.post('/:id/tasks', authenticate, addStudentTask);
router.delete('/tasks/:taskId', authenticate, deleteStudentTask);
router.delete('/:id', authenticate, deleteStudent);

export default router;
