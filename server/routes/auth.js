// Register, log in, log out, and "who am I?".
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { clearLoginCookie, requireLogin, setLoginCookie } from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();
const publicUser = (user) => ({ systemId: user.systemId, name: user.name, role: user.role });

// Slows down anyone trying to guess passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => Number(process.env.LOGIN_LIMIT || 20),
  message: { message: 'Too many attempts. Please try again later.' },
});

router.post('/register', async (req, res) => {
  // String() stops someone sending a database query instead of plain text.
  const systemId = String(req.body.systemId ?? '').trim();
  const name = String(req.body.name ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!systemId || !name) return res.status(400).json({ message: 'Please enter your System ID and name.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must have at least 8 characters.' });
  if (await User.exists({ systemId })) return res.status(409).json({ message: 'This System ID is already registered.' });

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ systemId, name, passwordHash });
  res.status(201).json({ message: 'Account created. Please log in.' });
});

router.post('/login', loginLimiter, async (req, res) => {
  const systemId = String(req.body.systemId ?? '').trim();
  const password = String(req.body.password ?? '');

  const user = await User.findOne({ systemId });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Wrong System ID or password.' });
  }
  setLoginCookie(res, user);
  res.json(publicUser(user));
});

router.post('/logout', (req, res) => {
  clearLoginCookie(res);
  res.json({ message: 'Logged out.' });
});

router.get('/me', requireLogin, (req, res) => res.json(publicUser(req.user)));

export default router;
