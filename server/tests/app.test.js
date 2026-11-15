// Automatic tests. They use a temporary database, never your real data. Run: npm test
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import Document from '../models/Document.js';
import User from '../models/User.js';

const PASSWORD = 'test-pass-123';
const PDF = Buffer.from('%PDF-1.4 test file');
let database;
let app;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.LOGIN_LIMIT = '1000'; // The tests log in many times.
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await database.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await User.syncIndexes();
  await Document.syncIndexes();
  process.env.DEADLINE = new Date(Date.now() + 86400000).toISOString();
  await User.create({ systemId: 'mentor', name: 'Mentor', passwordHash: await bcrypt.hash(PASSWORD, 4), role: 'admin' });
});

const register = (systemId = 'S1', password = PASSWORD) =>
  request(app).post('/api/auth/register').send({ systemId, name: `Student ${systemId}`, password });

async function login(systemId = 'S1', password = PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ systemId, password });
  return { agent, response };
}

async function student(systemId = 'S1') {
  await register(systemId);
  return (await login(systemId)).agent;
}

const upload = (agent, content = PDF, filename = 'report.pdf', type = 'report') =>
  agent.post(`/api/documents/${type}`).attach('file', content, { filename, contentType: 'application/pdf' });

test('01 student can register and log in', async () => {
  assert.equal((await register()).status, 201);
  assert.equal((await login()).response.body.role, 'student');
});

test('02 short password is refused', async () => {
  assert.equal((await register('S1', 'short')).status, 400);
});

test('03 duplicate System ID is refused', async () => {
  await register();
  assert.equal((await register()).status, 409);
});

test('04 wrong password is refused', async () => {
  await register();
  assert.equal((await login('S1', 'wrong-password')).response.status, 401);
});

test('05 password is stored only as a hash', async () => {
  await register();
  const user = await User.findOne({ systemId: 'S1' });
  assert.ok(!user.passwordHash.includes(PASSWORD));
});

test('06 database query sent as a login value does not log in', async () => {
  await register();
  const response = await request(app).post('/api/auth/login').send({ systemId: { $ne: null }, password: PASSWORD });
  assert.equal(response.status, 401);
});

test('07 documents need a login', async () => {
  assert.equal((await request(app).get('/api/documents')).status, 401);
});

test('08 valid PDF is uploaded with Pending status', async () => {
  const agent = await student();
  assert.equal((await upload(agent)).status, 201);
  const { body } = await agent.get('/api/documents');
  assert.equal(body.documents[0].status, 'Pending');
});

test('09 wrong file extension is refused', async () => {
  assert.equal((await upload(await student(), PDF, 'report.exe')).status, 400);
});

test('10 fake PDF is refused', async () => {
  assert.equal((await upload(await student(), Buffer.from('not a pdf'))).status, 400);
});

test('11 file over 5 MB is refused', async () => {
  const bigFile = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
  assert.equal((await upload(await student(), bigFile)).status, 413);
});

test('12 upload after the deadline is refused', async () => {
  const agent = await student();
  process.env.DEADLINE = new Date(Date.now() - 1000).toISOString();
  assert.equal((await upload(agent)).status, 403);
});

test('13 student cannot open another student\'s file', async () => {
  await upload(await student('S1'));
  const document = await Document.findOne();
  const other = await student('S2');
  assert.equal((await other.get(`/api/documents/${document.id}/file`)).status, 403);
});

test('14 student cannot use mentor actions', async () => {
  assert.equal((await (await student()).get('/api/admin/students')).status, 403);
});

test('15 mentor can open a student\'s file', async () => {
  await upload(await student());
  const document = await Document.findOne();
  const { agent } = await login('mentor');
  const response = await agent.get(`/api/documents/${document.id}/file`).buffer(true).parse((res, done) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, PDF);
});

test('16 rejection needs a comment', async () => {
  await upload(await student());
  const document = await Document.findOne();
  const { agent } = await login('mentor');
  const response = await agent.patch(`/api/admin/documents/${document.id}`).send({ status: 'Rejected' });
  assert.equal(response.status, 400);
});

test('17 student sees rejection comment and can replace the file', async () => {
  const studentAgent = await student();
  await upload(studentAgent);
  const document = await Document.findOne();
  const { agent } = await login('mentor');
  await agent.patch(`/api/admin/documents/${document.id}`).send({ status: 'Rejected', comment: 'Add the signature' });

  const { body } = await studentAgent.get('/api/documents');
  assert.equal(body.documents[0].comment, 'Add the signature');
  assert.equal((await upload(studentAgent)).status, 201);
  assert.equal((await Document.findOne()).status, 'Pending');
});

test('18 replacing a file removes the old file from storage', async () => {
  const agent = await student();
  await upload(agent);
  await upload(agent);
  assert.equal(await mongoose.connection.db.collection('pdfs.files').countDocuments(), 1);
});

test('19 approved file cannot be replaced', async () => {
  const studentAgent = await student();
  await upload(studentAgent);
  const document = await Document.findOne();
  const { agent } = await login('mentor');
  await agent.patch(`/api/admin/documents/${document.id}`).send({ status: 'Approved' });
  assert.equal((await upload(studentAgent)).status, 409);
});

test('20 health check reports the database connection', async () => {
  const { status, body } = await request(app).get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.databaseConnected, true);
});

test('21 activity history records uploads and reviews', async () => {
  const studentAgent = await student();
  await upload(studentAgent);
  const document = await Document.findOne();
  const { agent } = await login('mentor');
  await agent.patch(`/api/admin/documents/${document.id}`).send({ status: 'Rejected', comment: 'Add the signature' });
  await upload(studentAgent);

  const { history } = await Document.findOne();
  assert.deepEqual(history.map((entry) => entry.action), ['Uploaded', 'Rejected', 'Replaced']);
  assert.equal(history[1].note, 'Add the signature');
  assert.ok(history[0].at instanceof Date);
});

test('22 file can be previewed in the browser or downloaded', async () => {
  const agent = await student();
  await upload(agent);
  const document = await Document.findOne();
  const preview = await agent.get(`/api/documents/${document.id}/file?view=1`);
  assert.equal(preview.headers['content-disposition'], 'inline');
  const download = await agent.get(`/api/documents/${document.id}/file`);
  assert.match(download.headers['content-disposition'], /^attachment/);
});

test('23 preview is still refused for another student', async () => {
  await upload(await student('S1'));
  const document = await Document.findOne();
  const other = await student('S2');
  assert.equal((await other.get(`/api/documents/${document.id}/file?view=1`)).status, 403);
});

test('24 too many login attempts are blocked', async () => {
  process.env.LOGIN_LIMIT = '1';
  const { response } = await login('mentor', 'wrong-password');
  assert.equal(response.status, 429);
  process.env.LOGIN_LIMIT = '1000';
});
