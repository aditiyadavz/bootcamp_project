// Starts the real application: connect to MongoDB Atlas, then start the web server and real-time updates.
import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { attachRealtime } from './lib/realtime.js';

const { MONGODB_URI, JWT_SECRET, PORT = 5000 } = process.env;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Please set MONGODB_URI and JWT_SECRET (see .env.example).');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB');

const server = http.createServer(createApp());
attachRealtime(server);
server.listen(PORT, () => console.log(`Portal running on port ${PORT}`));
