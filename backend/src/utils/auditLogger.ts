import pool from '../config/database';

export async function logAction(
  actorId: string | null,
  action: string,
  targetType: 'file' | 'folder',
  targetId: string,
  metadata: any = {}
) {
  const query = `
    INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES ($1, $2, $3, $4, $5)
  `;
  const values = [actorId, action, targetType, targetId, JSON.stringify(metadata)];

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Failed to log action:', error);
    // Optional: Throw or handle failure
  }
}
