"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
router.get('/me', auth_1.authenticate, authController_1.getMe);
router.post('/login', authController_1.login);
router.post('/register', authController_1.register);
router.post('/register-invite', authController_1.registerByInvite);
router.get('/users', auth_1.authenticate, authController_1.getUsers);
router.post('/invite', auth_1.authenticate, authController_1.createInvite);
exports.default = router;
