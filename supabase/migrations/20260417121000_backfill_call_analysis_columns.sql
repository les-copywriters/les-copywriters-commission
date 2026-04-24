ALTER TABLE call_analyses
  ADD COLUMN IF NOT EXISTS call_title text,
  ADD COLUMN IF NOT EXISTS call_date text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS score integer,
  ADD COLUMN IF NOT EXISTS feedback jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE closer_frameworks
  ADD COLUMN IF NOT EXISTS framework text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS generated_from_calls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS call_analyses_closer_id_idx ON call_analyses(closer_id);
CREATE INDEX IF NOT EXISTS call_analyses_status_idx ON call_analyses(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'call_analyses_score_check'
  ) THEN
    ALTER TABLE call_analyses
      ADD CONSTRAINT call_analyses_score_check
      CHECK (score IS NULL OR (score >= 0 AND score <= 100));
  END IF;
END $$;

ALTER TABLE closer_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'closer_frameworks'
      AND policyname = 'closer_frameworks_rls'
  ) THEN
    CREATE POLICY "closer_frameworks_rls" ON closer_frameworks
      FOR ALL USING (
        auth.uid() = closer_id
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_analyses'
      AND policyname = 'call_analyses_rls'
  ) THEN
    CREATE POLICY "call_analyses_rls" ON call_analyses
      FOR ALL USING (
        auth.uid() = closer_id
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
