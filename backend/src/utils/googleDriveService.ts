import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace with your Service Account JSON Key path or use env variables
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export const getDriveService = () => {
  // Option 1: Using a JSON Key file (Recommended)
  // Ensure you have service-account.json in backend/src/config/
  const KEY_FILE_PATH = path.join(__dirname, '../config/service-account.json');
  
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });

  return google.drive({ version: 'v3', auth });
};

// Target Folder ID from your request
export const TARGET_FOLDER_ID = '1MTXX4rnWf7tYsxfyMqSj_-A9x576eDZN';
