import { Request, Response } from 'express';
import pool from '../config/database';
import { logAction } from '../utils/auditLogger';
import { getDriveService } from '../utils/googleDriveService';

export const handleDriveWebhook = async (req: Request, res: Response) => {
  const token = req.headers['x-goog-channel-token'];
  if (token !== process.env.WEBHOOK_SECRET) {
    return res.status(403).send('Forbidden');
  }

  res.status(200).send();

  const state = req.headers['x-goog-resource-state'] as string;
  const resourceId = req.headers['x-goog-resource-id'] as string;

  try {
    if (state === 'not_exists') {
      // File deleted directly on Drive
      const fileRes = await pool.query(
        "UPDATE files SET status='deleted', deleted_at=NOW() WHERE google_file_id = $1 AND status = 'active' RETURNING file_id, file_name, uploader_id, file_size",
        [resourceId]
      );
      if (fileRes.rows.length > 0) {
        const file = fileRes.rows[0];
        await pool.query('UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1), updated_at = NOW() WHERE user_id = $2', [file.file_size, file.uploader_id]);
        await logAction(null, 'delete_external', 'file', file.file_id, { file_name: file.file_name, source: 'google_drive_webhook' });
      }
      // Also check folders
      await pool.query("UPDATE folders SET status='deleted', deleted_at=NOW() WHERE google_folder_id = $1 AND status = 'active'", [resourceId]);

    } else if (state === 'update') {
      // File metadata changed — sync from Google Drive
      try {
        const drive = getDriveService();
        const meta = await drive.files.get({
          fileId: resourceId,
          fields: 'name,size,modifiedTime',
          supportsAllDrives: true,
        });

        if (meta.data.name || meta.data.size) {
          await pool.query(
            `UPDATE files SET
              file_name = COALESCE($1, file_name),
              file_size = COALESCE($2, file_size),
              updated_at = NOW()
            WHERE google_file_id = $3`,
            [meta.data.name, meta.data.size ? parseInt(meta.data.size) : null, resourceId]
          );
        }
      } catch (driveErr) {
        console.error('Webhook: failed to fetch file metadata:', driveErr);
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
};
