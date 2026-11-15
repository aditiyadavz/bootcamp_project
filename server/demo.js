// Runs the app on your laptop with a temporary database and made-up sample students.
// No cloud account is needed. All data is deleted when you stop it. Run with: npm run demo
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { saveFile } from './fileStorage.js';
import Document from './models/Document.js';
import User from './models/User.js';

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const database = await MongoMemoryServer.create();
await mongoose.connect(database.getUri());

const MENTOR_PASSWORD = 'demo-mentor-pass';
const STUDENT_PASSWORD = 'demo-student-pass';
const samplePdf = Buffer.from('%PDF-1.4\n% Sample file for the demo\n');
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

await User.create({
  systemId: 'mentor01',
  name: 'Demo Mentor',
  passwordHash: await bcrypt.hash(MENTOR_PASSWORD, 10),
  role: 'admin',
});

// Each sample student shows a different stage of the process.
const REJECTED = 'Similarity is above 10%. Please revise and upload again.';
const SAMPLE_STUDENTS = [
  { systemId: '2023000001', name: 'Demo Student One', documents: { report: 'Approved', plagiarism: 'Rejected', certificate: 'Pending' } },
  { systemId: '2023000002', name: 'Demo Student Two', documents: { report: 'Approved', plagiarism: 'Approved', certificate: 'Approved' } },
  { systemId: '2023000003', name: 'Demo Student Three', documents: { report: 'Pending', plagiarism: 'Pending' } },
  { systemId: '2023000004', name: 'Demo Student Four', documents: { report: 'Pending' } },
  { systemId: '2023000005', name: 'Demo Student Five', documents: {} },
];

const passwordHash = await bcrypt.hash(STUDENT_PASSWORD, 10);
for (const sample of SAMPLE_STUDENTS) {
  const user = await User.create({ systemId: sample.systemId, name: sample.name, passwordHash });
  for (const [type, status] of Object.entries(sample.documents)) {
    const originalName = `${type}.pdf`;
    const comment = status === 'Rejected' ? REJECTED : '';
    const history = [{ action: 'Uploaded', note: originalName, at: hoursAgo(30) }];
    if (status !== 'Pending') history.push({ action: status, note: comment, at: hoursAgo(5) });
    await Document.create({
      user: user.id,
      type,
      originalName,
      fileId: await saveFile(samplePdf, originalName),
      status,
      comment,
      uploadedAt: hoursAgo(30),
      history,
    });
  }
}

const port = process.env.PORT || 5000;
createApp().listen(port, () => {
  console.log(`Demo running at http://localhost:${port}`);
  console.log(`Mentor login:  mentor01 / ${MENTOR_PASSWORD}`);
  console.log(`Student login: 2023000001 to 2023000005 / ${STUDENT_PASSWORD}`);
});
