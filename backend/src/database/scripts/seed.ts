import bcrypt from 'bcryptjs';
import pool from '../../config/database';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Seeding users...');

    const defaultPassword = await bcrypt.hash('ChangeMe123!', 12);

    const users = [
      { email: 'admin@example.com', name: 'System Admin', role: 'admin' },
      { email: 'manager@example.com', name: 'Dept Manager', role: 'manager' },
      { email: 'user@example.com', name: 'Regular User', role: 'user' },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (email, full_name, role, status, quota_bytes, password_hash)
        VALUES ($1, $2, $3, 'active', 5368709120, $4)
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash
      `, [u.email, u.name, u.role, defaultPassword]);
    }

    // Create a Root Folder if none exists
    console.log('Seeding folders...');
    await client.query(`
      INSERT INTO folders (name, google_folder_id)
      VALUES ('Root Folder', 'root-id-001')
      ON CONFLICT (google_folder_id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
    console.log('Default password for all users: ChangeMe123!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
    process.exit();
  }
}

seed();
