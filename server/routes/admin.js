// Mentor actions: see all students, and approve or reject a document.
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireLogin, requireRole } from '../middleware/auth.js';
import Document, { DOCUMENT_TYPES } from '../models/Document.js';
import User from '../models/User.js';

const router = Router();
router.use(requireLogin, requireRole('admin'));

router.get('/students', async (req, res) => {
  const students = await User.find({ role: 'student' }).select('systemId name').sort('systemId').lean();
  const documents = await Document.find().select('-fileId').lean();
  const result = students.map((student) => ({
    ...student,
    documents: documents.filter((document) => document.user.equals(student._id)),
  }));
  res.json({ students: result, types: DOCUMENT_TYPES, deadline: process.env.DEADLINE || '2026-11-10T23:59:59+05:30' });
});

router.patch('/documents/:id', async (req, res) => {
  const status = String(req.body.status ?? '');
  const comment = String(req.body.comment ?? '').trim();

  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Please choose approve or reject.' });
  if (status === 'Rejected' && !comment) return res.status(400).json({ message: 'Please write a comment explaining the rejection.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Document not found.' });

  const document = await Document.findByIdAndUpdate(req.params.id, {
    $set: { status, comment },
    $push: { history: { action: status, note: comment, at: new Date() } },
  });
  if (!document) return res.status(404).json({ message: 'Document not found.' });
  res.json({ message: `Document marked as ${status}.` });
});

export default router;
