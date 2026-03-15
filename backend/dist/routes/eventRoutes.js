"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const eventController_1 = require("../controllers/eventController");
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticate, eventController_1.getEvents);
router.post('/', auth_1.authenticate, eventController_1.createEvent);
router.get('/kgi-progress', auth_1.authenticate, eventController_1.getKgiProgress);
router.get('/:id', auth_1.authenticate, eventController_1.getEventDetail);
router.put('/:id', auth_1.authenticate, eventController_1.updateEvent);
router.put('/:id/participants/:studentId', auth_1.authenticate, eventController_1.updateParticipantStatus);
router.delete('/:id', auth_1.authenticate, eventController_1.deleteEvent);
exports.default = router;
