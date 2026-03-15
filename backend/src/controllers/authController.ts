import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // 1. Find user (In real app, verify password with bcrypt)
    const { rows } = await pool.query(
      'SELECT user_id, email, full_name, role, token_version, status FROM users WHERE email = $1',
      [email]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    // 2. Generate JWT (Phase 4: include tokenVersion)
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tokenVersion: user.token_version,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
