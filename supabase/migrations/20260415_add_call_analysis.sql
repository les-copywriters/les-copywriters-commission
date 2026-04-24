-- ─── Step 1: Add Fathom API key to profiles ───────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fathom_api_key text;

-- ─── Step 2: closer_frameworks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS closer_frameworks (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id            uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  framework            text        NOT NULL DEFAULT '',
  generated_from_calls text[]      NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closer_frameworks_closer_id_unique UNIQUE (closer_id)
);

-- ─── Step 3: call_analyses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_analyses (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fathom_meeting_id text        UNIQUE,
  call_title        text,
  call_date         text,
  duration_seconds  integer,
  transcript        text,
  score             integer     CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  feedback          jsonb,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'synced', 'analyzing', 'done', 'error')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_analyses_closer_id_idx ON call_analyses(closer_id);
CREATE INDEX IF NOT EXISTS call_analyses_status_idx    ON call_analyses(status);

-- ─── Step 4: Row-Level Security ───────────────────────────────────────────────
ALTER TABLE closer_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analyses     ENABLE ROW LEVEL SECURITY;

-- Closers see only their own framework; admins see all
CREATE POLICY "closer_frameworks_rls" ON closer_frameworks
  FOR ALL USING (
    auth.uid() = closer_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Closers see only their own analyses; admins see all
CREATE POLICY "call_analyses_rls" ON call_analyses
  FOR ALL USING (
    auth.uid() = closer_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
