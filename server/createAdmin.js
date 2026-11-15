// Creates the mentor account in the database. Run once: npm run create-admin
import 'dotenv/config';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';

if (!process.env.MONGODB_URI) {
  console.error('Please set MONGODB_URI in your .env file first.');
  process.exit(1);
}

const prompt = createInterface({ input, output });
const systemId = (await prompt.question('Mentor login ID: ')).trim();
const name = (await prompt.question('Mentor name: ')).trim();
const password = await prompt.question('Password (at least 8 characters): ');
prompt.close();

if (!systemId || !name || password.length < 8) {
  console.error('Please enter an ID, a name and a password of at least 8 characters.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
if (await User.exists({ systemId })) {
  console.error('This login ID already exists.');
} else {
  await User.create({ systemId, name, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
  console.log('Mentor account created.');
}
await mongoose.disconnect();
