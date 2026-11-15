// Test data for browser tests and screenshots. It is only ever written to a temporary test database.
import bcrypt from 'bcryptjs';
import { saveFile } from '../fileStorage.js';
import AuditLog from '../models/AuditLog.js';
import Batch from '../models/Batch.js';
import Comment from '../models/Comment.js';
import Document, { DOCUMENT_TYPES } from '../models/Document.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const TEST_PASSWORD = 'Test@12345';

// Builds a small but valid one-page PDF, so the in-page preview shows real content.
export function makePdf(lines) {
  const escape = (text) => text.replace(/[\\()]/g, (char) => `\\${char}`);
  const textOps = lines.map((line, index) => `BT /F1 ${index === 0 ? 20 : 12} Tf 60 ${740 - index * (index === 0 ? 0 : 22) - (index ? 30 : 0)} Td (${escape(line)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(textOps)} >>\nstream\n${textOps}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const daysAgo = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600000);

export async function seed() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const batchA = await Batch.create({ name: 'B.Tech CSE 2026', deadline: new Date(Date.now() + 4 * 86400000 + 5 * 3600000) });
  await Batch.create({ name: 'B.Tech IT 2026', deadline: new Date(Date.now() + 12 * 86400000) });

  const admin = await User.create({ systemId: 'coordinator', name: 'Test Coordinator', role: 'admin', passwordHash });
  const mentorA = await User.create({ systemId: 'mentor.rao', name: 'Dr. Test Rao', role: 'mentor', passwordHash });
  const mentorB = await User.create({ systemId: 'mentor.iyer', name: 'Prof. Test Iyer', role: 'mentor', passwordHash });

  // [System ID, name, mentor, statuses for report / plagiarism / certificate]
  const plan = [
    ['2023001001', 'Test Student Aarav', mentorA, ['Approved', 'Rejected', 'Pending']],
    ['2023001002', 'Test Student Diya', mentorA, ['Approved', 'Approved', 'Approved']],
    ['2023001003', 'Test Student Kabir', mentorA, ['Pending', 'Pending', null]],
    ['2023001004', 'Test Student Meera', mentorB, ['Rejected', null, null]],
    ['2023001005', 'Test Student Rohan', mentorB, ['Approved', 'Pending', 'Pending']],
    ['2023001006', 'Test Student Sara', mentorB, ['Pending', null, null]],
    ['2023001007', 'Test Student Vihaan', null, [null, null, null]],
  ];

  let day = 11;
  for (const [systemId, name, mentor, statuses] of plan) {
    const student = await User.create({ systemId, name, passwordHash, batch: batchA._id, mentor: mentor?._id ?? null });
    const types = Object.keys(DOCUMENT_TYPES);
    for (let index = 0; index < types.length; index += 1) {
      const status = statuses[index];
      if (!status) continue;
      const type = types[index];
      const label = DOCUMENT_TYPES[type];
      day = day <= 1 ? 11 : day - 1;
      const versions = [];
      const history = [];
      const count = status === 'Rejected' || (status === 'Pending' && index === 1) ? 2 : 1;
      for (let number = 1; number <= count; number += 1) {
        const uploadedAt = daysAgo(day - number + 1, 3 * number);
        const originalName = `${type}_${systemId}${number > 1 ? `_v${number}` : ''}.pdf`;
        const fileId = await saveFile(makePdf([label, `${name} (${systemId})`, 'B.Tech CSE 2026', `Version ${number}`, 'Test file for the SubmitTrack test suite.']), originalName);
        versions.push({ number, fileId, originalName, size: 1400 + number * 37, uploadedAt });
        history.push({ action: number === 1 ? 'Uploaded' : 'Replaced', note: `Version ${number}: ${originalName}`, by: name, at: uploadedAt });
        if (number < count) history.push({ action: 'Rejected', note: 'Please follow the report format.', by: mentor?.name ?? 'Test Coordinator', at: daysAgo(day - number, 1) });
      }
      const similarity = type === 'plagiarism' && status !== 'Pending' ? (status === 'Approved' ? 6 : 14) : null;
      const note = status === 'Rejected' ? (type === 'plagiarism' ? 'Similarity is 14%. It must be below 10%.' : 'Signature is missing on the last page.') : '';
      if (status !== 'Pending') history.push({ action: status, note, by: mentor?.name ?? 'Test Coordinator', at: daysAgo(Math.max(0, day - count), 0) });
      const document = await Document.create({ user: student._id, type, status, similarity, versions, history });
      if (note) {
        await Comment.create({ document: document._id, author: mentor._id, authorName: mentor.name, authorRole: 'mentor', text: note });
      }
      if (status === 'Rejected') {
        await Comment.create({ document: document._id, author: student._id, authorName: name, authorRole: 'student', text: 'Thank you. I will upload a corrected version today.' });
      }
      await AuditLog.create({ actor: student._id, actorName: `${name} (${systemId})`, action: 'Uploaded document', details: `${label}, version ${count}`, createdAt: versions.at(-1).uploadedAt });
    }
  }

  await Notification.create([
    { user: mentorA._id, text: 'Test Student Kabir uploaded the Plagiarism Report (version 2).', link: '/mentor', createdAt: daysAgo(0, 2) },
    { user: mentorA._id, text: 'Test Student Aarav sent a message about the Plagiarism Report.', link: '/mentor', createdAt: daysAgo(0, 5), read: true },
  ]);
  await AuditLog.create([
    { actor: admin._id, actorName: 'Test Coordinator (coordinator)', action: 'Created batch', details: 'B.Tech CSE 2026', createdAt: daysAgo(14) },
    { actor: admin._id, actorName: 'Test Coordinator (coordinator)', action: 'Created user', details: 'Dr. Test Rao (mentor.rao) as mentor', createdAt: daysAgo(14) },
    { actor: null, actorName: 'System', action: 'Sent deadline reminders', details: '3 students', createdAt: daysAgo(0, 6) },
  ]);
}
