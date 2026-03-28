CREATE TABLE IF NOT EXISTS athletes (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  sex TEXT,
  birth_date DATE,
  weight_category_points NUMERIC(10,2) CHECK (weight_category_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observation_periods (
  id BIGSERIAL PRIMARY KEY,
  athlete_id BIGINT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  weeks_count INTEGER NOT NULL CHECK (weeks_count > 0),
  sessions_per_week INTEGER NOT NULL CHECK (sessions_per_week > 0),
  start_date DATE NOT NULL,
  competition_date DATE NOT NULL,
  bench_press_points NUMERIC(10,2) CHECK (bench_press_points >= 0),
  squat_points NUMERIC(10,2) CHECK (squat_points >= 0),
  deadlift_points NUMERIC(10,2) CHECK (deadlift_points >= 0),
  total_points NUMERIC(10,2) CHECK (total_points >= 0),
  sport_rank TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_date < competition_date)
);

CREATE TABLE IF NOT EXISTS rest_baselines (
  id BIGSERIAL PRIMARY KEY,
  period_id BIGINT NOT NULL UNIQUE REFERENCES observation_periods(id) ON DELETE CASCADE,
  creatinine_points NUMERIC(14,4) NOT NULL CHECK (creatinine_points >= 0),
  protein_points NUMERIC(14,4) NOT NULL CHECK (protein_points >= 0),
  myoglobin_points NUMERIC(14,4) NOT NULL CHECK (myoglobin_points >= 0),
  ketones_points NUMERIC(14,4) NOT NULL CHECK (ketones_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id BIGSERIAL PRIMARY KEY,
  period_id BIGINT NOT NULL REFERENCES observation_periods(id) ON DELETE CASCADE,
  week_no INTEGER NOT NULL CHECK (week_no > 0),
  session_no INTEGER NOT NULL CHECK (session_no > 0),
  v_points NUMERIC(14,4) NOT NULL CHECK (v_points >= 0),
  p_points NUMERIC(14,4) NOT NULL CHECK (p_points >= 0),
  r_points NUMERIC(14,4) NOT NULL CHECK (r_points >= 0),
  creatinine_points NUMERIC(14,4) CHECK (creatinine_points >= 0),
  protein_points NUMERIC(14,4) CHECK (protein_points >= 0),
  myoglobin_points NUMERIC(14,4) CHECK (myoglobin_points >= 0),
  ketones_points NUMERIC(14,4) CHECK (ketones_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, week_no, session_no)
);

CREATE INDEX IF NOT EXISTS idx_observation_periods_athlete
  ON observation_periods (athlete_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_training_sessions_period_week
  ON training_sessions (period_id, week_no, session_no);

CREATE INDEX IF NOT EXISTS idx_training_sessions_period_created
  ON training_sessions (period_id, created_at DESC);
