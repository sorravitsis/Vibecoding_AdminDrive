import pool from '../config/database';

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: any = {}
) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
