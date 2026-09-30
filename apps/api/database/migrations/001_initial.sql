CREATE TABLE users (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  provider_subject text NOT NULL,
  name text NOT NULL,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE user_progress (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"quizzes":{},"completed":{}}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX sessions_expire_idx ON sessions(expire);
