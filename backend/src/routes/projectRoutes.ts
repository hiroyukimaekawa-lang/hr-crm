import express from 'express';
import { getProjects, createProject, getProjectDetail, updateParticipantStatus, deleteProject, updateProject, getKgiProgress, updateProjectKpi } from '../controllers/projectController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/', authenticate, getProjects);
router.post('/', authenticate, createProject);
router.get('/kgi-progress', authenticate, getKgiProgress);
router.get('/:id', authenticate, getProjectDetail);
router.put('/:id', authenticate, updateProject);
router.put('/:id/kpi', authenticate, updateProjectKpi);
router.put('/:id/participants/:studentId', authenticate, updateParticipantStatus);
router.delete('/:id', authenticate, deleteProject);

export default router;
