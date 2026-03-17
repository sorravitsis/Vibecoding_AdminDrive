import { Request, Response } from 'express';
import pool from '../config/database';

export const getDashboardStats = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    // Storage info for current user
    const storageRes = await pool.query(
      `SELECT used_bytes, quota_bytes,
        ROUND(used_bytes * 100.0 / NULLIF(quota_bytes, 0), 1) AS pct
       FROM users WHERE user_id = $1`,
      [userId]
    );
    const storage = storageRes.rows[0] || { used_bytes: '0', quota_bytes: '5368709120', pct: '0' };

    // File counts
    const countsRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM files WHERE status = 'active') AS total_files,
        (SELECT COUNT(*) FROM folders WHERE status = 'active') AS total_folders,
        (SELECT COUNT(*) FROM files WHERE status = 'deleted') AS deleted_files
    `);
    const file_counts = {
      total_files: parseInt(countsRes.rows[0].total_files),
      total_folders: parseInt(countsRes.rows[0].total_folders),
      deleted_files: parseInt(countsRes.rows[0].deleted_files),
    };

    // File type breakdown
    const typeRes = await pool.query(`
      SELECT
        CASE
          WHEN mime_type LIKE 'image/%' THEN 'image'
          WHEN mime_type LIKE 'video/%' THEN 'video'
          WHEN mime_type LIKE 'audio/%' THEN 'audio'
          WHEN mime_type LIKE 'application/pdf'
            OR mime_type LIKE 'application/msword'
            OR mime_type LIKE 'application/vnd.openxmlformats%'
            OR mime_type LIKE 'application/vnd.ms-%'
            OR mime_type LIKE 'text/%' THEN 'document'
          ELSE 'other'
        END AS mime_category,
        COUNT(*) AS count,
        COALESCE(SUM(file_size), 0) AS total_size
      FROM files
      WHERE status = 'active'
      GROUP BY mime_category
      ORDER BY count DESC
    `);
    const file_type_breakdown = typeRes.rows.map((r: any) => ({
      mime_category: r.mime_category,
      count: parseInt(r.count),
      total_size: r.total_size,
    }));

    // Recent files (last 10)
    const recentFilesRes = await pool.query(`
      SELECT file_name AS name, file_size AS size, created_at AS date, mime_type AS type
      FROM files
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Recent activity (last 10 audit log entries)
    const recentActivityRes = await pool.query(`
      SELECT u.full_name AS actor_name, a.action, a.target_type,
             a.metadata->>'file_name' AS file_name,
             a.metadata->>'folder_name' AS folder_name,
             a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.user_id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    res.json({
      storage: {
        used_bytes: storage.used_bytes,
        quota_bytes: storage.quota_bytes,
        pct: parseFloat(storage.pct) || 0,
      },
      file_counts,
      file_type_breakdown,
      recent_files: recentFilesRes.rows,
      recent_activity: recentActivityRes.rows,
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: err.message });
  }
};
