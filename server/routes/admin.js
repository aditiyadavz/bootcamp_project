// Coordinator (admin) actions: analytics, export, users, batches and the audit log.
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { deadlineFor } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { announceChange } from '../lib/notify.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import { dateValue, objectId, password, systemId, text, validate } from '../middleware/validate.js';
import AuditLog from '../models/AuditLog.js';
import Batch from '../models/Batch.js';
import Document, { DOCUMENT_TYPES } from '../models/Document.js';
import User from '../models/User.js';

const router = Router();
router.use(requireLogin, requireRole('admin'));

const STATUSES = ['Approved', 'Pending', 'Rejected', 'Missing'];
const dayKey = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // e.g. 2026-11-20

// ---------- Analytics ----------

router.get('/stats', async (req, res) => {
  const students = await User.find({ role: 'student', active: true }).lean();
  const mentors = await User.find({ role: 'mentor', active: true }).lean();
  const documents = await Document.find({ user: { $in: students.map((student) => student._id) } }).lean();
  const total = Object.keys(DOCUMENT_TYPES).length;

  const byType = Object.entries(DOCUMENT_TYPES).map(([type, label]) => {
    const ofType = documents.filter((document) => document.type === type);
    const row = { type, label, Missing: students.length - ofType.length };
    for (const status of ['Approved', 'Pending', 'Rejected']) row[status] = ofType.filter((document) => document.status === status).length;
    return row;
  });
  const statusTotals = Object.fromEntries(STATUSES.map((status) => [status, byType.reduce((sum, row) => sum + row[status], 0)]));

  // Uploads per day for the last 14 days.
  const days = Array.from({ length: 14 }, (_, index) => dayKey(Date.now() - (13 - index) * 86400000));
  const uploadsPerDay = days.map((day) => ({
    day,
    uploads: documents.reduce((sum, document) => sum + document.versions.filter((version) => dayKey(version.uploadedAt) === day).length, 0),
  }));

  const mentorLoad = mentors.map((mentor) => {
    const own = students.filter((student) => student.mentor?.equals(mentor._id));
    const ownDocuments = documents.filter((document) => own.some((student) => student._id.equals(document.user)));
    return {
      name: mentor.name,
      students: own.length,
      pending: ownDocuments.filter((document) => document.status === 'Pending').length,
      reviewed: ownDocuments.filter((document) => document.status !== 'Pending').length,
    };
  });

  const complete = students.filter((student) => documents.filter((document) => document.user.equals(student._id) && document.status === 'Approved').length === total).length;
  res.json({
    students: students.length,
    mentors: mentors.length,
    unassigned: students.filter((student) => !student.mentor).length,
    complete,
    statusTotals,
    byType,
    uploadsPerDay,
    mentorLoad,
  });
});

