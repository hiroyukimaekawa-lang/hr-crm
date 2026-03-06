"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middlewares/auth");
const studentController_1 = require("../controllers/studentController");
const router = express_1.default.Router();
router.get('/matcher-funnel', auth_1.authenticate, studentController_1.getMatcherFunnelKpi);
exports.default = router;
