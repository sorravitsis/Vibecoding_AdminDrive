import { Request, Response } from 'express';
import pool from '../config/database';

export const suspendUser = async (req: any, res: Response) => {
  const { userId } = req.params;
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const query = `
      UPDATE users SET
        status = 'suspended',
        token_version = token_version + 1,
        updated_at = NOW()
      WHERE user_id = $1
    `;
    await pool.query(query, [userId]);
    res.json({ message: 'User suspended and sessions invalidated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const activateUser = async (req: any, res: Response) => {
  const { userId } = req.params;
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const query = `
      UPDATE users SET
        status = 'active',
        updated_at = NOW()
      WHERE user_id = $1
    `;
    await pool.query(query, [userId]);
    res.json({ message: 'User activated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getStorageStats = async (req: any, res: Response) => {
  const { role } = req.user;

  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }

  try {
    const query = `
      SELECT
        user_id,
        email,
        full_name,
        status,
        role,
        used_bytes,
        quota_bytes,
        ROUND(used_bytes * 100.0 / quota_bytes, 1) AS pct
      FROM users
      ORDER BY full_name
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyStorage = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    const query = `
      SELECT used_bytes, quota_bytes,
        ROUND(used_bytes * 100.0 / quota_bytes, 1) AS pct
      FROM users WHERE user_id = $1
    `;
    const { rows } = await pool.query(query, [userId]);
    res.json(rows[0] || { used_bytes: '0', quota_bytes: '5368709120', pct: '0' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