// Spreadsheet programs run cells that start with = + - or @ as formulas, so those are made safe.
function csvCell(value) {
  let cell = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

router.get('/export.csv', async (req, res) => {
  const students = await User.find({ role: 'student' }).populate('batch', 'name').populate('mentor', 'name').sort('systemId');
  const documents = await Document.find({ user: { $in: students.map((student) => student._id) } }).lean();
  const header = ['System ID', 'Name', 'Batch', 'Mentor', 'Deadline', ...Object.values(DOCUMENT_TYPES), 'Similarity %', 'Approved'];
  const rows = await Promise.all(students.map(async (student) => {
    const own = documents.filter((document) => document.user.equals(student._id));
    const statusOf = (type) => own.find((document) => document.type === type)?.status ?? 'Missing';
    const deadline = await deadlineFor(student);
    return [
      student.systemId, student.name, student.batch?.name, student.mentor?.name,
      deadline ? dayKey(deadline) : '',
      ...Object.keys(DOCUMENT_TYPES).map(statusOf),
      own.find((document) => document.type === 'plagiarism')?.similarity,
      `${own.filter((document) => document.status === 'Approved').length}/${Object.keys(DOCUMENT_TYPES).length}`,
    ];
  }));
  await audit(req.user, 'Exported CSV', `${students.length} students`);
  res.attachment(`submission-status-${dayKey(new Date())}.csv`);
  res.type('text/csv');
  res.send([header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
});

// ---------- Users ----------

router.get('/users', async (req, res) => {
  const users = await User.find().select('-passwordHash').populate('batch', 'name').populate('mentor', 'name').sort({ role: 1, systemId: 1 }).lean();
  res.json(users);
});

const createUserSchema = z.object({
  systemId,
  name: text('a name', 80),
  password,
  role: z.enum(['student', 'mentor', 'admin'], { error: 'Please choose a role.' }),
});

router.post('/users', validate(createUserSchema), async (req, res) => {
  const { systemId: id, name, password: plain, role } = req.body;
  if (await User.exists({ systemId: id })) return res.status(409).json({ message: 'This ID is already registered.' });
  const user = await User.create({ systemId: id, name, role, passwordHash: await bcrypt.hash(plain, 10) });
  await audit(req.user, 'Created user', `${name} (${id}) as ${role}`);
  res.status(201).json({ message: `${name} was added as ${role}.`, id: user.id });
});

const updateUserSchema = z.object({
  name: text('a name', 80).optional(),
  role: z.enum(['student', 'mentor', 'admin']).optional(),
  batch: objectId.nullable().optional(),
  mentor: objectId.nullable().optional(),
  extendedDeadline: dateValue.nullable().optional(),
  active: z.boolean().optional(),
});

router.patch('/users/:id', validate(updateUserSchema), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found.' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const changes = req.body;

  const isSelf = user._id.equals(req.user._id);
  if (isSelf && ((changes.role && changes.role !== 'admin') || changes.active === false)) {
    return res.status(400).json({ message: 'You cannot remove your own admin access.' });
  }
  if (changes.mentor && !(await User.exists({ _id: changes.mentor, role: 'mentor' }))) {
    return res.status(400).json({ message: 'Please choose a mentor.' });
  }
  if (changes.batch && !(await Batch.exists({ _id: changes.batch }))) {
    return res.status(400).json({ message: 'Please choose a valid batch.' });
  }

  Object.assign(user, changes);
  if (user.role !== 'student') Object.assign(user, { mentor: null, batch: null, extendedDeadline: null });
  await user.save();
  await audit(req.user, 'Updated user', `${user.name} (${user.systemId}): ${Object.keys(changes).join(', ')}`);
  announceChange([user.id]);
  res.json({ message: `${user.name} was updated.` });
});

// ---------- Batches ----------

const batchSchema = z.object({ name: text('a batch name', 60), deadline: dateValue });

router.post('/batches', validate(batchSchema), async (req, res) => {
  if (await Batch.exists({ name: req.body.name })) return res.status(409).json({ message: 'A batch with this name already exists.' });
  await Batch.create(req.body);
  await audit(req.user, 'Created batch', `${req.body.name}, deadline ${dayKey(req.body.deadline)}`);
  res.status(201).json({ message: `Batch ${req.body.name} created.` });
});

router.patch('/batches/:id', validate(batchSchema.partial()), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Batch not found.' });
  const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!batch) return res.status(404).json({ message: 'Batch not found.' });
  await audit(req.user, 'Updated batch', `${batch.name}, deadline ${dayKey(batch.deadline)}`);
  announceChange([]);
  res.json({ message: `Batch ${batch.name} updated.` });
});

router.delete('/batches/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Batch not found.' });
  if (await User.exists({ batch: req.params.id })) return res.status(409).json({ message: 'Move the students out of this batch before deleting it.' });
  const batch = await Batch.findByIdAndDelete(req.params.id);
  if (!batch) return res.status(404).json({ message: 'Batch not found.' });
  await audit(req.user, 'Deleted batch', batch.name);
  res.json({ message: `Batch ${batch.name} deleted.` });
});

// ---------- Audit log ----------

router.get('/audit', async (req, res) => {
  res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(300).lean());
});

export default router;
