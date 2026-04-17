"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const legacyController_1 = require("../controllers/legacyController");
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticate, legacyController_1.getLegacyEvents);
router.post('/:id/migrate', auth_1.authenticate, legacyController_1.migrateLegacyEvent);
router.get('/:id/participants', auth_1.authenticate, legacyController_1.getLegacyEventParticipants);
exports.default = router;
