import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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
  previewFile,
  shareFile,
  shareFolder,
  renameFile,
  renameFolder,
  getSharedWithMe,
  moveFile,
  moveFolder,
  getStarredFiles,
  starFile,
  unstarFile,
  starFolder,
  unstarFolder,
  copyFile,
  getFileInfo,
  downloadFolder,
  restoreFolder,
  permanentDeleteFile,
  emptyRecycleBin,
  globalSearch,
} from './controllers/fileController.js';
import {
  createShareLink,
  getShareLinks,
  deleteShareLink,
  accessShareLink,
  downloadSharedFile,
} from './controllers/shareLinkController.js';
import { getActivityStream, getUserActivity } from './controllers/auditController.js';
import { suspendUser, activateUser, getStorageStats, getMyStorage, createUser, updateUser, resetPassword } from './controllers/userController.js';
import { handleDriveWebhook } from './controllers/webhookController.js';
import { login, loginValidation, logout, register, getProfile, changePassword } from './controllers/authController.js';
import { reconcileQuotas, cleanupOrphanedFiles } from './controllers/maintenanceController.js';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from './controllers/notificationController.js';
import { getDashboardStats } from './controllers/dashboardController.js';

dotenv.config();

const app = express();

// Gzip compression
app.use(compression());

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Cookie parser
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const fileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: os.tmpdir() });
const PORT = process.env.PORT || 3000;

// Auth routes
app.post('/auth/login', authLimiter, loginValidation, login);
app.post('/auth/register', authLimiter, register);
app.post('/auth/logout', logout);

// Webhook endpoint
app.post('/webhooks/drive', handleDriveWebhook);

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Public share link routes (no auth required)
app.get('/share/:token', accessShareLink);
app.get('/share/:token/download', downloadSharedFile);

// Protected routes
app.use(authMiddleware);

// Auth profile routes
app.get('/auth/profile', getProfile);
app.put('/auth/password', changePassword);

// Notification routes (static before param)
app.get('/notifications', getNotifications);
app.get('/notifications/unread-count', getUnreadCount);
app.put('/notifications/mark-all-read', markAllAsRead);
app.put('/notifications/:notificationId/read', markAsRead);

// Dashboard
app.get('/dashboard/stats', getDashboardStats);

// Share link routes (protected)
app.post('/share-links', createShareLink);
app.get('/share-links', getShareLinks);
app.delete('/share-links/:linkId', deleteShareLink);

// ── Static file routes MUST come before /:fileId param routes ─────────────────
app.get('/files', listFiles);
app.get('/files/search', globalSearch);
app.get('/files/deleted', listDeletedFiles);
app.get('/files/shared-with-me', getSharedWithMe);
app.get('/files/starred', getStarredFiles);
app.delete('/files/recycle-bin/empty', emptyRecycleBin);
app.post('/files/upload', fileLimiter, upload.single('file'), uploadFile);
app.post('/files/folders', fileLimiter, createFolder);

// ── File param routes ─────────────────────────────────────────────────────────
app.get('/files/:fileId/download', downloadFile);
app.get('/files/:fileId/preview', previewFile);
app.get('/files/:fileId/info', getFileInfo);
app.post('/files/:fileId/share', shareFile);
app.put('/files/:fileId/rename', renameFile);
app.post('/files/:fileId/star', starFile);
app.delete('/files/:fileId/star', unstarFile);
app.post('/files/:fileId/copy', copyFile);
app.put('/files/:fileId/move', moveFile);
app.delete('/files/:fileId/permanent', permanentDeleteFile);
app.delete('/files/:fileId', fileLimiter, deleteFile);
app.post('/files/:fileId/restore', restoreFile);

// ── Folder param routes ───────────────────────────────────────────────────────
app.get('/files/folders/:folderId/download', downloadFolder);
app.post('/files/folders/:folderId/restore', restoreFolder);
app.post('/files/folders/:folderId/share', shareFolder);
app.put('/files/folders/:folderId/rename', renameFolder);
app.put('/files/folders/:folderId/move', moveFolder);
app.post('/files/folders/:folderId/star', starFolder);
app.delete('/files/folders/:folderId/star', unstarFolder);
app.delete('/files/folders/:folderId', fileLimiter, deleteFolder);

// Audit routes
app.get('/activity', getActivityStream);
app.get('/activity/user/:userId', getUserActivity);

// User routes (any authenticated user)
app.get('/me/storage', getMyStorage);

// Admin routes
app.post('/admin/users', createUser);
app.put('/admin/users/:userId/suspend', suspendUser);
app.put('/admin/users/:userId/activate', activateUser);
app.put('/admin/users/:userId/reset-password', resetPassword);
app.put('/admin/users/:userId', updateUser);
app.get('/admin/storage-stats', getStorageStats);

// Maintenance routes (admin only)
app.post('/admin/maintenance/reconcile-quotas', reconcileQuotas);
app.post('/admin/maintenance/cleanup-orphans', cleanupOrphanedFiles);

// Auto migrate and seed on startup
async function startup() {
  try {
    const { default: pool } = await import('./config/database.js');
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Run migrations with tracking (each migration runs only once)
    const migrationsDir = path.join(__dirname, 'database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();
    const client = await pool.connect();

    // Create migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.map((r: any) => r.name));

    console.log('Running migrations...');
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) continue;
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        console.log(`  Applied: ${file}`);
      } catch (err: any) {
        console.error(`  Migration ${file} failed:`, err.message);
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      try {
        const { default: pool } = await import('./config/database.js');
        await pool.end();
        console.log('Database pool closed.');
      } catch (e) { /* ignore */ }
      process.exit(0);
    });
    setTimeout(() => { console.error('Forced shutdown'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startup();
