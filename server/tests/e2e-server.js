// A server for browser tests only. It uses a temporary in-memory database filled with test data,
// so tests never touch the real MongoDB Atlas database. Start with: npm run test:server
import crypto from 'node:crypto';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { attachRealtime } from '../lib/realtime.js';
import { seed } from './fixtures.js';

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.CRON_SECRET = 'e2e-cron-secret';
process.env.LOGIN_LIMIT = '10000';

const database = await MongoMemoryServer.create();
await mongoose.connect(database.getUri());
await seed();

const port = Number(process.env.PORT || 5100);
const server = http.createServer(createApp());
attachRealtime(server);
server.listen(port, () => console.log(`Test server with temporary data on http://localhost:${port}`));
