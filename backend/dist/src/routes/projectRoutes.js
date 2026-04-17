"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projectController_1 = require("../controllers/projectController");
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticate, projectController_1.getProjects);
router.post('/', auth_1.authenticate, projectController_1.createProject);
router.get('/kgi-progress', auth_1.authenticate, projectController_1.getKgiProgress);
router.get('/:id', auth_1.authenticate, projectController_1.getProjectDetail);
router.put('/:id', auth_1.authenticate, projectController_1.updateProject);
router.put('/:id/kpi', auth_1.authenticate, projectController_1.updateProjectKpi);
router.put('/:id/participants/:relationId', auth_1.authenticate, projectController_1.updateParticipantStatus);
router.delete('/:id', auth_1.authenticate, projectController_1.deleteProject);
exports.default = router;
