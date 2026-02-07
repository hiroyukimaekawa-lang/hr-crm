import express from 'express';
import { login, register, getUsers } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/users', authenticate, getUsers);

export default router;
