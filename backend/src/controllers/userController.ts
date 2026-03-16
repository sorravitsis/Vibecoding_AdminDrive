import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { logAction } from '../utils/auditLogger.js';
import { validatePassword } from '../utils/passwordPolicy.js';

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
      RETURNING email, full_name
    `;
    const result = await pool.query(query, [userId]);
    await logAction(req.user.userId, 'suspend', 'user', userId, { target_email: result.rows[0]?.email });
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
      RETURNING email, full_name
    `;
    const result = await pool.query(query, [userId]);
    await logAction(req.user.userId, 'activate', 'user', userId, { target_email: result.rows[0]?.email });
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

export const createUser = async (req: any, res: Response) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { email, fullName, password, userRole } = req.body;
  if (!email || !fullName || !password) {
    return res.status(400).json({ error: 'email, fullName, and password are required' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

  const allowedRoles = ['user', 'manager', 'admin'];
  const finalRole = allowedRoles.includes(userRole) ? userRole : 'user';

  try {
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, full_name, role, status, quota_bytes, used_bytes, password_hash)
       VALUES ($1, $2, $3, 'active', 5368709120, 0, $4)
       RETURNING user_id, email, full_name, role, status`,
      [email.toLowerCase().trim(), fullName.trim(), finalRole, passwordHash]
    );
    await logAction(req.user.userId, 'create_user', 'user', result.rows[0].user_id, { email, role: finalRole });
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req: any, res: Response) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId } = req.params;
  const { email, fullName, userRole, quotaBytes } = req.body;

  const allowedRoles = ['user', 'manager', 'admin'];
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (email) { sets.push(`email = $${idx++}`); vals.push(email.toLowerCase().trim()); }
  if (fullName) { sets.push(`full_name = $${idx++}`); vals.push(fullName.trim()); }
  if (userRole && allowedRoles.includes(userRole)) { sets.push(`role = $${idx++}`); vals.push(userRole); }
  if (quotaBytes && parseInt(quotaBytes) > 0) { sets.push(`quota_bytes = $${idx++}`); vals.push(parseInt(quotaBytes)); }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  sets.push(`updated_at = NOW()`);
  vals.push(userId);

  try {
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${idx} RETURNING user_id, email, full_name, role, status, quota_bytes`,
      vals
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAction(req.user.userId, 'update_user', 'user', userId, { changes: req.body });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req: any, res: Response) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId } = req.params;
  const { newPassword } = req.body;

  const pwCheck = validatePassword(newPassword || '');
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, email`,
      [passwordHash, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAction(req.user.userId, 'reset_password', 'user', userId, { target_email: result.rows[0].email });
    res.json({ message: 'Password reset successfully. All sessions invalidated.' });
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
