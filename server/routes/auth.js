// Register, log in, log out, "who am I?", and profile changes.
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { deadlineFor } from '../lib/access.js';
import { clearLoginCookie, requireLogin, setLoginCookie } from '../middleware/auth.js';
import { objectId, password, systemId, text, validate } from '../middleware/validate.js';
import Batch from '../models/Batch.js';
import User from '../models/User.js';

const router = Router();

// Slows down anyone trying to guess passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => Number(process.env.LOGIN_LIMIT || 20),
  message: { message: 'Too many attempts. Please try again later.' },
});

const registerSchema = z.object({
  systemId,
  name: text('your name', 80),
  password,
  batch: objectId.optional().or(z.literal('')),
});

const loginSchema = z.object({
  systemId: z.string({ error: 'Please enter your System ID.' }).trim().min(1, 'Please enter your System ID.'),
  password: z.string({ error: 'Please enter your password.' }).min(1, 'Please enter your password.'),
});

export async function profileOf(user) {
  await user.populate([{ path: 'batch', select: 'name deadline' }, { path: 'mentor', select: 'name systemId' }]);
  return {
    id: user.id,
    systemId: user.systemId,
    name: user.name,
    role: user.role,
    batch: user.batch,
    mentor: user.mentor,
    deadline: user.role === 'student' ? await deadlineFor(user) : null,
    extendedDeadline: user.extendedDeadline,
  };
}

router.post('/register', loginLimiter, validate(registerSchema), async (req, res) => {
  const { systemId: id, name, password: plain, batch } = req.body;
  if (await User.exists({ systemId: id })) return res.status(409).json({ message: 'This System ID is already registered.' });
  if (batch && !(await Batch.exists({ _id: batch }))) return res.status(400).json({ message: 'Please choose a valid batch.' });

  const user = await User.create({ systemId: id, name, passwordHash: await bcrypt.hash(plain, 10), batch: batch || null });
  await audit(user, 'Registered', 'Student account created');
  res.status(201).json({ message: 'Account created. Please log in.' });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ systemId: req.body.systemId });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Wrong System ID or password.' });
  }
  if (!user.active) return res.status(403).json({ message: 'This account has been deactivated. Please contact the coordinator.' });
  setLoginCookie(res, user);
  res.json(await profileOf(user));
});

router.post('/logout', (req, res) => {
  clearLoginCookie(res);
  res.json({ message: 'Logged out.' });
});

router.get('/me', requireLogin, async (req, res) => res.json(await profileOf(req.user)));

router.patch('/me', requireLogin, validate(z.object({ name: text('your name', 80) })), async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  res.json(await profileOf(req.user));
});

const passwordSchema = z.object({
  currentPassword: z.string({ error: 'Please enter your current password.' }).min(1, 'Please enter your current password.'),
  newPassword: password,
});

router.post('/password', requireLogin, validate(passwordSchema), async (req, res) => {
  if (!(await bcrypt.compare(req.body.currentPassword, req.user.passwordHash))) {
    return res.status(400).json({ message: 'Your current password is wrong.' });
  }
  req.user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await req.user.save();
  await audit(req.user, 'Changed password');
  res.json({ message: 'Password changed.' });
});

export default router;
