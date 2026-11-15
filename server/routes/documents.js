// Documents: list, upload a new version, view details, open a file, and discuss it in comments.
import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { MAX_FILE_MB, MAX_VERSIONS } from '../config.js';
import { deleteFile, openFile, saveFile } from '../fileStorage.js';
import { canAccessStudent, deadlineFor } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { announceChange, notify } from '../lib/notify.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import { text, validate } from '../middleware/validate.js';
import Comment from '../models/Comment.js';
import Document, { DOCUMENT_TYPES, toPublic } from '../models/Document.js';
import User from '../models/User.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

router.use(requireLogin);

// Finds a document and checks that this user may see it.
async function findAllowed(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Document not found.' });
    return null;
  }
  const document = await Document.findById(req.params.id);
  if (!document) {
    res.status(404).json({ message: 'Document not found.' });
    return null;
  }
  if (!(await canAccessStudent(req.user, document.user))) {
    res.status(403).json({ message: 'Access denied.' });
    return null;
  }
  return document;
}

router.get('/', requireRole('student'), async (req, res) => {
  const documents = await Document.find({ user: req.user._id });
  res.json({ documents: documents.map(toPublic), types: DOCUMENT_TYPES, deadline: await deadlineFor(req.user) });
});

router.post('/:type', requireRole('student'), upload.single('file'), async (req, res) => {
  const { type } = req.params;
  if (!Object.hasOwn(DOCUMENT_TYPES, type)) return res.status(404).json({ message: 'Unknown document type.' });

  const deadline = await deadlineFor(req.user);
  if (deadline && new Date() > deadline) return res.status(403).json({ message: 'The deadline has passed, so uploads are closed.' });

  const existing = await Document.findOne({ user: req.user._id, type });
  if (existing?.status === 'Approved') return res.status(409).json({ message: 'This document is already approved and cannot be replaced.' });

  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Please choose a file first.' });
  // Check the name and the first bytes, because a file name can be faked.
  const looksLikePdf = file.originalname.toLowerCase().endsWith('.pdf') && file.buffer.subarray(0, 5).toString() === '%PDF-';
  if (!looksLikePdf) return res.status(400).json({ message: 'Only PDF files are allowed.' });

  const document = existing ?? new Document({ user: req.user._id, type });
  const number = (document.versions.at(-1)?.number ?? 0) + 1;
  const fileId = await saveFile(file.buffer, file.originalname);
  document.versions.push({ number, fileId, originalName: file.originalname, size: file.size, uploadedAt: new Date() });
  document.status = 'Pending';
  document.similarity = null;
  document.history.push({ action: existing ? 'Replaced' : 'Uploaded', note: `Version ${number}: ${file.originalname}`, by: req.user.name });

  // Keep only the newest versions, so the free database does not fill up.
  while (document.versions.length > MAX_VERSIONS) {
    const [oldest] = document.versions.splice(0, 1);
    await deleteFile(oldest.fileId);
  }
  await document.save();

  const label = DOCUMENT_TYPES[type];
  await notify(req.user.mentor, `${req.user.name} uploaded the ${label} (version ${number}).`, `/mentor/students/${req.user.id}`);
  await audit(req.user, 'Uploaded document', `${label}, version ${number}`);
  announceChange([req.user.id, req.user.mentor]);
  res.status(201).json({ message: `${label} uploaded.` });
});

router.get('/:id', async (req, res) => {
  const document = await findAllowed(req, res);
  if (!document) return;
  const owner = await User.findById(document.user).select('name systemId');
  const comments = await Comment.find({ document: document._id }).sort('createdAt').lean();
  res.json({ document: toPublic(document), owner, comments });
});

router.get('/:id/file', async (req, res) => {
  const document = await findAllowed(req, res);
  if (!document) return;
  const number = req.query.version ? Number(req.query.version) : document.versions.at(-1).number;
  const version = document.versions.find((item) => item.number === number);
  if (!version) return res.status(404).json({ message: 'That version no longer exists.' });

  // ?view=1 shows the PDF inside the page. Otherwise the browser downloads it.
  if (req.query.view === '1') res.set('Content-Disposition', 'inline');
  else res.attachment(version.originalName);
  res.type('application/pdf');
  openFile(version.fileId).pipe(res);
});

router.post('/:id/comments', validate(z.object({ text: text('a message', 1000) })), async (req, res) => {
  const document = await findAllowed(req, res);
  if (!document) return;
  const comment = await Comment.create({
    document: document._id,
    author: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
    text: req.body.text,
  });

  // Tell the other side of the conversation.
  const student = await User.findById(document.user).select('name mentor');
  const label = DOCUMENT_TYPES[document.type];
  if (req.user._id.equals(student._id)) {
    await notify(student.mentor, `${student.name} sent a message about the ${label}.`, `/mentor/students/${student.id}`);
  } else {
    await notify(student._id, `${req.user.name} sent a message about your ${label}.`, `/documents/${document.type}`);
  }
  announceChange([student.id, student.mentor]);
  res.status(201).json(comment);
});

export default router;
