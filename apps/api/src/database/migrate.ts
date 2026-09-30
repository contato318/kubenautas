import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from './migrations';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { await migrate(pool); console.log('Database migrations applied'); }
  finally { await pool.end(); }
}
void main().catch(() => { console.error('Database migration failed'); process.exitCode = 1; });
