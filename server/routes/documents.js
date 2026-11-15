// Student actions: see my documents, upload a PDF, and download a PDF.
import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { deleteFile, openFile, saveFile } from '../fileStorage.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import Document, { DOCUMENT_TYPES } from '../models/Document.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const deadline = () => new Date(process.env.DEADLINE || '2026-11-10T23:59:59+05:30');

router.use(requireLogin);

router.get('/', requireRole('student'), async (req, res) => {
  const documents = await Document.find({ user: req.user.id }).select('-fileId');
  res.json({ documents, types: DOCUMENT_TYPES, deadline: deadline() });
});

router.post('/:type', requireRole('student'), upload.single('file'), async (req, res) => {
  const { type } = req.params;
  if (!Object.hasOwn(DOCUMENT_TYPES, type)) return res.status(404).json({ message: 'Unknown document type.' });
  if (new Date() > deadline()) return res.status(403).json({ message: 'The deadline has passed, so uploads are closed.' });

  const existing = await Document.findOne({ user: req.user.id, type });
  if (existing?.status === 'Approved') return res.status(409).json({ message: 'This document is already approved and cannot be replaced.' });

  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Please choose a file first.' });
  // Check the name and the first bytes, because a file name can be faked.
  const looksLikePdf = file.originalname.toLowerCase().endsWith('.pdf') && file.buffer.subarray(0, 5).toString() === '%PDF-';
  if (!looksLikePdf) return res.status(400).json({ message: 'Only PDF files are allowed.' });

  const fileId = await saveFile(file.buffer, file.originalname);
  await Document.findOneAndUpdate(
    { user: req.user.id, type },
    {
      $set: { originalName: file.originalname, fileId, status: 'Pending', comment: '', uploadedAt: new Date() },
      $push: { history: { action: existing ? 'Replaced' : 'Uploaded', note: file.originalname, at: new Date() } },
    },
    { upsert: true },
  );
  if (existing) await deleteFile(existing.fileId);
  res.status(201).json({ message: `${DOCUMENT_TYPES[type]} uploaded.` });
});

router.get('/:id/file', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'File not found.' });
  const document = await Document.findById(req.params.id);
  if (!document) return res.status(404).json({ message: 'File not found.' });

  // Students can open only their own files. The mentor can open all files.
  if (req.user.role !== 'admin' && !document.user.equals(req.user.id)) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  // ?view=1 opens the PDF in a browser tab. Otherwise the browser downloads it.
  if (req.query.view === '1') res.set('Content-Disposition', 'inline');
  else res.attachment(document.originalName);
  res.type('application/pdf');
  openFile(document.fileId).pipe(res);
});

export default router;
