import { Router } from 'express';
import mongoose from 'mongoose';
import { requireLogin } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = Router();
router.use(requireLogin);

router.get('/', async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ notifications, unread });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All notifications marked as read.' });
});

router.post('/:id/read', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
  // Only the owner's own notification can be changed.
  const result = await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  if (result.matchedCount === 0) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ message: 'Marked as read.' });
});

export default router;
