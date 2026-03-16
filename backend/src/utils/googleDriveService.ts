import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const getDriveService = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth2 credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

export const TARGET_FOLDER_ID = '1MTXX4rnWf7tYsxfyMqSj_-A9x576eDZN';
