"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middlewares/auth");
const studentController_1 = require("../controllers/studentController");
const kpiController_1 = require("../controllers/kpiController");
const router = express_1.default.Router();
// Legacy route — kept for backward compatibility
router.get('/matcher-funnel', auth_1.authenticate, studentController_1.getMatcherFunnelKpi);
// New unified KPI endpoints
router.get('/overview', auth_1.authenticate, kpiController_1.kpiOverview);
router.get('/events', auth_1.authenticate, kpiController_1.kpiEvents);
router.get('/goals', auth_1.authenticate, kpiController_1.kpiGoals);
router.put('/goals/bulk', auth_1.authenticate, kpiController_1.kpiGoalsBulk);
router.get('/funnel', auth_1.authenticate, kpiController_1.kpiFunnel);
exports.default = router;
