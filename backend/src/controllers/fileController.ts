import { Request, Response } from 'express';
import pool from '../config/database.js';
import pathModule from 'path';
import fs from 'fs';
import { logAction } from '../utils/auditLogger.js';
import { getDriveService, TARGET_FOLDER_ID } from '../utils/googleDriveService.js';

async function getGoogleFolderId(dbFolderId: string | null): Promise<string> {
  if (!dbFolderId) return TARGET_FOLDER_ID;
  const { rows } = await pool.query('SELECT google_folder_id FROM folders WHERE folder_id = $1', [dbFolderId]);
  return rows[0]?.google_folder_id || TARGET_FOLDER_ID;
}

// PRD Fix 5: Race condition safe unique name
async function getUniqueName(client: any, folderId: string | null, fileName: string): Promise<string> {
  const ext = pathModule.extname(fileName);
  const base = pathModule.basename(fileName, ext);
  let name = fileName;
  let i = 1;
  while (true) {
    const { rows } = await client.query(
      "SELECT 1 FROM files WHERE folder_id IS NOT DISTINCT FROM $1 AND file_name = $2 AND status = 'active'",
      [folderId, name]
    );
    if (rows.length === 0) return name;
    name = `${base}(${i++})${ext}`;
  }
}

export const uploadFile = async (req: any, res: Response) => {
  const userId = req.user.userId;
  const file = req.file;
  const folderId = req.body.folderId && req.body.folderId !== 'null' && req.body.folderId !== '' ? req.body.folderId : null;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (folderId) {
      await client.query('SELECT folder_id FROM folders WHERE folder_id = $1 FOR UPDATE', [folderId]);
    }

    const safeName = await getUniqueName(client, folderId, file.originalname);
    const drive = getDriveService();
    const googleParentId = await getGoogleFolderId(folderId);

    const driveRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: safeName, parents: [googleParentId] },
      media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
    });

    const googleFileId = driveRes.data.id;

    const userRes = await client.query('SELECT quota_bytes, used_bytes FROM users WHERE user_id = $1', [userId]);
    const user = userRes.rows[0];
    if (BigInt(user.used_bytes) + BigInt(file.size) > BigInt(user.quota_bytes)) throw new Error('Quota exceeded');

    const dbRes = await client.query(
      `INSERT INTO files (google_file_id, folder_id, uploader_id, file_name, file_size, mime_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [googleFileId, folderId, userId, safeName, file.size, file.mimetype]
    );
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
      supportsAllDrives: true,
      requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [googleParentId] },
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
  const { folderId, search } = req.query;
  const { userId, role } = req.user;

  try {
    const fId = (folderId === '' || folderId === 'null' || !folderId) ? null : folderId;

    // Search filter
    const searchFilter = search ? `AND name ILIKE $` : '';
    const searchFilterFile = search ? `AND f.file_name ILIKE $` : '';

    let folderParams: any[] = [fId];
    let fileParams: any[] = [fId];

    let folderQuery = `SELECT folder_id, google_folder_id, name, created_at, 'folder' as type
       FROM folders WHERE status = 'active'
       AND (parent_id IS NOT DISTINCT FROM $1)`;

    if (search) {
      folderParams.push(`%${search}%`);
      folderQuery += ` AND name ILIKE $2`;
    }

    const foldersRes = await pool.query(folderQuery, folderParams);

    let filesRes;
    if (role === 'admin' || role === 'manager') {
      let q = `SELECT file_id, google_file_id, file_name as name, file_size, mime_type, created_at, uploader_id, 'file' as type
         FROM files WHERE status = 'active'
         AND (folder_id IS NOT DISTINCT FROM $1)`;
      if (search) {
        fileParams.push(`%${search}%`);
        q += ` AND file_name ILIKE $2`;
      }
      filesRes = await pool.query(q, fileParams);
    } else {
      let q = `SELECT DISTINCT f.file_id, f.google_file_id, f.file_name as name, f.file_size, f.mime_type, f.created_at, f.uploader_id, 'file' as type
         FROM files f LEFT JOIN permissions p ON p.file_id = f.file_id
         WHERE f.status = 'active'
         AND (f.folder_id IS NOT DISTINCT FROM $1)
         AND (f.uploader_id = $2 OR (p.user_id = $2 AND p.access_level IN ('view', 'edit'))
              OR EXISTS (SELECT 1 FROM permissions fp WHERE fp.folder_id = f.folder_id AND fp.user_id = $2))`;
      fileParams.push(userId);
      if (search) {
        fileParams.push(`%${search}%`);
        q += ` AND f.file_name ILIKE $3`;
      }
      filesRes = await pool.query(q, fileParams);
    }

    res.json([...foldersRes.rows, ...filesRes.rows]);
  } catch (err: any) {
    console.error('List files error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const listDeletedFiles = async (req: any, res: Response) => {
  const { userId, role } = req.user;

  try {
    let query;
    let values: any[] = [];

    if (role === 'admin' || role === 'manager') {
      query = `SELECT f.file_id, f.file_name as name, f.file_size, f.deleted_at,
               u.full_name as deleted_by_name FROM files f
               LEFT JOIN users u ON u.user_id = f.deleted_by
               WHERE f.status = 'deleted' ORDER BY f.deleted_at DESC LIMIT 50`;
    } else {
      query = `SELECT f.file_id, f.file_name as name, f.file_size, f.deleted_at,
               u.full_name as deleted_by_name FROM files f
               LEFT JOIN users u ON u.user_id = f.deleted_by
               WHERE f.status = 'deleted' AND f.uploader_id = $1
               ORDER BY f.deleted_at DESC LIMIT 50`;
      values = [userId];
    }

    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err: any) {
    console.error('List deleted files error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const downloadFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;

  try {
    const fileRes = await pool.query(
      "SELECT google_file_id, file_name, mime_type, uploader_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];

    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      const permRes = await pool.query("SELECT 1 FROM permissions WHERE file_id = $1 AND user_id = $2", [fileId, userId]);
      if (permRes.rows.length === 0) return res.status(403).json({ error: 'Permission denied' });
    }

    const drive = getDriveService();
    const driveRes = await drive.files.get(
      { fileId: file.google_file_id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-cache');
    (driveRes.data as any).pipe(res);

    await logAction(userId, 'download', 'file', fileId, { file_name: file.file_name });
  } catch (err: any) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const previewFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;

  try {
    const fileRes = await pool.query(
      "SELECT google_file_id, file_name, mime_type, uploader_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];

    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      const permRes = await pool.query("SELECT 1 FROM permissions WHERE file_id = $1 AND user_id = $2", [fileId, userId]);
      if (permRes.rows.length === 0) return res.status(403).json({ error: 'Permission denied' });
    }

    const drive = getDriveService();
    const driveRes = await drive.files.get(
      { fileId: file.google_file_id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min cache for previews
    (driveRes.data as any).pipe(res);
  } catch (err: any) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const renameFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { newName } = req.body;
  const { userId, role } = req.user;

  if (!newName) return res.status(400).json({ error: 'New name is required' });

  try {
    const fileRes = await pool.query(
      "SELECT file_id, file_name, google_file_id, uploader_id, folder_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const drive = getDriveService();
      await drive.files.update({ fileId: file.google_file_id, supportsAllDrives: true, requestBody: { name: newName } });
    } catch (driveErr) {
      console.error('Google Drive rename error:', driveErr);
    }

    await pool.query("UPDATE files SET file_name = $1, updated_at = NOW() WHERE file_id = $2", [newName, fileId]);
    await logAction(userId, 'rename', 'file', fileId, { old_name: file.file_name, new_name: newName });

    res.json({ message: 'File renamed', newName });
  } catch (err: any) {
    console.error('Rename file error:', err);
    res.status(400).json({ error: err.message });
  }
};

export const renameFolder = async (req: any, res: Response) => {
  const { folderId } = req.params;
  const { newName } = req.body;
  const { userId, role } = req.user;

  if (!newName) return res.status(400).json({ error: 'New name is required' });

  try {
    const folderRes = await pool.query(
      "SELECT folder_id, name, google_folder_id, owner_id FROM folders WHERE folder_id = $1 AND status = 'active'",
      [folderId]
    );
    if (folderRes.rows.length === 0) return res.status(404).json({ error: 'Folder not found' });

    const folder = folderRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && folder.owner_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const drive = getDriveService();
      await drive.files.update({ fileId: folder.google_folder_id, supportsAllDrives: true, requestBody: { name: newName } });
    } catch (driveErr) {
      console.error('Google Drive rename folder error:', driveErr);
    }

    await pool.query("UPDATE folders SET name = $1, updated_at = NOW() WHERE folder_id = $2", [newName, folderId]);
    await logAction(userId, 'rename', 'folder', folderId, { old_name: folder.name, new_name: newName });

    res.json({ message: 'Folder renamed', newName });
  } catch (err: any) {
    console.error('Rename folder error:', err);
    res.status(400).json({ error: err.message });
  }
};

export const deleteFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fileRes = await client.query(
      "SELECT file_size, uploader_id, file_name, google_file_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) throw new Error('File not found');

    const file = fileRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      throw new Error('Permission denied');
    }

    try {
      const drive = getDriveService();
      await drive.files.update({ fileId: file.google_file_id, supportsAllDrives: true, requestBody: { trashed: true } });
    } catch (driveErr) {
      console.error('Google Drive trash error (continuing):', driveErr);
    }

    await client.query("UPDATE files SET status = 'deleted', deleted_at = NOW(), deleted_by = $1 WHERE file_id = $2", [userId, fileId]);
    await client.query('UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1), updated_at = NOW() WHERE user_id = $2', [file.file_size, file.uploader_id]);
    await logAction(userId, 'delete', 'file', fileId, { file_name: file.file_name });

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

// Cascade delete: folder + all sub-folders + all files inside
export const deleteFolder = async (req: any, res: Response) => {
  const { folderId } = req.params;
  const { userId, role } = req.user;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const folderRes = await client.query(
      "SELECT folder_id, name, owner_id, google_folder_id FROM folders WHERE folder_id = $1 AND status = 'active'",
      [folderId]
    );
    if (folderRes.rows.length === 0) throw new Error('Folder not found');

    const folder = folderRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && folder.owner_id !== userId) {
      throw new Error('Permission denied');
    }

    // Find all descendant folders recursively
    const descendantsRes = await client.query(`
      WITH RECURSIVE folder_tree AS (
        SELECT folder_id FROM folders WHERE folder_id = $1
        UNION ALL
        SELECT f.folder_id FROM folders f
        JOIN folder_tree ft ON f.parent_id = ft.folder_id
        WHERE f.status = 'active'
      )
      SELECT folder_id FROM folder_tree
    `, [folderId]);

    const allFolderIds = descendantsRes.rows.map((r: any) => r.folder_id);

    // Soft-delete all files in those folders + update used_bytes
    const filesRes = await client.query(`
      UPDATE files SET status = 'deleted', deleted_at = NOW(), deleted_by = $1
      WHERE folder_id = ANY($2) AND status = 'active'
      RETURNING file_size, uploader_id, file_id, file_name
    `, [userId, allFolderIds]);

    for (const file of filesRes.rows) {
      await client.query(
        'UPDATE users SET used_bytes = GREATEST(0, used_bytes - $1) WHERE user_id = $2',
        [file.file_size, file.uploader_id]
      );
    }

    // Soft-delete all folders
    await client.query(`
      UPDATE folders SET status = 'deleted', deleted_at = NOW(), deleted_by = $1
      WHERE folder_id = ANY($2) AND status = 'active'
    `, [userId, allFolderIds]);

    // Trash on Google Drive (Drive cascades automatically)
    try {
      const drive = getDriveService();
      await drive.files.update({ fileId: folder.google_folder_id, supportsAllDrives: true, requestBody: { trashed: true } });
    } catch (driveErr) {
      console.error('Drive trash error:', driveErr);
    }

    await logAction(userId, 'delete', 'folder', folderId, {
      folder_name: folder.name,
      files_deleted: filesRes.rows.length,
      subfolders_deleted: allFolderIds.length - 1
    });

    await client.query('COMMIT');
    res.json({ message: 'Folder and contents moved to recycle bin' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Delete folder error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const restoreFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fileRes = await client.query(
      "SELECT file_size, uploader_id, file_name, google_file_id FROM files WHERE file_id = $1 AND status = 'deleted'",
      [fileId]
    );
    if (fileRes.rows.length === 0) throw new Error('File not found');

    const file = fileRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      throw new Error('Permission denied');
    }

    try {
      const drive = getDriveService();
      await drive.files.update({ fileId: file.google_file_id, supportsAllDrives: true, requestBody: { trashed: false } });
    } catch (driveErr) {
      console.error('Google Drive untrash error (continuing):', driveErr);
    }

    await client.query("UPDATE files SET status = 'active', deleted_at = NULL, deleted_by = NULL WHERE file_id = $1", [fileId]);
    await client.query('UPDATE users SET used_bytes = used_bytes + $1, updated_at = NOW() WHERE user_id = $2', [file.file_size, file.uploader_id]);
    await logAction(userId, 'restore', 'file', fileId, { file_name: file.file_name });

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

export const shareFile = async (req: any, res: Response) => {
  const { fileId } = req.params;
  const { email, accessLevel } = req.body;
  const { userId, role } = req.user;

  try {
    const fileRes = await pool.query(
      "SELECT file_id, file_name, uploader_id, google_file_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const userRes = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUserId = userRes.rows[0].user_id;

    await pool.query(
      `INSERT INTO permissions (file_id, user_id, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (file_id, user_id) WHERE file_id IS NOT NULL
       DO UPDATE SET access_level = $3`,
      [fileId, targetUserId, accessLevel || 'view']
    );

    try {
      const drive = getDriveService();
      await drive.permissions.create({
        fileId: file.google_file_id,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: accessLevel === 'edit' ? 'writer' : 'reader', emailAddress: email },
      });
    } catch (driveErr) {
      console.error('Google Drive share error (continuing):', driveErr);
    }

    await logAction(userId, 'share', 'file', fileId, { file_name: file.file_name, shared_with: email, access_level: accessLevel });
    res.json({ message: `Shared with ${email}` });
  } catch (err: any) {
    console.error('Share error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Cascade share: folder + all files inside sub-folders
export const shareFolder = async (req: any, res: Response) => {
  const { folderId } = req.params;
  const { email, accessLevel } = req.body;
  const { userId, role } = req.user;

  try {
    const folderRes = await pool.query(
      "SELECT folder_id, name, owner_id, google_folder_id FROM folders WHERE folder_id = $1 AND status = 'active'",
      [folderId]
    );
    if (folderRes.rows.length === 0) return res.status(404).json({ error: 'Folder not found' });

    const folder = folderRes.rows[0];
    if (role !== 'admin' && role !== 'manager' && folder.owner_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const userRes = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUserId = userRes.rows[0].user_id;

    // Share the folder itself
    await pool.query(
      `INSERT INTO permissions (folder_id, user_id, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (folder_id, user_id) WHERE folder_id IS NOT NULL
       DO UPDATE SET access_level = $3`,
      [folderId, targetUserId, accessLevel || 'view']
    );

    // Cascade to all files in this folder and sub-folders
    const descendantsRes = await pool.query(`
      WITH RECURSIVE folder_tree AS (
        SELECT folder_id FROM folders WHERE folder_id = $1
        UNION ALL
        SELECT f.folder_id FROM folders f
        JOIN folder_tree ft ON f.parent_id = ft.folder_id
        WHERE f.status = 'active'
      )
      SELECT folder_id FROM folder_tree
    `, [folderId]);

    const allFolderIds = descendantsRes.rows.map((r: any) => r.folder_id);

    await pool.query(`
      INSERT INTO permissions (file_id, user_id, access_level)
      SELECT f.file_id, $1, $2
      FROM files f WHERE f.folder_id = ANY($3) AND f.status = 'active'
      ON CONFLICT (file_id, user_id) WHERE file_id IS NOT NULL
      DO UPDATE SET access_level = $2
    `, [targetUserId, accessLevel || 'view', allFolderIds]);

    try {
      const drive = getDriveService();
      await drive.permissions.create({
        fileId: folder.google_folder_id,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: accessLevel === 'edit' ? 'writer' : 'reader', emailAddress: email },
      });
    } catch (driveErr) {
      console.error('Google Drive share folder error (continuing):', driveErr);
    }

    await logAction(userId, 'share', 'folder', folderId, { folder_name: folder.name, shared_with: email, access_level: accessLevel, files_shared: allFolderIds.length });
    res.json({ message: `Folder shared with ${email}` });
  } catch (err: any) {
    console.error('Share folder error:', err);
    res.status(400).json({ error: err.message });
  }
};
