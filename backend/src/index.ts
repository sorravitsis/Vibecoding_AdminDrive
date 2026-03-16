import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import {
  uploadFile,
  deleteFile,
  deleteFolder,
  restoreFile,
  listFiles,
  listDeletedFiles,
  createFolder,
  downloadFile,
  shareFile,
  shareFolder,
  renameFile,
  renameFolder
} from './controllers/fileController.js';
import { getActivityStream, getUserActivity } from './controllers/auditController.js';
import { suspendUser, activateUser, getStorageStats, getMyStorage, createUser } from './controllers/userController.js';
import { handleDriveWebhook } from './controllers/webhookController.js';
import { login, loginValidation } from './controllers/authController.js';

dotenv.config();

const app = express();

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: os.tmpdir() });
const PORT = process.env.PORT || 3000;

// Auth routes
app.post('/auth/login', authLimiter, loginValidation, login);

// Webhook endpoint
app.post('/webhooks/drive', handleDriveWebhook);

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Protected routes
app.use(authMiddleware);

// File routes
app.get('/files', listFiles);
app.get('/files/deleted', listDeletedFiles);
app.post('/files/upload', upload.single('file'), uploadFile);
app.post('/files/folders', createFolder);
app.get('/files/:fileId/download', downloadFile);
app.post('/files/:fileId/share', shareFile);
app.put('/files/:fileId/rename', renameFile);
app.post('/files/folders/:folderId/share', shareFolder);
app.put('/files/folders/:folderId/rename', renameFolder);
app.delete('/files/folders/:folderId', deleteFolder);
app.delete('/files/:fileId', deleteFile);
app.post('/files/:fileId/restore', restoreFile);

// Audit routes
app.get('/activity', getActivityStream);
app.get('/activity/user/:userId', getUserActivity);

// User routes (any authenticated user)
app.get('/me/storage', getMyStorage);

// Admin routes
app.post('/admin/users', createUser);
app.put('/admin/users/:userId/suspend', suspendUser);
app.put('/admin/users/:userId/activate', activateUser);
app.get('/admin/storage-stats', getStorageStats);

// Auto migrate and seed on startup
async function startup() {
  try {
    const { default: pool } = await import('./config/database.js');
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Run migrations
    const migrationsDir = path.join(__dirname, 'database/migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    const client = await pool.connect();
    console.log('Running migrations...');
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
      }
    }
    console.log('Migrations completed!');

    // Seed default users if none exist
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding users...');
      const bcrypt = await import('bcryptjs');
      const defaultPassword = await bcrypt.hash('ChangeMe123!', 12);
      const users = [
        { email: 'admin@example.com', name: 'System Admin', role: 'admin' },
        { email: 'manager@example.com', name: 'Dept Manager', role: 'manager' },
        { email: 'user@example.com', name: 'Regular User', role: 'user' },
      ];
      for (const u of users) {
        await client.query(
          `INSERT INTO users (email, full_name, role, status, quota_bytes, password_hash)
           VALUES ($1, $2, $3, 'active', 5368709120, $4)
           ON CONFLICT (email) DO NOTHING`,
          [u.email, u.name, u.role, defaultPassword]
        );
      }
      console.log('Seed completed! Default password: ChangeMe123!');
    }
    client.release();
  } catch (err) {
    console.error('Startup error:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startup();
