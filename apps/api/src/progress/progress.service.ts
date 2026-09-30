import { Injectable } from '@nestjs/common';
import type { ActivityKind, Progress } from '@jack-academy/contracts';
import { DatabaseService } from '../database/database.service';
import { recordActivity } from '../activity/activity.service';

export const emptyProgress = (): Progress => ({ quizzes: {}, completed: {}, cases: {} });

@Injectable()
export class ProgressService {
  constructor(private readonly db: DatabaseService) {}

  async get(userId: string): Promise<Progress> {
    const result = await this.db.pool.query<{ data: Progress }>('SELECT data FROM user_progress WHERE user_id = $1', [userId]);
    return result.rows[0]?.data ?? emptyProgress();
  }

  quiz(userId: string, key: string, score: number, eventId?: string) {
    return this.update(userId, (progress) => {
      progress.quizzes[key] = Math.max(progress.quizzes[key] ?? 0, score);
      if (score >= 0.7 && !progress.completed[key]) progress.completed[key] = new Date().toISOString();
    }, { kind: 'quiz_submitted', target: key, score, eventId });
  }

  exam(userId: string, score: number, eventId?: string) {
    return this.update(userId, (progress) => { progress.examBest = Math.max(progress.examBest ?? 0, score); }, { kind: 'exam_submitted', target: 'final', score, eventId });
  }

  case(userId: string, slug: string, correct: boolean, eventId?: string) {
    return this.update(userId, (progress) => {
      progress.cases ??= {};
      if (!Object.hasOwn(progress.cases, slug)) progress.cases[slug] = { at: new Date().toISOString(), correct };
    }, { kind: 'case_answered', target: slug, correct, eventId });
  }

  reset(userId: string) { return this.update(userId, () => emptyProgress(), { kind: 'progress_reset', target: null }); }

  private async update(userId: string, mutate: (progress: Progress) => void | Progress, activity: { kind: ActivityKind; target: string | null; score?: number; correct?: boolean; eventId?: string }) {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO user_progress (user_id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, emptyProgress()]);
      const result = await client.query<{ data: Progress }>('SELECT data FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId]);
      const progress = result.rows[0].data;
      const next = mutate(progress) ?? progress;
      await client.query('UPDATE user_progress SET data = $2, updated_at = now() WHERE user_id = $1', [userId, next]);
      await recordActivity(client, userId, activity.kind, activity.target, activity.score ?? null, activity.correct ?? null, activity.eventId);
      await client.query('COMMIT');
      return next;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
