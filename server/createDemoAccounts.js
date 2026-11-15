// Demo data in the real database for presentations.
//   npm run create-demo                    creates the demo accounts and sample students (no duplicates)
//   npm run create-demo -- --reset-samples recreates only the sample students and demo batches
//   npm run create-demo -- --remove        deletes all demo data, including the demo login accounts
// Passwords for the accounts you log in with are random and saved to demo-accounts.txt, which Git ignores.
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { deleteFile, saveFile } from './fileStorage.js';
import AuditLog from './models/AuditLog.js';
import Batch from './models/Batch.js';
import Comment from './models/Comment.js';
import Document, { DOCUMENT_TYPES } from './models/Document.js';
import Notification from './models/Notification.js';
import User from './models/User.js';
import { makePdf } from './tests/fixtures.js';

if (!process.env.MONGODB_URI) {
  console.error('Please set MONGODB_URI in your .env file first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const makePassword = () => `Demo-${crypto.randomBytes(6).toString('base64url')}`;
const daysAgo = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600000);
const TYPES = Object.keys(DOCUMENT_TYPES);

// Batches for different streams and years. Students joined four years before they graduate.
const BATCHES = [
  { name: 'B.Tech CSE 2026', days: 14, joined: 2022 },
  { name: 'B.Tech CSE (AI & ML) 2026', days: 10, joined: 2022 },
  { name: 'B.Tech ECE 2026', days: 6, joined: 2022 },
  { name: 'B.Tech IT 2027', days: 21, joined: 2023 },
  { name: 'BCA 2026', days: 18, joined: 2023 },
];
const OLD_BATCHES = ['Demo Batch A', 'Demo Batch B'];
const LOGIN_IDS = ['demo.coordinator', 'demo.mentor', 'demo.mentor2', 'demo.mentor3', 'demo.student'];
const isSample = { systemId: /^DEMO\d{7}$/ };

await mongoose.connect(process.env.MONGODB_URI);

// ---------- Removal ----------
async function removeUsers(filter) {
  const users = await User.find(filter);
  for (const user of users) {
    const documents = await Document.find({ user: user._id });
    for (const document of documents) {
      for (const version of document.versions) await deleteFile(version.fileId).catch(() => {});
      await Comment.deleteMany({ document: document._id });
    }
    await Document.deleteMany({ user: user._id });
    await Notification.deleteMany({ user: user._id });
    await AuditLog.deleteMany({ actor: user._id });
    await User.deleteOne({ _id: user._id });
  }
  return users.length;
}

async function removeDemoBatches() {
  for (const name of [...BATCHES.map((batch) => batch.name), ...OLD_BATCHES]) {
    const batch = await Batch.findOne({ name });
    if (!batch) continue;
    // Never delete a batch that real students have joined.
    const realStudents = await User.countDocuments({ batch: batch._id, ...{ systemId: { $not: /^(DEMO\d{7}|demo\.student)$/ } } });
    if (realStudents > 0) {
      console.log(`Kept batch "${name}" because ${realStudents} real student(s) use it.`);
      continue;
    }
    await User.updateMany({ batch: batch._id }, { batch: null });
    await Batch.deleteOne({ _id: batch._id });
  }
}

if (args.includes('--remove')) {
  const samples = await removeUsers(isSample);
  const logins = await removeUsers({ systemId: { $in: LOGIN_IDS } });
  await removeDemoBatches();
  await AuditLog.deleteMany({ action: 'Created demo account' });
  console.log(`Removed ${samples} sample students, ${logins} demo login accounts and the demo batches.`);
  await mongoose.disconnect();
  process.exit(0);
}

if (args.includes('--reset-samples')) {
  const samples = await removeUsers(isSample);
  await removeDemoBatches();
  console.log(`Removed ${samples} old sample students and the old demo batches. Creating them again...`);
}

const saved = ['SubmitTrack demo accounts (keep this file private)', ''];

// ---------- Batches ----------
const batches = [];
for (const { name, days, joined } of BATCHES) {
  const batch = (await Batch.findOne({ name })) ?? (await Batch.create({ name, deadline: new Date(Date.now() + days * 86400000) }));
  batches.push({ ...batch.toObject(), joined });
}

// ---------- Accounts you log in with ----------
async function account(systemId, name, role, extra = {}) {
  const existing = await User.findOne({ systemId });
  if (existing) {
    if (Object.keys(extra).length) await User.updateOne({ _id: existing._id }, extra);
    console.log(`${systemId} already exists, so its password was left unchanged.`);
    return existing;
  }
  const password = makePassword();
  const user = await User.create({ systemId, name, role, ...extra, passwordHash: await bcrypt.hash(password, 10) });
  saved.push(`${name.padEnd(18)} login ID: ${systemId.padEnd(18)} password: ${password}`);
  console.log(`Created ${systemId} (${role}).`);
  return user;
}

const coordinator = await account('demo.coordinator', 'Demo Coordinator', 'admin');
const mentors = [
  await account('demo.mentor', 'Demo Mentor', 'mentor'),
  await account('demo.mentor2', 'Demo Mentor Two', 'mentor'),
  await account('demo.mentor3', 'Demo Mentor Three', 'mentor'),
];

// ---------- Documents ----------
async function addDocument(student, batchName, type, status, dayOffset, mentor) {
  const label = DOCUMENT_TYPES[type];
  const versionCount = status === 'Pending' && type === 'plagiarism' ? 2 : 1;
  const reviewer = mentor ?? coordinator;
  const versions = [];
  const history = [];
  for (let number = 1; number <= versionCount; number += 1) {
    const uploadedAt = daysAgo(dayOffset - number + 1, 2 + number * 3);
    const originalName = `${type}_${student.systemId}${number > 1 ? `_v${number}` : ''}.pdf`;
    const pdf = makePdf([label, `${student.name} (${student.systemId})`, batchName, `Version ${number}`, 'Demo data for SubmitTrack']);
    const fileId = await saveFile(pdf, originalName);
    versions.push({ number, fileId, originalName, size: pdf.length, uploadedAt });
    history.push({ action: number === 1 ? 'Uploaded' : 'Replaced', note: `Version ${number}: ${originalName}`, by: student.name, at: uploadedAt });
    if (number < versionCount) history.push({ action: 'Rejected', note: 'Please follow the report format.', by: reviewer.name, at: daysAgo(dayOffset - number, 1) });
  }
  let similarity = null;
  let note = '';
  if (type === 'plagiarism' && status === 'Approved') similarity = 3 + (dayOffset % 6);
  if (type === 'plagiarism' && status === 'Rejected') {
    similarity = 12 + (dayOffset % 7);
    note = `Similarity is ${similarity}%. It must be below 10%.`;
  } else if (status === 'Rejected') {
    note = type === 'certificate' ? 'The certificate is not signed. Please upload the signed copy.' : 'Please follow the prescribed report format.';
  }
  if (status !== 'Pending') history.push({ action: status, note, by: reviewer.name, at: daysAgo(Math.max(0, dayOffset - versionCount), 0) });

  const document = await Document.create({ user: student._id, type, status, similarity, versions, history });
  await AuditLog.create({ actor: student._id, actorName: `${student.name} (${student.systemId})`, action: 'Uploaded document', details: `${label}, version ${versionCount}`, createdAt: versions.at(-1).uploadedAt });
  if (status !== 'Pending') {
    await AuditLog.create({ actor: reviewer._id, actorName: `${reviewer.name} (${reviewer.systemId})`, action: `${status} document`, details: `${label} of ${student.name} (${student.systemId})`, createdAt: history.at(-1).at });
  }
  if (note) {
    await Comment.create({ document: document._id, author: reviewer._id, authorName: reviewer.name, authorRole: reviewer.role, text: note });
    await Comment.create({ document: document._id, author: student._id, authorName: student.name, authorRole: 'student', text: 'Thank you, I will upload a corrected version.' });
  }
}

// The demo student you log in with: one approved, one rejected, one still to upload.
const demoStudent = await account('demo.student', 'Demo Student', 'student', { batch: batches[0]._id, mentor: mentors[0]._id });
if (!(await Document.exists({ user: demoStudent._id }))) {
  await addDocument(demoStudent, batches[0].name, 'report', 'Approved', 6, mentors[0]);
  await addDocument(demoStudent, batches[0].name, 'plagiarism', 'Rejected', 3, mentors[0]);
  await Notification.create({ user: demoStudent._id, text: 'Your Plagiarism Report was rejected by Demo Mentor.', link: '/documents/plagiarism', createdAt: daysAgo(2) });
}

// ---------- 22 sample students across streams and years ----------
// [name, batch index, mentor index or null]. Mentor 1: CSE and AI & ML. Mentor 2: IT and BCA. Mentor 3: ECE.
const STUDENTS = [
  ['Aarav Sharma', 0, 0], ['Diya Patel', 0, 0], ['Kabir Singh', 0, 0], ['Meera Nair', 0, 0], ['Rohan Gupta', 0, 0],
  ['Ananya Iyer', 1, 0], ['Arjun Mehta', 1, 0], ['Isha Verma', 1, 0], ['Karan Joshi', 1, null],
  ['Nisha Rao', 2, 2], ['Pranav Das', 2, 2], ['Riya Kapoor', 2, 2], ['Siddharth Bose', 2, 2],
  ['Tanya Malhotra', 3, 1], ['Uday Kumar', 3, 1], ['Vanya Chauhan', 3, 1], ['Yash Agarwal', 3, 1], ['Zoya Ahmed', 3, null],
  ['Neel Banerjee', 4, 1], ['Pooja Mishra', 4, 1], ['Sara Khan', 4, 1], ['Vihaan Reddy', 4, 1],
];
// Report, plagiarism and certificate status (null = not uploaded yet).
const PATTERNS = [
  ['Approved', 'Approved', 'Approved'], ['Approved', 'Pending', 'Pending'], ['Approved', 'Rejected', 'Pending'],
  ['Pending', 'Pending', null], ['Rejected', null, null], ['Pending', null, null], ['Approved', 'Approved', 'Pending'],
  [null, null, null], ['Approved', 'Approved', null], ['Pending', 'Pending', 'Pending'], ['Approved', 'Pending', null],
];

if (await User.exists(isSample)) {
  console.log('Sample students already exist, so they were left unchanged. Use --reset-samples to recreate them.');
} else {
  const unknownHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10); // Nobody logs in as these.
  const perBatch = {};
  for (let index = 0; index < STUDENTS.length; index += 1) {
    const [name, batchIndex, mentorIndex] = STUDENTS[index];
    const batch = batches[batchIndex];
    perBatch[batchIndex] = (perBatch[batchIndex] ?? 0) + 1;
    // For example DEMO2022101: joined in 2022, batch 1, student 01.
    const systemId = `DEMO${batch.joined}${batchIndex + 1}${String(perBatch[batchIndex]).padStart(2, '0')}`;
    const mentor = mentorIndex === null ? null : mentors[mentorIndex];
    const student = await User.create({ systemId, name, role: 'student', passwordHash: unknownHash, batch: batch._id, mentor: mentor?._id ?? null });
    await AuditLog.create({ actor: student._id, actorName: `${name} (${systemId})`, action: 'Registered', details: `Student account created in ${batch.name}`, createdAt: daysAgo(14, index) });
    const statuses = PATTERNS[index % PATTERNS.length];
    for (let t = 0; t < TYPES.length; t += 1) {
      if (statuses[t]) await addDocument(student, batch.name, TYPES[t], statuses[t], 1 + ((index * 3 + t * 4) % 12), mentor);
    }
    console.log(`Created ${systemId} ${name} (${batch.name})`);
  }
  await Notification.create([
    { user: mentors[0]._id, text: 'Aarav Sharma uploaded the Internship Completion Certificate (version 1).', link: '/mentor', createdAt: daysAgo(0, 3) },
    { user: mentors[0]._id, text: 'Demo Student sent a message about the Plagiarism Report.', link: '/mentor', createdAt: daysAgo(1) },
  ]);
}

await mongoose.disconnect();
if (saved.length > 2) {
  fs.appendFileSync('demo-accounts.txt', `${saved.join('\n')}\n\n`);
  console.log('Login details saved to demo-accounts.txt');
}
console.log('Done.');
