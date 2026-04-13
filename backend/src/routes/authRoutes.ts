import express from 'express';
import { login, register, getUsers, createInvite, registerByInvite, getMe } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.get('/me', authenticate, getMe);
router.post('/login', login);
router.post('/register', register);
router.post('/register-invite', registerByInvite);
router.get('/users', authenticate, getUsers);
router.post('/invite', authenticate, createInvite);

export default router;
