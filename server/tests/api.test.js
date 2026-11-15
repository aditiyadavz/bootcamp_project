// API tests. Run: npm test
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import AuditLog from '../models/AuditLog.js';
import Batch from '../models/Batch.js';
import Comment from '../models/Comment.js';
import Document from '../models/Document.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { asBuffer, clearDatabase, createUser, loginAs, PASSWORD, PDF, startDatabase, stopDatabase, upload } from './helpers.js';

let app;
let admin;
let mentor;
let student;
let batch;

before(async () => {
  await startDatabase();
  app = createApp();
});
after(stopDatabase);

beforeEach(async () => {
  await clearDatabase();
  batch = await Batch.create({ name: 'CSE 2026', deadline: new Date(Date.now() + 5 * 86400000) });
  admin = await createUser('admin1', 'admin');
  mentor = await createUser('mentor1', 'mentor');
  student = await createUser('STU1', 'student', { mentor: mentor._id, batch: batch._id });
});

const firstDocument = () => Document.findOne();

describe('Accounts', () => {
  test('a student can register with a batch and log in', async () => {
    const res = await request(app).post('/api/auth/register').send({ systemId: 'STU9', name: 'New Student', password: PASSWORD, batch: batch.id });
    assert.equal(res.status, 201);
    const agent = await loginAs(app, 'STU9');
    const me = (await agent.get('/api/auth/me')).body;
    assert.equal(me.role, 'student');
    assert.equal(me.batch.name, 'CSE 2026');
    assert.ok(me.deadline);
  });

  test('registration checks every field', async () => {
    const short = await request(app).post('/api/auth/register').send({ systemId: 'STU9', name: 'X', password: 'short' });
    assert.equal(short.status, 400);
    assert.match(short.body.message, /8 characters/);
    const badId = await request(app).post('/api/auth/register').send({ systemId: 'a b', name: 'X', password: PASSWORD });
    assert.equal(badId.status, 400);
    const badBatch = await request(app).post('/api/auth/register').send({ systemId: 'STU9', name: 'X', password: PASSWORD, batch: new mongoose.Types.ObjectId().toString() });
    assert.equal(badBatch.status, 400);
  });

  test('a duplicate System ID is refused', async () => {
    const res = await request(app).post('/api/auth/register').send({ systemId: 'STU1', name: 'Copy', password: PASSWORD });
    assert.equal(res.status, 409);
  });

  test('a wrong password is refused and passwords are stored only as hashes', async () => {
    const res = await request(app).post('/api/auth/login').send({ systemId: 'STU1', password: 'wrong-password' });
    assert.equal(res.status, 401);
    const stored = await User.findOne({ systemId: 'STU1' });
    assert.ok(!stored.passwordHash.includes(PASSWORD));
  });

  test('a database query sent as a login value is refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ systemId: { $ne: null }, password: PASSWORD });
    assert.equal(res.status, 400);
  });

  test('a deactivated user cannot log in or keep using a session', async () => {
    const agent = await loginAs(app, 'STU1');
    await User.updateOne({ _id: student._id }, { active: false });
    assert.equal((await agent.get('/api/documents')).status, 401);
    const res = await request(app).post('/api/auth/login').send({ systemId: 'STU1', password: PASSWORD });
    assert.equal(res.status, 403);
  });

  test('users can change their name and password', async () => {
    const agent = await loginAs(app, 'STU1');
    assert.equal((await agent.patch('/api/auth/me').send({ name: 'Renamed' })).body.name, 'Renamed');
    const wrong = await agent.post('/api/auth/password').send({ currentPassword: 'nope-nope', newPassword: 'another-pass-1' });
    assert.equal(wrong.status, 400);
    const ok = await agent.post('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'another-pass-1' });
    assert.equal(ok.status, 200);
    const login = await request(app).post('/api/auth/login').send({ systemId: 'STU1', password: 'another-pass-1' });
    assert.equal(login.status, 200);
  });

  test('too many login attempts are blocked', async () => {
    process.env.LOGIN_LIMIT = '1';
    const first = await request(app).post('/api/auth/login').send({ systemId: 'STU1', password: 'wrong-1' });
    const second = await request(app).post('/api/auth/login').send({ systemId: 'STU1', password: 'wrong-2' });
    process.env.LOGIN_LIMIT = '10000';
    assert.ok([first.status, second.status].includes(429));
  });
});

