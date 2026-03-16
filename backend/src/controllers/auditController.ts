import { Request, Response } from 'express';
import pool from '../config/database';

export const getActivityStream = async (req: any, res: Response) => {
  const { userId, role } = req.user;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  try {
    const isAdmin = role === 'admin' || role === 'manager';
    const whereClause = isAdmin ? '' : 'WHERE a.actor_id = $1';
    const params = isAdmin ? [] : [userId];

    const countQuery = `SELECT COUNT(*) FROM audit_logs a ${whereClause}`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count);

    const dataQuery = `
      SELECT
        u.full_name AS actor_name,
        a.action,
        a.target_type,
        a.metadata->>'file_name' AS file_name,
        a.metadata->>'folder_name' AS folder_name,
        a.metadata->>'target_email' AS target_email,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.user_id = a.actor_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows } = await pool.query(dataQuery, [...params, limit, offset]);
    res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserActivity = async (req: any, res: Response) => {
  const { userId } = req.params;
  try {
    const query = `
      SELECT * FROM audit_logs
      WHERE actor_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const { rows } = await pool.query(query, [userId]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
