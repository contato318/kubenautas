CREATE TABLE certificates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(120) NOT NULL,
  exam_score double precision NOT NULL CHECK (exam_score >= 0.7 AND exam_score <= 1),
  issued_at timestamptz NOT NULL DEFAULT now()
);