describe('Uploads and versions', () => {
  test('a valid PDF is uploaded as Pending and the mentor is notified', async () => {
    const agent = await loginAs(app, 'STU1');
    assert.equal((await upload(agent)).status, 201);
    const { documents } = (await agent.get('/api/documents')).body;
    assert.equal(documents[0].status, 'Pending');
    assert.equal(documents[0].latest.number, 1);
    assert.equal(await Notification.countDocuments({ user: mentor._id }), 1);
  });

  test('wrong extensions, fake PDFs and files over 5 MB are refused', async () => {
    const agent = await loginAs(app, 'STU1');
    assert.equal((await upload(agent, 'report', PDF, 'report.exe')).status, 400);
    assert.equal((await upload(agent, 'report', Buffer.from('not a pdf'))).status, 400);
    assert.equal((await upload(agent, 'report', Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]))).status, 413);
    assert.equal((await upload(agent, 'thesis')).status, 404);
  });

  test('uploads close after the batch deadline, but a personal extension reopens them', async () => {
    await Batch.updateOne({ _id: batch._id }, { deadline: new Date(Date.now() - 1000) });
    const agent = await loginAs(app, 'STU1');
    assert.equal((await upload(agent)).status, 403);
    await User.updateOne({ _id: student._id }, { extendedDeadline: new Date(Date.now() + 86400000) });
    assert.equal((await upload(agent)).status, 201);
  });

  test('every upload is kept as a version and old versions can be opened', async () => {
    const agent = await loginAs(app, 'STU1');
    await upload(agent, 'report', Buffer.from('%PDF-first'));
    await upload(agent, 'report', Buffer.from('%PDF-second'));
    const document = await firstDocument();
    assert.equal(document.versions.length, 2);
    const v1 = await agent.get(`/api/documents/${document.id}/file?version=1`).buffer(true).parse(asBuffer);
    assert.equal(v1.body.toString(), '%PDF-first');
    const latest = await agent.get(`/api/documents/${document.id}/file`).buffer(true).parse(asBuffer);
    assert.equal(latest.body.toString(), '%PDF-second');
  });

  test('only the newest 5 versions are kept and older files are deleted', async () => {
    const agent = await loginAs(app, 'STU1');
    for (let i = 0; i < 7; i += 1) await upload(agent);
    const document = await firstDocument();
    assert.deepEqual(document.versions.map((version) => version.number), [3, 4, 5, 6, 7]);
    assert.equal(await mongoose.connection.db.collection('pdfs.files').countDocuments(), 5);
  });

  test('files can be previewed in the page or downloaded', async () => {
    const agent = await loginAs(app, 'STU1');
    await upload(agent);
    const document = await firstDocument();
    assert.equal((await agent.get(`/api/documents/${document.id}/file?view=1`)).headers['content-disposition'], 'inline');
    assert.match((await agent.get(`/api/documents/${document.id}/file`)).headers['content-disposition'], /^attachment/);
  });
});

