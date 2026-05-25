import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import complaintRoutes from './routes/complaints.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config({ path: '../.env.example' }); // use correct path if env is expected

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/complaints', complaintRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', dbState: mongoose.connection.readyState }));

if (isProd) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

async function startServer() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('No MONGODB_URI provided. Please configure it in your environment variables. The server will start, but database operations will fail.');
    app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT} (No Database)`));
    return;
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));

  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
    });
}

startServer();
