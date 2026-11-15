// Builds the Express application: security settings, API routes and the React site.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import multer from 'multer';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';

const clientBuild = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render places the app behind one proxy.
  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());

  // The cloud host calls this address to check that the app is healthy.
  app.get('/api/health', (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({ databaseConnected });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

  // Serve the built React website. Any other address loads the React app.
  app.use(express.static(clientBuild));
  app.get(/.*/, (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));

  // Turn unexpected problems into a clear message.
  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'That file is larger than 5 MB.' });
    }
    console.error(error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  });

  return app;
}
