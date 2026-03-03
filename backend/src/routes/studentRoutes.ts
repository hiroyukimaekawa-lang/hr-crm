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
    importStudents,
    createInterviewSchedule,
    updateInterviewSchedule,
    deleteInterviewSchedule,
    getInterviewMetrics,
    getSourceCategories,
    createSourceCategory,
    deleteSourceCategory
} from '../controllers/studentController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getStudents);
router.get('/metrics/interviews', authenticate, getInterviewMetrics);
router.get('/source-categories', authenticate, getSourceCategories);
router.post('/source-categories', authenticate, createSourceCategory);
router.delete('/source-categories/:id', authenticate, deleteSourceCategory);
router.post('/', authenticate, createStudent);
router.post('/import', authenticate, importStudents);
router.get('/:id', authenticate, getStudentDetail);
router.post('/:id/interview-schedules', authenticate, createInterviewSchedule);
router.put('/interview-schedules/:scheduleId', authenticate, updateInterviewSchedule);
router.delete('/interview-schedules/:scheduleId', authenticate, deleteInterviewSchedule);
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
