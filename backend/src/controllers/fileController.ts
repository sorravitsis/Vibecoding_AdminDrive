import { Request, Response } from 'express';
import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { logAction } from '../utils/auditLogger.js';
import { getDriveService, TARGET_FOLDER_ID } from '../utils/googleDriveService.js';

// Helper: get Google Drive folder ID from DB folder ID
async function getGoogleFolderId(dbFolderId: string | null): Promise<string> {
  if (!dbFolderId) return TARGET_FOLDER_ID;
  const { rows } = await pool.query('SELECT google_folder_id FROM folders WHERE folder_id = $1', [dbFolderId]);
  return rows[0]?.google_folder_id || TARGET_FOLDER_ID;
}

export const uploadFile = async (req: any, res: Response) => {
  const userId = req.user.userId;
  const file = req.file;
  const folderId = req.body.folderId && req.body.folderId !== 'null' && req.body.folderId !== '' ? req.body.folderId : null;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const drive = getDriveService();
    const googleParentId = await getGoogleFolderId(folderId);

    const driveRes = await drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: [googleParentId],
      },
      media: {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
      },
    });

    const googleFileId = driveRes.data.id;
    const userRes = await client.query('SELECT quota_bytes, used_bytes FROM users WHERE user_id = $1', [userId]);
    const user = userRes.rows[0];
    if (BigInt(user.used_bytes) + BigInt(file.size) > BigInt(user.quota_bytes)) throw new Error('Quota exceeded');

    const insertFileQuery = `
      INSERT INTO files (google_file_id, folder_id, uploader_id, file_name, file_size, mime_type, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING *
    `;
    const dbRes = await client.query(insertFileQuery, [googleFileId, folderId, userId, file.originalname, file.size, file.mimetype]);
    const newFile = dbRes.rows[0];

    await client.query('UPDATE users SET used_bytes = used_bytes + $1, updated_at = NOW() WHERE user_id = $2', [file.size, userId]);
    await logAction(userId, 'upload', 'file', newFile.file_id, { file_name: newFile.file_name });

    await client.query('COMMIT');
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(201).json(newFile);
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('Upload error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const createFolder = async (req: any, res: Response) => {
  const { folderName, parentId } = req.body;
  const userId = req.user.userId;
  const pId = parentId && parentId !== 'null' && parentId !== '' ? parentId : null;

  try {
    const drive = getDriveService();
    const googleParentId = await getGoogleFolderId(pId);

    const driveRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [googleParentId]
      },
    });

    const googleFolderId = driveRes.data.id;
    const { rows } = await pool.query(
      "INSERT INTO folders (google_folder_id, name, parent_id, owner_id, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *",
      [googleFolderId, folderName, pId, userId]
    );

    await logAction(userId, 'create', 'folder', rows[0].folder_id, { folder_name: folderName });
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error('Create folder error:', err);
    res.status(400).json({ error: err.message });
  }
};

export const listFiles = async (req: any, res: Response) => {
  const { folderId } = req.query;
  const { userId, role } = req.user;

  try {
    const fId = (folderId === '' || folderId === 'null' || !folderId) ? null : folderId;

    const foldersRes = await pool.query(
      `SELECT folder_id, google_folder_id, name, created_at, 'folder' as type
       FROM folders
       WHERE status = 'active'
       AND (parent_id = $1 OR ($1 IS NULL AND parent_id IS NULL))`,
      [fId]
    );

    let filesRes;
    if (role === 'admin' || role === 'manager') {
      filesRes = await pool.query(
        `SELECT file_id, file_name as name, file_size, mime_type, created_at, 'file' as type
         FROM files
         WHERE status = 'active'
         AND (folder_id = $1 OR ($1 IS NULL AND folder_id IS NULL))`,
        [fId]
      );
    } else {
      filesRes = await pool.query(
        `SELECT f.file_id, f.file_name as name, f.file_size, f.mime_type, f.created_at, 'file' as type
         FROM files f
         LEFT JOIN permissions p ON p.file_id = f.file_id
         WHERE f.status = 'active'
         AND (f.folder_id = $1 OR ($1 IS NULL AND f.folder_id IS NULL))
         AND (f.uploader_id = $2 OR (p.user_id = $2 AND p.access_level IN ('view', 'edit')))`,
        [fId, userId]
      );
    }

    res.json([...foldersRes.rows, ...filesRes.rows]);
  } catch (err: any) {
    console.error('List files error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fileRes = await client.query("SELECT file_size, uploader_id, file_name FROM files WHERE file_id = $1 AND status = 'active'", [fileId]);
    if (fileRes.rows.length === 0) throw new Error('File not found');

    if (role !== 'admin' && role !== 'manager' && fileRes.rows[0].uploader_id !== userId) {
      throw new Error('Permission denied');
    }

    await client.query("UPDATE files SET status = 'deleted', deleted_at = NOW(), deleted_by = $1 WHERE file_id = $2", [userId, fileId]);
    await client.query('UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1), updated_at = NOW() WHERE user_id = $2', [fileRes.rows[0].file_size, fileRes.rows[0].uploader_id]);

    await logAction(userId, 'delete', 'file', fileId, { file_name: fileRes.rows[0].file_name });
    await client.query('COMMIT');
    res.json({ message: 'Moved to recycle bin' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Delete file error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const deleteFolder = async (req: any, res: Response) => {
  const { folderId } = req.params;
  const { userId, role } = req.user;

  try {
    const folderRes = await pool.query("SELECT folder_id, name, owner_id FROM folders WHERE folder_id = $1 AND status = 'active'", [folderId]);
    if (folderRes.rows.length === 0) throw new Error('Folder not found');

    if (role !== 'admin' && role !== 'manager' && folderRes.rows[0].owner_id !== userId) {
      throw new Error('Permission denied');
    }

    await pool.query("UPDATE folders SET status = 'deleted', deleted_at = NOW(), deleted_by = $1 WHERE folder_id = $2", [userId, folderId]);

    await logAction(userId, 'delete', 'folder', folderId, { folder_name: folderRes.rows[0].name });
    res.json({ message: 'Folder moved to recycle bin' });
  } catch (err: any) {
    console.error('Delete folder error:', err);
    res.status(400).json({ error: err.message });
  }
};

export const restoreFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fileRes = await client.query("SELECT file_size, uploader_id, file_name FROM files WHERE file_id = $1 AND status = 'deleted'", [fileId]);
    if (fileRes.rows.length === 0) throw new Error('File not found');

    if (role !== 'admin' && role !== 'manager' && fileRes.rows[0].uploader_id !== userId) {
      throw new Error('Permission denied');
    }

    await client.query("UPDATE files SET status = 'active', deleted_at = NULL, deleted_by = NULL WHERE file_id = $1", [fileId]);
    await client.query('UPDATE users SET used_bytes = used_bytes + $1, updated_at = NOW() WHERE user_id = $2', [fileRes.rows[0].file_size, fileRes.rows[0].uploader_id]);

    await logAction(userId, 'restore', 'file', fileId, { file_name: fileRes.rows[0].file_name });
    await client.query('COMMIT');
    res.json({ message: 'Restored successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Restore error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};
