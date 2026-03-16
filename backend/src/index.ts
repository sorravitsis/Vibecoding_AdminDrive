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
  restoreFile,
  listFiles,
  createFolder
} from './controllers/fileController.js';
import { getActivityStream, getUserActivity } from './controllers/auditController.js';
import { suspendUser, activateUser, getStorageStats } from './controllers/userController.js';
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

// Protected routes
app.use(authMiddleware);

// File routes
app.get('/files', listFiles);
app.post('/files/upload', upload.single('file'), uploadFile);
app.post('/files/folders', createFolder);
app.delete('/files/:fileId', deleteFile);
app.post('/files/:fileId/restore', restoreFile);

// Audit routes
app.get('/activity', getActivityStream);
app.get('/activity/user/:userId', getUserActivity);

// User/Admin routes
app.put('/admin/users/:userId/suspend', suspendUser);
app.put('/admin/users/:userId/activate', activateUser);
app.get('/admin/storage-stats', getStorageStats);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
