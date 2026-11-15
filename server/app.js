// Builds the Express application: security settings, logging, API routes, API docs and the React site.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import { MAX_FILE_MB } from './config.js';
import { openapi } from './openapi.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import documentRoutes from './routes/documents.js';
import mentorRoutes from './routes/mentor.js';
import notificationRoutes from './routes/notifications.js';
import reminderRoutes from './routes/reminders.js';

const clientBuild = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
const startedAt = new Date();

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render places the app behind one proxy.
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Request log: method, address, result and time taken. Render shows these in its Logs tab.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  // Render and uptime monitors call this to check the app is healthy.
  app.get('/api/health', (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({
      status: databaseConnected ? 'ok' : 'error',
      databaseConnected,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt,
    });
  });

  app.get('/api/openapi.json', (req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Portal API docs' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/mentor', mentorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

  // Serve the built React website. Any other address loads the React app.
  app.use(express.static(clientBuild));
  app.get(/.*/, (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));

  // Turn unexpected problems into a clear message.
  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `That file is larger than ${MAX_FILE_MB} MB.` });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request was not valid JSON.' });
    console.error(error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  });

  return app;
}
