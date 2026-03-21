import express from 'express';
import pool from '../config/db';

import {
    getStudents,
    createStudent,
    getStudentDetail,
    linkEvent,
    addInterviewLog,
    updateInterviewLog,
    deleteInterviewLog,
    updateStudentBasic,
    updateStudentStatus,
    updateStudentStaff,
    updateStudentMeta,
    addStudentTask,
    completeStudentTask,
    deleteStudentTask,
    deleteStudent,
    createApplication,
    updateApplicationReservation,
    createInterviewRecord,
    createEventProposal,
    getStudentEventProposals,
    getFunnelKpi,
    getFunnelMasterData,
    getMatcherFunnelByStudent,
    registerMatcherApply,
    registerMatcherMessage,
    registerMatcherReservation,
    registerMatcherInterview,
    importStudents,
    createInterviewSchedule,
    updateInterviewSchedule,
    deleteInterviewSchedule,
    getInterviewMetrics,
    getSourceCategories,
    createSourceCategory,
    deleteSourceCategory,
    getGraduationYearCategories,
    createGraduationYearCategory,
    deleteGraduationYearCategory
} from '../controllers/studentController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getStudents);
router.get('/metrics/interviews', authenticate, getInterviewMetrics);
router.get('/metrics/funnel', authenticate, getFunnelKpi);
router.get('/metrics/funnel-sources', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT name FROM source_categories ORDER BY created_at ASC'
        );
        res.json(result.rows.map((r: any) => r.name));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/funnel/master', authenticate, getFunnelMasterData);
router.get('/source-categories', authenticate, getSourceCategories);
router.post('/source-categories', authenticate, createSourceCategory);
router.delete('/source-categories/:id', authenticate, deleteSourceCategory);
router.get('/graduation-year-categories', authenticate, getGraduationYearCategories);
router.post('/graduation-year-categories', authenticate, createGraduationYearCategory);
router.delete('/graduation-year-categories/:id', authenticate, deleteGraduationYearCategory);
router.post('/', authenticate, createStudent);
router.post('/import', authenticate, importStudents);
router.get('/:id/matcher-funnel', authenticate, getMatcherFunnelByStudent);
router.post('/:id/matcher-funnel/apply', authenticate, registerMatcherApply);
router.post('/:id/matcher-funnel/message', authenticate, registerMatcherMessage);
router.post('/:id/matcher-funnel/reservation', authenticate, registerMatcherReservation);
router.post('/:id/matcher-funnel/interview', authenticate, registerMatcherInterview);
router.post('/:id/funnel/application', authenticate, createApplication);
router.put('/:id/funnel/reservation', authenticate, updateApplicationReservation);
router.post('/:id/funnel/interview', authenticate, createInterviewRecord);
router.get('/:id/funnel/event-proposals', authenticate, getStudentEventProposals);
router.post('/:id/funnel/event-proposal', authenticate, createEventProposal);
router.get('/:id', authenticate, getStudentDetail);
router.post('/:id/interview-schedules', authenticate, createInterviewSchedule);
router.put('/interview-schedules/:scheduleId', authenticate, updateInterviewSchedule);
router.delete('/interview-schedules/:scheduleId', authenticate, deleteInterviewSchedule);
router.post('/:id/events', authenticate, linkEvent);
router.post('/interview-logs', authenticate, addInterviewLog);
router.put('/interview-logs/:id', authenticate, updateInterviewLog);
router.delete('/interview-logs/:id', authenticate, deleteInterviewLog);
router.put('/:id', authenticate, updateStudentBasic);
router.put('/:id/status', authenticate, updateStudentStatus);
router.put('/:id/staff', authenticate, updateStudentStaff);
router.put('/:id/meta', authenticate, updateStudentMeta);
router.post('/:id/tasks', authenticate, addStudentTask);
router.put('/tasks/:taskId/complete', authenticate, completeStudentTask);
router.delete('/tasks/:taskId', authenticate, deleteStudentTask);
router.delete('/:id', authenticate, deleteStudent);

export default router;
