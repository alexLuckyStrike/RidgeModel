CREATE TABLE IF NOT EXISTS athletes (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  sex TEXT,
  birth_date DATE,
  weight_class_kg NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL CHECK (
    session_type IN ('baseline', 'rest', 'load', 'training', 'recovery', 'other')
  ),
  workout_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  file_group TEXT NOT NULL CHECK (
    file_group IN ('scale2', 'scale5', 'rest', 'load', 'workout', 'text', 'other')
  ),
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  sha256 TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  upload_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,
  strip_index INTEGER NOT NULL DEFAULT 1 CHECK (strip_index > 0),
  marker_name TEXT NOT NULL CHECK (
    marker_name IN (
      'creatinine',
      'albumin',
      'microalbumin',
      'hb_myoglobin',
      'ketones',
      'protein',
      'glucose',
      'ph'
    )
  ),
  marker_value NUMERIC(14,4) NOT NULL,
  unit TEXT NOT NULL,
  source_group TEXT NOT NULL DEFAULT 'unknown' CHECK (source_group IN ('rest', 'load', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (upload_id, strip_index, marker_name)
);

CREATE TABLE IF NOT EXISTS training_plans (
  id BIGSERIAL PRIMARY KEY,
  athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES sessions(id) ON DELETE SET NULL,
  plan_version TEXT NOT NULL DEFAULT 'v1',
  plan_json JSONB NOT NULL,
  summary_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_athlete_date
  ON sessions (athlete_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_uploads_session
  ON uploads (session_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_session_marker
  ON analysis_results (session_id, marker_name);

CREATE INDEX IF NOT EXISTS idx_training_plans_athlete_created
  ON training_plans (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_plans_json
  ON training_plans USING GIN (plan_json);
