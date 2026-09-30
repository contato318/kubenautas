ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ADD COLUMN learning_started_at timestamptz;
ALTER TABLE users ADD COLUMN last_activity_at timestamptz;
-- Before this migration updated_at was changed only by successful OAuth logins.
UPDATE users SET last_login_at = updated_at;

CREATE TABLE user_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lesson_opened', 'simulator_opened', 'case_opened', 'exam_started', 'quiz_submitted', 'exam_submitted', 'case_answered', 'certificate_issued', 'progress_reset')),
  target varchar(160),
  score double precision CHECK (score >= 0 AND score <= 1),
  correct boolean,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL,
  UNIQUE (user_id, event_id)
);
CREATE INDEX user_activity_user_time_idx ON user_activity (user_id, occurred_at DESC, id DESC);
CREATE INDEX users_created_idx ON users (created_at DESC, id);
