import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthProvider, User } from '@jack-academy/contracts';
import { DatabaseService } from '../database/database.service';
import { AppConfig } from '../config';

const userColumns = 'id, name, email, avatar_url AS "avatarUrl", provider, (welcome_completed_at IS NOT NULL) AS "welcomeCompleted"';
type UserRow = Omit<User, 'isAdmin'>;

export interface ProviderIdentity {
  provider: AuthProvider;
  subject: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService, private readonly config: AppConfig) {}

  private account(row: UserRow): User {
    return { ...row, isAdmin: !!row.email && this.config.adminEmails.has(row.email.trim().toLowerCase()) };
  }

  async find(id: string): Promise<User | null> {
    const result = await this.db.pool.query<UserRow>(`SELECT ${userColumns} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ? this.account(result.rows[0]) : null;
  }

  async upsert(identity: ProviderIdentity): Promise<User> {
    // Never merge accounts based on a provider's email address.
    const result = await this.db.pool.query<UserRow>(`
      INSERT INTO users (id, provider, provider_subject, name, email, avatar_url, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (provider, provider_subject) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, updated_at = now(), last_login_at = now()
      RETURNING ${userColumns}
    `, [randomUUID(), identity.provider, identity.subject, identity.name, identity.email, identity.avatarUrl]);
    return this.account(result.rows[0]);
  }

  async completeWelcome(id: string): Promise<User> {
    const result = await this.db.pool.query<UserRow>(`
      UPDATE users SET welcome_completed_at = COALESCE(welcome_completed_at, now())
      WHERE id = $1 RETURNING ${userColumns}
    `, [id]);
    if (!result.rows[0]) throw new UnauthorizedException('Entre novamente para continuar.');
    return this.account(result.rows[0]);
  }

  async deleteAccount(id: string): Promise<void> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      // Progress, certificates and activity belong to this user and cascade in the same transaction.
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
