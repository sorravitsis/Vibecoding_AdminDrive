import { Request, Response } from 'express';
import pool from '../config/database';

export const suspendUser = async (req: any, res: Response) => {
  const { userId } = req.params;
  const { role } = req.user;

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Phase 4: Suspend + Invalidate (increment token_version)
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
    // Phase 6: O(1) storage stats
    const query = `
      SELECT 
        full_name, 
        used_bytes, 
        quota_bytes, 
        ROUND(used_bytes * 100.0 / quota_bytes, 1) AS pct
      FROM users
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
