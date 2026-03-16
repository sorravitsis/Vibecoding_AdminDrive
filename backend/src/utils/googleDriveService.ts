import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const getDriveService = () => {
  let auth;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    const KEY_FILE_PATH = path.join(__dirname, '../config/service-account.json');
    auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });
  }

  return google.drive({ version: 'v3', auth });
};

export const TARGET_FOLDER_ID = '1MTXX4rnWf7tYsxfyMqSj_-A9x576eDZN';
