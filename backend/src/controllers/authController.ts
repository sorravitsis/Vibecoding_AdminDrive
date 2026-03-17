import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { logAction } from '../utils/auditLogger';

const TOKEN_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1 }),
];

export const login = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not configured');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const { email, password } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT user_id, email, full_name, role, token_version, status, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = rows[0];

    if (!user || !user.password_hash) {
      // Log failed attempt — unknown email
      await logAction(null, 'login_failed', 'user', 'unknown', {
        email,
        reason: 'invalid_email',
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      await logAction(user.user_id, 'login_failed', 'user', user.user_id, {
        email,
        reason: 'account_suspended',
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Account is suspended' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      // Log failed attempt — wrong password
      await logAction(user.user_id, 'login_failed', 'user', user.user_id, {
        email,
        reason: 'invalid_password',
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tokenVersion: user.token_version,
      },
      JWT_SECRET,
      { expiresIn: `${TOKEN_MAX_AGE}s` }
    );

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: TOKEN_MAX_AGE * 1000,
      path: '/',
    });

    // Log successful login
    await logAction(user.user_id, 'login', 'user', user.user_id, {
      email,
      ip: req.ip,
    });

    res.json({
      token, // fallback for cross-origin where cookies may be blocked
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out' });
};

export const getProfile = async (req: any, res: Response) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      'SELECT user_id, email, full_name, role, used_bytes, quota_bytes, created_at FROM users WHERE user_id = $1',
      [userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const changePassword = async (req: any, res: Response) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If password_hash exists, verify current password
    if (user.password_hash) {
      const valid = await bcrypt.compare(currentPassword || '', user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [hash, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
