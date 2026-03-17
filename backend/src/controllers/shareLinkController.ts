import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { logAction } from '../utils/auditLogger.js';
import { getDriveService } from '../utils/googleDriveService.js';

// ─── Create Share Link ───────────────────────────────────────────────────────

export const createShareLink = async (req: any, res: Response) => {
  const { userId } = req.user;
  const { fileId, expiresIn, password, maxDownloads } = req.body;

  if (!fileId) return res.status(400).json({ error: 'fileId is required' });

  try {
    // Verify file exists and user has access
    const fileRes = await pool.query(
      "SELECT file_id, file_name, uploader_id FROM files WHERE file_id = $1 AND status = 'active'",
      [fileId]
    );
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];
    const { role } = req.user;
    if (role !== 'admin' && role !== 'manager' && file.uploader_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;

    const { rows } = await pool.query(
      `INSERT INTO share_links (file_id, created_by, token, password_hash, expires_at, max_downloads)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [fileId, userId, token, passwordHash, expiresAt, maxDownloads || null]
    );

    await logAction(userId, 'create_share_link', 'file', fileId, {
      file_name: file.file_name,
      has_password: !!password,
      expires_in_hours: expiresIn || null,
    });

    res.status(201).json({ ...rows[0], token });
  } catch (err: any) {
    console.error('Create share link error:', err);
    res.status(400).json({ error: err.message });
  }
};

// ─── Get Share Links ─────────────────────────────────────────────────────────

export const getShareLinks = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT sl.*, f.file_name
       FROM share_links sl
       LEFT JOIN files f ON sl.file_id = f.file_id
       WHERE sl.created_by = $1 AND sl.is_active = true
       ORDER BY sl.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Get share links error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Delete Share Link ───────────────────────────────────────────────────────

export const deleteShareLink = async (req: any, res: Response) => {
  const { linkId } = req.params;
  const { userId, role } = req.user;

  try {
    const linkRes = await pool.query(
      'SELECT link_id, created_by FROM share_links WHERE link_id = $1 AND is_active = true',
      [linkId]
    );
    if (linkRes.rows.length === 0) return res.status(404).json({ error: 'Share link not found' });

    const link = linkRes.rows[0];
    if (role !== 'admin' && link.created_by !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.query('UPDATE share_links SET is_active = false WHERE link_id = $1', [linkId]);
    await logAction(userId, 'delete_share_link', 'file', linkId, {});

    res.json({ message: 'Share link deactivated' });
  } catch (err: any) {
    console.error('Delete share link error:', err);
    res.status(400).json({ error: err.message });
  }
};

// ─── Access Share Link (Public) ──────────────────────────────────────────────

export const accessShareLink = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.query;

  try {
    const linkRes = await pool.query(
      `SELECT sl.*, f.file_name, f.file_size, f.mime_type, f.google_file_id
       FROM share_links sl
       LEFT JOIN files f ON sl.file_id = f.file_id
       WHERE sl.token = $1 AND sl.is_active = true`,
      [token]
    );
    if (linkRes.rows.length === 0) return res.status(404).json({ error: 'Share link not found or inactive' });

    const link = linkRes.rows[0];

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Check max downloads
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      return res.status(410).json({ error: 'Download limit reached' });
    }

    // Check password
    if (link.password_hash) {
      if (!password) return res.status(401).json({ error: 'Password required', password_required: true });
      const valid = await bcrypt.compare(String(password), link.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid password' });
    }

    // Increment download count
    await pool.query(
      'UPDATE share_links SET download_count = download_count + 1 WHERE link_id = $1',
      [link.link_id]
    );

    res.json({
      file_name: link.file_name,
      file_size: link.file_size,
      mime_type: link.mime_type,
      access_type: link.access_type,
    });
  } catch (err: any) {
    console.error('Access share link error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Download Shared File (Public) ───────────────────────────────────────────

export const downloadSharedFile = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.query;

  try {
    const linkRes = await pool.query(
      `SELECT sl.*, f.file_name, f.file_size, f.mime_type, f.google_file_id
       FROM share_links sl
       LEFT JOIN files f ON sl.file_id = f.file_id
       WHERE sl.token = $1 AND sl.is_active = true`,
      [token]
    );
    if (linkRes.rows.length === 0) return res.status(404).json({ error: 'Share link not found or inactive' });

    const link = linkRes.rows[0];

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Check max downloads
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      return res.status(410).json({ error: 'Download limit reached' });
    }

    // Check password
    if (link.password_hash) {
      if (!password) return res.status(401).json({ error: 'Password required', password_required: true });
      const valid = await bcrypt.compare(String(password), link.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid password' });
    }

    // Stream file from Google Drive
    const drive = getDriveService();
    const driveRes = await drive.files.get(
      { fileId: link.google_file_id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    // Increment download count
    await pool.query(
      'UPDATE share_links SET download_count = download_count + 1 WHERE link_id = $1',
      [link.link_id]
    );

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(link.file_name)}"`);
    res.setHeader('Content-Type', link.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-cache');
    (driveRes.data as any).pipe(res);
  } catch (err: any) {
    console.error('Download shared file error:', err);
    res.status(500).json({ error: err.message });
  }
};
