import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

export async function authMiddleware(req: any, res: Response, next: NextFunction) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token missing' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // Check current token_version from database
    const { rows } = await pool.query(
      'SELECT token_version, status FROM users WHERE user_id = $1',
      [payload.userId]
    );

    const user = rows[0];

    // Check 2 conditions:
    // 1. User status is not suspended
    if (!user || user.status === 'suspended') {
      return res.status(401).json({ error: 'Account suspended' });
    }

    // 2. Token version matches current database version
    if (user.token_version !== payload.tokenVersion) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}
