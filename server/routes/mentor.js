// Mentor actions. A mentor sees only their own students; an admin sees everyone.
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { PLAGIARISM_LIMIT } from '../config.js';
import { canAccessStudent, deadlineFor } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { announceChange, notify } from '../lib/notify.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Comment from '../models/Comment.js';
import Document, { DOCUMENT_TYPES, toPublic } from '../models/Document.js';
import User from '../models/User.js';

const router = Router();
router.use(requireLogin, requireRole('mentor', 'admin'));

router.get('/students', async (req, res) => {
  const filter = { role: 'student' };
  if (req.user.role === 'mentor') filter.mentor = req.user._id;
  const students = await User.find(filter).populate('batch', 'name deadline').populate('mentor', 'name').sort('systemId');
  const documents = await Document.find({ user: { $in: students.map((student) => student._id) } });

  const result = await Promise.all(students.map(async (student) => ({
    _id: student._id,
    systemId: student.systemId,
    name: student.name,
    active: student.active,
    batch: student.batch,
    mentor: student.mentor,
    deadline: await deadlineFor(student),
    documents: documents.filter((document) => document.user.equals(student._id)).map(toPublic),
  })));
  res.json({ students: result, types: DOCUMENT_TYPES });
});

router.get('/students/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !(await canAccessStudent(req.user, req.params.id))) {
    return res.status(404).json({ message: 'Student not found.' });
  }
  const student = await User.findOne({ _id: req.params.id, role: 'student' })
    .populate('batch', 'name deadline').populate('mentor', 'name systemId');
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  const documents = await Document.find({ user: student._id });
  const comments = await Comment.find({ document: { $in: documents.map((document) => document._id) } }).sort('createdAt').lean();
  res.json({
    student: {
      _id: student._id, systemId: student.systemId, name: student.name, batch: student.batch,
      mentor: student.mentor, extendedDeadline: student.extendedDeadline, deadline: await deadlineFor(student),
    },
    documents: documents.map((document) => ({
      ...toPublic(document),
      comments: comments.filter((comment) => comment.document.equals(document._id)),
    })),
    types: DOCUMENT_TYPES,
  });
});

const reviewSchema = z.object({
  status: z.enum(['Approved', 'Rejected'], { error: 'Please choose approve or reject.' }),
  comment: z.string().trim().max(1000, 'Please keep the comment under 1000 characters.').default(''),
  similarity: z.coerce.number({ error: 'Similarity must be a number.' })
    .min(0, 'Similarity must be between 0 and 100.').max(100, 'Similarity must be between 0 and 100.')
    .nullable().optional(),
});

router.patch('/documents/:id', validate(reviewSchema), async (req, res) => {
  const { status, comment, similarity } = req.body;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Document not found.' });
  const document = await Document.findById(req.params.id);
  if (!document || !(await canAccessStudent(req.user, document.user))) return res.status(404).json({ message: 'Document not found.' });

  if (status === 'Rejected' && !comment) return res.status(400).json({ message: 'Please write a comment explaining the rejection.' });
  // University rule: a plagiarism report can only be approved below 10% similarity.
  if (document.type === 'plagiarism' && status === 'Approved') {
    if (similarity === null || similarity === undefined) return res.status(400).json({ message: 'Please enter the similarity percentage before approving.' });
    if (similarity >= PLAGIARISM_LIMIT) return res.status(400).json({ message: `Similarity must be below ${PLAGIARISM_LIMIT}% to approve.` });
  }

  document.status = status;
  if (similarity !== undefined) document.similarity = similarity;
  document.history.push({ action: status, note: comment, by: req.user.name });
  await document.save();

  if (comment) {
    await Comment.create({ document: document._id, author: req.user._id, authorName: req.user.name, authorRole: req.user.role, text: comment });
  }
  const label = DOCUMENT_TYPES[document.type];
  const student = await User.findById(document.user).select('name systemId mentor');
  await notify(student._id, `Your ${label} was ${status.toLowerCase()} by ${req.user.name}.`, `/documents/${document.type}`);
  await audit(req.user, `${status} document`, `${label} of ${student.name} (${student.systemId})`);
  announceChange([student.id, student.mentor]);
  res.json({ message: `Document marked as ${status}.` });
});

export default router;
