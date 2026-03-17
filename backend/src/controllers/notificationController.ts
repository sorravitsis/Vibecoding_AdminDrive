import { Request, Response } from 'express';
import pool from '../config/database';

export const getNotifications = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT notification_id, type, title, message, is_read, metadata, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req: any, res: Response) => {
  const { userId } = req.user;
  const { notificationId } = req.params;

  try {
    const { rowCount } = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE notification_id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err: any) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAllAsRead = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getUnreadCount = async (req: any, res: Response) => {
  const { userId } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err: any) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: err.message });
  }
};
