import { Request, Response } from 'express';
import pool from '../config/database';
import { logAction } from '../utils/auditLogger';

export const handleDriveWebhook = async (req: Request, res: Response) => {
  // 1. Verify the request token
  const token = req.headers['x-goog-channel-token'];
  if (token !== process.env.WEBHOOK_SECRET) {
    return res.status(403).send('Forbidden');
  }

  // 2. Respond immediately to Google
  res.status(200).send();

  // 3. Process asynchronously
  const state = req.headers['x-goog-resource-state'];
  const resourceId = req.headers['x-goog-resource-id'];

  try {
    if (state === 'not_exists') {
      // File deleted directly on Drive
      await pool.query(
        "UPDATE files SET status='deleted', deleted_at=NOW() WHERE google_file_id = $1",
        [resourceId]
      );
      await logAction(null, 'delete_external', 'file', resourceId as string, {
        source: 'google_drive_webhook',
      });
    } else if (state === 'update') {
      // Logic for metadata update could go here (fetch from Google API and sync)
      // For now, just a placeholder as described in Phase 7
      console.log(`Resource updated: ${resourceId}`);
    }

    // Broadcast via WebSocket (if implemented)
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
};
