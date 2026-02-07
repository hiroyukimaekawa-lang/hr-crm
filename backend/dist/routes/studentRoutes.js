"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const studentController_1 = require("../controllers/studentController");
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticate, studentController_1.getStudents);
router.post('/', auth_1.authenticate, studentController_1.createStudent);
router.get('/:id', auth_1.authenticate, studentController_1.getStudentDetail);
router.post('/:id/events', auth_1.authenticate, studentController_1.linkEvent);
router.post('/interview-logs', auth_1.authenticate, studentController_1.addInterviewLog); // Note: I'll stick to /api/students/interview-logs or similar if needed
exports.default = router;