describe('Permissions', () => {
  test('documents need a login', async () => {
    assert.equal((await request(app).get('/api/documents')).status, 401);
  });

  test('a student cannot open another student\'s file or details', async () => {
    await upload(await loginAs(app, 'STU1'));
    const document = await firstDocument();
    await createUser('STU2');
    const other = await loginAs(app, 'STU2');
    assert.equal((await other.get(`/api/documents/${document.id}/file`)).status, 403);
    assert.equal((await other.get(`/api/documents/${document.id}`)).status, 403);
  });

  test('a mentor sees only assigned students', async () => {
    await createUser('STU2', 'student', { mentor: null });
    const agent = await loginAs(app, 'mentor1');
    const { students } = (await agent.get('/api/mentor/students')).body;
    assert.deepEqual(students.map((item) => item.systemId), ['STU1']);
    const unassigned = await User.findOne({ systemId: 'STU2' });
    assert.equal((await agent.get(`/api/mentor/students/${unassigned.id}`)).status, 404);
  });

  test('an unassigned mentor cannot open or review a student\'s file', async () => {
    await upload(await loginAs(app, 'STU1'));
    const document = await firstDocument();
    await createUser('mentor2', 'mentor');
    const other = await loginAs(app, 'mentor2');
    assert.equal((await other.get(`/api/documents/${document.id}/file`)).status, 403);
    assert.equal((await other.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Approved' })).status, 404);
  });

  test('students and mentors cannot use admin actions', async () => {
    assert.equal((await (await loginAs(app, 'STU1')).get('/api/admin/stats')).status, 403);
    assert.equal((await (await loginAs(app, 'mentor1')).get('/api/admin/users')).status, 403);
    assert.equal((await (await loginAs(app, 'STU1')).get('/api/mentor/students')).status, 403);
  });
});

describe('Review and comments', () => {
  test('a rejection needs a comment, and the comment reaches the student', async () => {
    await upload(await loginAs(app, 'STU1'));
    const document = await firstDocument();
    const agent = await loginAs(app, 'mentor1');
    assert.equal((await agent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Rejected' })).status, 400);
    await agent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Rejected', comment: 'Add the signature' });
    const studentAgent = await loginAs(app, 'STU1');
    const details = (await studentAgent.get(`/api/documents/${document.id}`)).body;
    assert.equal(details.document.status, 'Rejected');
    assert.equal(details.comments[0].text, 'Add the signature');
    assert.equal(await Notification.countDocuments({ user: student._id }), 1);
  });

  test('a plagiarism report needs a similarity below 10% to be approved', async () => {
    await upload(await loginAs(app, 'STU1'), 'plagiarism');
    const document = await firstDocument();
    const agent = await loginAs(app, 'mentor1');
    const review = (body) => agent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Approved', ...body });
    assert.equal((await review({})).status, 400);
    assert.equal((await review({ similarity: 12 })).status, 400);
    assert.equal((await review({ similarity: 150 })).status, 400);
    assert.equal((await review({ similarity: 7.5 })).status, 200);
    assert.equal((await firstDocument()).similarity, 7.5);
  });

  test('an approved file cannot be replaced, and a rejected one can', async () => {
    const studentAgent = await loginAs(app, 'STU1');
    await upload(studentAgent);
    const document = await firstDocument();
    const agent = await loginAs(app, 'mentor1');
    await agent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Rejected', comment: 'Fix it' });
    assert.equal((await upload(studentAgent)).status, 201);
    assert.equal((await firstDocument()).status, 'Pending');
    await agent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Approved' });
    assert.equal((await upload(studentAgent)).status, 409);
  });

  test('students and mentors can message each other about a document', async () => {
    const studentAgent = await loginAs(app, 'STU1');
    await upload(studentAgent);
    const document = await firstDocument();
    assert.equal((await studentAgent.post(`/api/documents/${document.id}/comments`).send({ text: 'Is the format right?' })).status, 201);
    const mentorAgent = await loginAs(app, 'mentor1');
    await mentorAgent.post(`/api/documents/${document.id}/comments`).send({ text: 'Yes, it is.' });
    assert.equal((await studentAgent.post(`/api/documents/${document.id}/comments`).send({ text: '   ' })).status, 400);
    const comments = await Comment.find().sort('createdAt');
    assert.deepEqual(comments.map((comment) => comment.authorRole), ['student', 'mentor']);
    const details = (await mentorAgent.get(`/api/mentor/students/${student.id}`)).body;
    assert.equal(details.documents[0].comments.length, 2);
  });

  test('the activity history records uploads and reviews', async () => {
    const studentAgent = await loginAs(app, 'STU1');
    await upload(studentAgent);
    const document = await firstDocument();
    await (await loginAs(app, 'mentor1')).patch(`/api/mentor/documents/${document.id}`).send({ status: 'Rejected', comment: 'Fix it' });
    await upload(studentAgent);
    assert.deepEqual((await firstDocument()).history.map((entry) => entry.action), ['Uploaded', 'Rejected', 'Replaced']);
  });
});

describe('Notifications', () => {
  test('notifications can be listed and marked as read only by their owner', async () => {
    await upload(await loginAs(app, 'STU1'));
    const mentorAgent = await loginAs(app, 'mentor1');
    const { notifications, unread } = (await mentorAgent.get('/api/notifications')).body;
    assert.equal(unread, 1);
    const studentAgent = await loginAs(app, 'STU1');
    assert.equal((await studentAgent.post(`/api/notifications/${notifications[0]._id}/read`)).status, 404);
    await mentorAgent.post(`/api/notifications/${notifications[0]._id}/read`);
    assert.equal((await mentorAgent.get('/api/notifications')).body.unread, 0);
  });

  test('reminders need the secret key and reach students who still have work to do', async () => {
    assert.equal((await request(app).post('/api/reminders/run')).status, 401);
    assert.equal((await request(app).post('/api/reminders/run').set('Authorization', 'Bearer wrong')).status, 401);
    await Batch.updateOne({ _id: batch._id }, { deadline: new Date(Date.now() + 2 * 86400000) });
    await createUser('STU2', 'student', { batch: (await Batch.create({ name: 'Later', deadline: new Date(Date.now() + 30 * 86400000) }))._id });
    const run = () => request(app).post('/api/reminders/run').set('Authorization', 'Bearer test-cron-secret');
    assert.equal((await run()).body.sent, 1); // Only STU1 is due within 3 days.
    assert.equal((await run()).body.sent, 0); // At most one reminder a day.
    const reminder = await Notification.findOne({ user: student._id, kind: 'reminder' });
    assert.match(reminder.text, /Final Project Report/);
  });
});

describe('Admin', () => {
  test('an admin can create a mentor, assign a student and give an extension', async () => {
    const agent = await loginAs(app, 'admin1');
    const created = await agent.post('/api/admin/users').send({ systemId: 'mentor2', name: 'Second Mentor', password: PASSWORD, role: 'mentor' });
    assert.equal(created.status, 201);
    const extension = new Date(Date.now() + 10 * 86400000).toISOString();
    const res = await agent.patch(`/api/admin/users/${student.id}`).send({ mentor: created.body.id, extendedDeadline: extension });
    assert.equal(res.status, 200);
    const updated = await User.findById(student._id);
    assert.equal(updated.mentor.toString(), created.body.id);
    assert.equal(updated.extendedDeadline.toISOString(), extension);
    assert.equal((await agent.patch(`/api/admin/users/${student.id}`).send({ mentor: admin.id })).status, 400);
  });

  test('an admin cannot remove their own admin access', async () => {
    const agent = await loginAs(app, 'admin1');
    assert.equal((await agent.patch(`/api/admin/users/${admin.id}`).send({ active: false })).status, 400);
    assert.equal((await agent.patch(`/api/admin/users/${admin.id}`).send({ role: 'mentor' })).status, 400);
  });

  test('batches can be created and changed, and only empty batches deleted', async () => {
    const agent = await loginAs(app, 'admin1');
    assert.equal((await agent.post('/api/admin/batches').send({ name: 'ECE 2026', deadline: '2026-12-01T23:59:59+05:30' })).status, 201);
    assert.equal((await agent.post('/api/admin/batches').send({ name: 'ECE 2026', deadline: '2026-12-01' })).status, 409);
    assert.equal((await agent.post('/api/admin/batches').send({ name: 'Bad', deadline: 'not a date' })).status, 400);
    assert.equal((await agent.delete(`/api/admin/batches/${batch.id}`)).status, 409);
    const empty = await Batch.findOne({ name: 'ECE 2026' });
    assert.equal((await agent.patch(`/api/admin/batches/${empty.id}`).send({ name: 'ECE 2027' })).status, 200);
    assert.equal((await agent.delete(`/api/admin/batches/${empty.id}`)).status, 200);
  });

  test('statistics count every status, including missing documents', async () => {
    await upload(await loginAs(app, 'STU1'));
    const stats = (await (await loginAs(app, 'admin1')).get('/api/admin/stats')).body;
    assert.equal(stats.students, 1);
    assert.deepEqual(stats.statusTotals, { Approved: 0, Pending: 1, Rejected: 0, Missing: 2 });
    assert.equal(stats.uploadsPerDay.length, 14);
    assert.equal(stats.uploadsPerDay.at(-1).uploads, 1);
    assert.equal(stats.mentorLoad[0].pending, 1);
  });

  test('the CSV export lists students and makes formula-like cells safe', async () => {
    await User.updateOne({ _id: student._id }, { name: '=HYPERLINK("evil")' });
    const res = await (await loginAs(app, 'admin1')).get('/api/admin/export.csv');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /"'=HYPERLINK\(""evil""\)"/);
    assert.match(res.text, /"Missing"/);
  });

  test('important actions are written to the audit log', async () => {
    await upload(await loginAs(app, 'STU1'));
    const agent = await loginAs(app, 'admin1');
    await agent.post('/api/admin/batches').send({ name: 'ECE 2026', deadline: '2026-12-01' });
    const entries = (await agent.get('/api/admin/audit')).body;
    assert.deepEqual(entries.map((entry) => entry.action).sort(), ['Created batch', 'Uploaded document']);
    assert.equal(await AuditLog.countDocuments(), 2);
  });
});

describe('System', () => {
  test('the health check reports the database connection', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.databaseConnected, true);
  });

  test('the API documentation is available', async () => {
    assert.equal((await request(app).get('/api/openapi.json')).body.info.title, 'Student Document Submission Portal API');
    assert.equal((await request(app).get('/api/docs/')).status, 200);
  });
});
