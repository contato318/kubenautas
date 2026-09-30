import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Certificate, Progress } from '@jack-academy/contracts';
import { DatabaseService } from '../database/database.service';
import { AppConfig } from '../config';
import { recordActivity } from '../activity/activity.service';

const columns = 'id, full_name AS "fullName", exam_score AS "examScore", issued_at AS "issuedAt"';
type CertificateRow = Omit<Certificate, 'issuedAt' | 'verificationUrl'> & { issuedAt: Date };

@Injectable()
export class CertificatesService {
  constructor(private readonly db: DatabaseService, private readonly config: AppConfig) {}

  private document(row: CertificateRow): Certificate {
    return {
      id: row.id,
      fullName: row.fullName,
      examScore: row.examScore,
      issuedAt: row.issuedAt.toISOString(),
      verificationUrl: `${this.config.frontendUrl}/certificados/${row.id}`,
    };
  }

  async get(userId: string): Promise<Certificate | null> {
    const result = await this.db.pool.query<CertificateRow>(`SELECT ${columns} FROM certificates WHERE user_id = $1`, [userId]);
    return result.rows[0] ? this.document(result.rows[0]) : null;
  }

  async verify(id: string): Promise<Certificate> {
    const result = await this.db.pool.query<CertificateRow>(`SELECT ${columns} FROM certificates WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Certificado não encontrado.');
    return this.document(result.rows[0]);
  }

  async issue(userId: string, fullName: string): Promise<Certificate> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize issuance with score updates and reset for this account.
      const progress = await client.query<{ data: Progress }>('SELECT data FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId]);
      const existing = await client.query<CertificateRow>(`SELECT ${columns} FROM certificates WHERE user_id = $1`, [userId]);
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return this.document(existing.rows[0]);
      }
      const score = progress.rows[0]?.data.examBest;
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0.7 || score > 1) {
        throw new ForbiddenException('Conclua a prova final com pelo menos 70% de acertos para emitir seu certificado.');
      }
      const result = await client.query<CertificateRow>(
        `INSERT INTO certificates (id, user_id, full_name, exam_score) VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
        [randomUUID(), userId, fullName, score],
      );
      await recordActivity(client, userId, 'certificate_issued', result.rows[0].id, score);
      await client.query('COMMIT');
      return this.document(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
