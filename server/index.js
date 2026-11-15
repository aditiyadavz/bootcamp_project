// Starts the real application: connect to MongoDB Atlas, then start the web server.
import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const { MONGODB_URI, JWT_SECRET, PORT = 5000 } = process.env;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Please set MONGODB_URI and JWT_SECRET (see .env.example).');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
createApp().listen(PORT, () => console.log(`Portal running on port ${PORT}`));
