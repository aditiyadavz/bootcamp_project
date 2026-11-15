// Shared test helpers. Tests use a temporary in-memory database, never the real one.
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import Batch from '../models/Batch.js';
import Comment from '../models/Comment.js';
import Document from '../models/Document.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

export const PASSWORD = 'test-pass-123';
export const PDF = Buffer.from('%PDF-1.4 test file');
let database;

export async function startDatabase() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.LOGIN_LIMIT = '10000';
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
}

export async function stopDatabase() {
  await mongoose.disconnect();
  await database.stop();
}

export async function clearDatabase() {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([User, Batch, Document, Comment, Notification, AuditLog].map((model) => model.syncIndexes()));
}

const hash = bcrypt.hashSync(PASSWORD, 4);

export function createUser(systemId, role = 'student', extra = {}) {
  return User.create({ systemId, name: `${role} ${systemId}`, passwordHash: hash, role, ...extra });
}

export async function loginAs(app, systemId) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ systemId, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login failed for ${systemId}: ${response.status}`);
  return agent;
}

export const upload = (agent, type = 'report', content = PDF, filename = 'report.pdf') =>
  agent.post(`/api/documents/${type}`).attach('file', content, { filename, contentType: 'application/pdf' });

// Reads a file download as raw bytes.
export const asBuffer = (res, done) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};
