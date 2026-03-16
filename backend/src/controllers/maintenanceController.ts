import { Request, Response } from 'express';
import pool from '../config/database';
import { logAction } from '../utils/auditLogger';
import { getDriveService } from '../utils/googleDriveService';

// Recalculate used_bytes for all users from actual active files
export const reconcileQuotas = async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query(`
      WITH actual AS (
        SELECT uploader_id, COALESCE(SUM(file_size), 0) AS total
        FROM files WHERE status = 'active'
        GROUP BY uploader_id
      )
      UPDATE users u
      SET used_bytes = COALESCE(a.total, 0), updated_at = NOW()
      FROM (
        SELECT user_id, 0 AS total FROM users
        EXCEPT
        SELECT uploader_id, 0 FROM actual
        UNION ALL
        SELECT uploader_id, total FROM actual
      ) a
      WHERE u.user_id = a.user_id AND u.used_bytes != a.total
      RETURNING u.user_id, u.email, u.used_bytes
    `);

    await logAction(req.user.userId, 'reconcile_quotas', 'user', 'system', {
      users_updated: result.rowCount,
    });

    res.json({
      message: 'Quota reconciliation complete',
      usersUpdated: result.rowCount,
      details: result.rows,
    });
  } catch (err) {
    console.error('Quota reconciliation error:', err);
    res.status(500).json({ error: 'Reconciliation failed' });
  }
};

// Find and clean up orphaned files (in DB but not in Drive, or in Drive but not in DB)
export const cleanupOrphanedFiles = async (req: any, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const dryRun = req.query.dryRun !== 'false'; // default to dry run for safety

  try {
    const drive = getDriveService();
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1MTXX4rnWf7tYsxfyMqSj_-A9x576eDZN';

    // Get all active files from DB
    const dbResult = await pool.query(
      "SELECT file_id, google_file_id, file_name FROM files WHERE status = 'active'"
    );
    const dbFiles = new Map(dbResult.rows.map(f => [f.google_file_id, f]));

    // List files in Google Drive folder
    const driveFiles = new Map<string, string>();
    let pageToken: string | undefined;
    do {
      const list = await drive.files.list({
        q: `'${parentFolderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
      });
      for (const f of list.data.files || []) {
        if (f.id) driveFiles.set(f.id, f.name || 'unknown');
      }
      pageToken = list.data.nextPageToken || undefined;
    } while (pageToken);

    // Find orphans: in DB but not in Drive
    const dbOrphans = [];
    for (const [googleId, file] of dbFiles) {
      if (!driveFiles.has(googleId)) {
        dbOrphans.push({ fileId: file.file_id, googleFileId: googleId, fileName: file.file_name });
      }
    }

    // Find orphans: in Drive but not in DB
    const driveOrphans = [];
    for (const [driveId, name] of driveFiles) {
      if (!dbFiles.has(driveId)) {
        driveOrphans.push({ googleFileId: driveId, fileName: name });
      }
    }

    let cleanedDb = 0;
    let cleanedDrive = 0;

    if (!dryRun) {
      // Soft-delete DB records whose Drive files are gone
      for (const orphan of dbOrphans) {
        await pool.query(
          "UPDATE files SET status = 'deleted', deleted_at = NOW() WHERE file_id = $1",
          [orphan.fileId]
        );
        cleanedDb++;
      }

      // Trash Drive files that have no DB record
      for (const orphan of driveOrphans) {
        try {
          await drive.files.update({
            fileId: orphan.googleFileId,
            requestBody: { trashed: true },
            supportsAllDrives: true,
          });
          cleanedDrive++;
        } catch (e) {
          console.error(`Failed to trash Drive file ${orphan.googleFileId}:`, e);
        }
      }

      await logAction(req.user.userId, 'cleanup_orphans', 'file', 'system', {
        db_orphans_cleaned: cleanedDb,
        drive_orphans_cleaned: cleanedDrive,
      });
    }

    res.json({
      dryRun,
      dbOrphans: { count: dbOrphans.length, files: dbOrphans, cleaned: cleanedDb },
      driveOrphans: { count: driveOrphans.length, files: driveOrphans, cleaned: cleanedDrive },
    });
  } catch (err) {
    console.error('Orphan cleanup error:', err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
};
