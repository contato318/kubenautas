import { Injectable, NotFoundException } from '@nestjs/common';
import { learningCatalog, type AdminActivityResponse, type AdminOverview, type AdminUserDetail, type AdminUsersResponse } from '@jack-academy/contracts';
import { DatabaseService } from '../database/database.service';
import { CertificatesService } from '../certificates/certificates.service';
import { emptyProgress } from '../progress/progress.service';
import { AdminUsersDto, PaginationDto } from './admin.dto';

const lessonKeys = learningCatalog.modules.flatMap(module => module.lessons.map(lesson => lesson.key));
const caseKeys = learningCatalog.cases.map(item => item.id);
const catalog = [lessonKeys, caseKeys];
const trackingSince = `(SELECT applied_at FROM schema_migrations WHERE name = '004_admin_activity.sql')`;

// Count only the current catalog: unknown or removed lesson keys cannot complete a course.
const students = `WITH students AS (
  SELECT u.id, u.name, u.email, u.provider, u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
    GREATEST(u.last_activity_at, p.updated_at, c.issued_at) AS "lastActivityAt",
    u.welcome_completed_at IS NOT NULL AS "welcomeCompleted",
    (u.learning_started_at IS NOT NULL OR totals.attempted > 0 OR totals.done > 0 OR totals.cases > 0 OR p.data ? 'examBest' OR c.id IS NOT NULL) IS TRUE AS started,
    totals.done = cardinality($1::text[]) AND cardinality($1::text[]) > 0 AS completed,
    totals.done AS "completedLessons", totals.attempted AS "attemptedLessons", totals.cases AS "answeredCases",
    (p.data->>'examBest')::double precision AS "examBest", c.id AS "certificateId", c.issued_at AS "certificateIssuedAt"
  FROM users u LEFT JOIN user_progress p ON p.user_id = u.id LEFT JOIN certificates c ON c.user_id = u.id
  CROSS JOIN LATERAL (
    SELECT (SELECT count(*)::int FROM unnest($1::text[]) k WHERE p.data->'completed' ? k) AS done,
      (SELECT count(*)::int FROM unnest($1::text[]) k WHERE p.data->'quizzes' ? k) AS attempted,
      (SELECT count(*)::int FROM unnest($2::text[]) k WHERE p.data->'cases' ? k) AS cases
  ) totals
)`;

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService, private readonly certificates: CertificatesService) {}

  async overview(): Promise<AdminOverview> {
    const result = await this.db.pool.query<{ overview: AdminOverview }>(`${students}
      SELECT jsonb_build_object(
        'registered', count(*)::int, 'started', count(*) FILTER (WHERE started)::int,
        'completed', count(*) FILTER (WHERE completed)::int, 'certified', count(*) FILTER (WHERE "certificateId" IS NOT NULL)::int,
        'examPassed', count(*) FILTER (WHERE "examBest" >= 0.7)::int, 'totalLessons', cardinality($1::text[]),
        'trackingSince', ${trackingSince},
        'registrations', (SELECT jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', total) ORDER BY day)
          FROM (SELECT day, count(u.id)::int AS total
            FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 29, (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') day
            LEFT JOIN users u ON (u.created_at AT TIME ZONE 'America/Sao_Paulo')::date = day::date GROUP BY day) daily)
      ) AS overview FROM students`, catalog);
    return result.rows[0].overview;
  }

  async users(query: AdminUsersDto): Promise<AdminUsersResponse> {
    const search = query.q.replace(/[\\%_]/g, '\\$&');
    const result = await this.db.pool.query<{ data: AdminUsersResponse }>(`${students}, filtered AS (
      SELECT * FROM students WHERE ($3 = 'all' OR ($3 = 'not_started' AND NOT started) OR ($3 = 'started' AND started)
        OR ($3 = 'completed' AND completed) OR ($3 = 'certified' AND "certificateId" IS NOT NULL))
        AND ($4 = '' OR name ILIKE '%' || $4 || '%' OR COALESCE(email, '') ILIKE '%' || $4 || '%')
    ) SELECT jsonb_build_object('total', (SELECT count(*)::int FROM filtered), 'page', $5::int, 'pageSize', $6::int,
      'totalLessons', cardinality($1::text[]),
      'users', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY "createdAt" DESC, id) FROM
        (SELECT * FROM filtered ORDER BY "createdAt" DESC, id LIMIT $6 OFFSET (($5 - 1) * $6)) paged), '[]'::jsonb)) AS data`,
    [...catalog, query.stage, search, query.page, query.pageSize]);
    return result.rows[0].data;
  }

  async user(id: string): Promise<AdminUserDetail> {
    const result = await this.db.pool.query<{ data: Omit<AdminUserDetail, 'certificate'> }>(`${students}
      SELECT jsonb_build_object('user', to_jsonb(s), 'progress', COALESCE(p.data, $4::jsonb),
        'totalLessons', cardinality($1::text[]), 'trackingSince', ${trackingSince},
        'visits', (SELECT jsonb_build_object(
          'lessons', count(DISTINCT target) FILTER (WHERE kind = 'lesson_opened')::int,
          'simulators', count(DISTINCT target) FILTER (WHERE kind = 'simulator_opened')::int,
          'cases', count(DISTINCT target) FILTER (WHERE kind = 'case_opened')::int
        ) FROM user_activity WHERE user_id = s.id)) AS data
      FROM students s LEFT JOIN user_progress p ON p.user_id = s.id WHERE s.id = $3::uuid`, [...catalog, id, emptyProgress()]);
    if (!result.rows[0]) throw new NotFoundException('Usuário não encontrado.');
    return { ...result.rows[0].data, certificate: await this.certificates.get(id) };
  }

  async activity(id: string, query: PaginationDto): Promise<AdminActivityResponse> {
    if (!(await this.db.pool.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount) throw new NotFoundException('Usuário não encontrado.');
    const result = await this.db.pool.query<{ data: AdminActivityResponse }>(`SELECT jsonb_build_object(
      'total', (SELECT count(*)::int FROM user_activity WHERE user_id = $1), 'page', $2::int, 'pageSize', $3::int,
      'events', COALESCE((SELECT jsonb_agg(to_jsonb(paged) - 'sort_id' ORDER BY "occurredAt" DESC, sort_id DESC) FROM
        (SELECT id::text, id AS sort_id, kind, target, score, correct, occurred_at AS "occurredAt" FROM user_activity
          WHERE user_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT $3 OFFSET (($2 - 1) * $3)) paged), '[]'::jsonb)) AS data`, [id, query.page, query.pageSize]);
    return result.rows[0].data;
  }
}
