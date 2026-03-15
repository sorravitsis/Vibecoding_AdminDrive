import { Request, Response } from 'express';
import pool from '../config/database';

export const getActivityStream = async (req: any, res: Response) => {
  const { userId, role } = req.user;

  try {
    let query = '';
    let values: any[] = [];

    if (role === 'admin' || role === 'manager') {
      // Admin and Manager see everything
      query = `
        SELECT 
          u.full_name                    AS actor_name,
          a.action,
          a.target_type,
          a.metadata->>'file_name'       AS file_name,
          a.metadata->>'folder_name'     AS folder_name,
          a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.user_id = a.actor_id
        ORDER BY a.created_at DESC
        LIMIT 50
      `;
    } else {
      // Users see only their own activity
      query = `
        SELECT 
          u.full_name                    AS actor_name,
          a.action,
          a.target_type,
          a.metadata->>'file_name'       AS file_name,
          a.metadata->>'folder_name'     AS folder_name,
          a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.user_id = a.actor_id
        WHERE a.actor_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
      `;
      values = [userId];
    }

    const { rows } = await pool.query(query, values);
    res.json(rows);
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
