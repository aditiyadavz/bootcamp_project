// Deadline reminders. A scheduled GitHub Actions job calls this once a day with a secret key.
import crypto from 'node:crypto';
import { Router } from 'express';
import { REMINDER_DAYS } from '../config.js';
import { deadlineFor } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import Document, { DOCUMENT_TYPES } from '../models/Document.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = Router();

// Compares in constant time, so the secret cannot be guessed from response times.
function secretMatches(given) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/run', async (req, res) => {
  if (!secretMatches(req.get('authorization'))) return res.status(401).json({ message: 'Invalid reminder key.' });

  const now = Date.now();
  const students = await User.find({ role: 'student', active: true });
  let sent = 0;
  for (const student of students) {
    const deadline = await deadlineFor(student);
    if (!deadline) continue;
    const msLeft = deadline - now;
    if (msLeft < 0 || msLeft > REMINDER_DAYS * 86400000) continue;

    const documents = await Document.find({ user: student._id }).lean();
    const needed = Object.entries(DOCUMENT_TYPES)
      .filter(([type]) => !documents.some((document) => document.type === type && document.status !== 'Rejected'))
      .map(([, label]) => label);
    if (needed.length === 0) continue;

    // At most one reminder a day.
    const recent = await Notification.exists({ user: student._id, kind: 'reminder', createdAt: { $gt: new Date(now - 20 * 3600000) } });
    if (recent) continue;

    const days = Math.max(1, Math.ceil(msLeft / 86400000));
    await notify(student._id, `Reminder: ${days} day${days === 1 ? '' : 's'} left. Still needed: ${needed.join(', ')}.`, '/dashboard', 'reminder');
    sent += 1;
  }
  await audit(null, 'Sent deadline reminders', `${sent} student${sent === 1 ? '' : 's'}`);
  res.json({ sent });
});

export default router;
