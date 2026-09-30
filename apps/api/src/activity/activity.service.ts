import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { learningCatalog, type ActivityKind, type ActivityVisit } from '@jack-academy/contracts';
import { DatabaseService } from '../database/database.service';

export async function recordActivity(client: PoolClient, userId: string, kind: ActivityKind, target: string | null, score: number | null = null, correct: boolean | null = null, eventId: string = randomUUID()) {
  const inserted = await client.query(`INSERT INTO user_activity (user_id, kind, target, score, correct, event_id)
    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, event_id) DO NOTHING RETURNING id`, [userId, kind, target, score, correct, eventId]);
  if (inserted.rowCount) await client.query(`UPDATE users SET last_activity_at = now(),
    learning_started_at = CASE WHEN $2 = 'progress_reset' THEN learning_started_at ELSE COALESCE(learning_started_at, now()) END WHERE id = $1`, [userId, kind]);
}

const lessons = new Set<string>(learningCatalog.modules.flatMap(module => module.lessons.map(lesson => lesson.key)));
const cases = new Set<string>(learningCatalog.cases.map(item => item.id));
const simulators = new Set<string>(learningCatalog.simulators.map(item => item.id));

@Injectable()
export class ActivityService {
  constructor(private readonly db: DatabaseService) {}
  async visit(userId: string, visit: ActivityVisit) {
    const valid = visit.kind === 'lesson_opened' ? lessons.has(visit.target) : visit.kind === 'case_opened' ? cases.has(visit.target) : visit.kind === 'simulator_opened' ? simulators.has(visit.target) : visit.target === 'final';
    if (!valid) throw new BadRequestException('Conteúdo não encontrado.');
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      await recordActivity(client, userId, visit.kind, visit.target, null, null, visit.eventId);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
