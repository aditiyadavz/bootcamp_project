// Real-time tests: a review must reach the student's open page through Socket.IO.
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { io as connect } from 'socket.io-client';
import { createApp } from '../app.js';
import { attachRealtime, closeRealtime } from '../lib/realtime.js';
import Document from '../models/Document.js';
import { clearDatabase, createUser, loginAs, startDatabase, stopDatabase, upload } from './helpers.js';

let server;
let url;

before(async () => {
  await startDatabase();
  server = http.createServer(createApp());
  attachRealtime(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

after(async () => {
  closeRealtime();
  await new Promise((resolve) => server.close(resolve));
  await stopDatabase();
});

const cookieOf = async (agent) => (await agent.get('/api/auth/me')).request.cookies;

test('a connection without a login is refused', async () => {
  const socket = connect(url, { transports: ['websocket'], reconnection: false });
  const error = await new Promise((resolve) => socket.on('connect_error', resolve));
  assert.equal(error.message, 'Please log in.');
  socket.close();
});

test('the student receives the mentor\'s decision instantly', async () => {
  await clearDatabase();
  const mentor = await createUser('mentor1', 'mentor');
  await createUser('STU1', 'student', { mentor: mentor._id });
  const studentAgent = await loginAs(createApp(), 'STU1');
  await upload(studentAgent);
  const document = await Document.findOne();

  const socket = connect(url, { transports: ['websocket'], extraHeaders: { cookie: await cookieOf(studentAgent) }, reconnection: false });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  const received = new Promise((resolve) => socket.on('notification', resolve));

  const mentorAgent = await loginAs(createApp(), 'mentor1');
  await mentorAgent.patch(`/api/mentor/documents/${document.id}`).send({ status: 'Rejected', comment: 'Add the signature' });

  const notification = await received;
  assert.match(notification.text, /Final Project Report was rejected/);
  socket.close();
});
