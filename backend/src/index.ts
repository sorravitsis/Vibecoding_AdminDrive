import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
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
import { login } from './controllers/authController.js';

dotenv.config();

const app = express();
app.use(express.json());

const upload = multer({ dest: os.tmpdir() });

const PORT = process.env.PORT || 3000;

// Auth routes (No auth required)
app.post('/auth/login', login);

// Webhook endpoint (doesn't use authMiddleware)
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
