ALTER TABLE call_analyses
  ADD COLUMN IF NOT EXISTS analysis_details jsonb;

CREATE TABLE IF NOT EXISTS closer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  overview text NOT NULL DEFAULT '',
  strengths text[] NOT NULL DEFAULT '{}',
  development_priorities text[] NOT NULL DEFAULT '{}',
  common_objections text[] NOT NULL DEFAULT '{}',
  winning_patterns text[] NOT NULL DEFAULT '{}',
  risk_patterns text[] NOT NULL DEFAULT '{}',
  coaching_tags text[] NOT NULL DEFAULT '{}',
  average_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  calls_analyzed integer NOT NULL DEFAULT 0,
  last_compiled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closer_profiles_closer_id_unique UNIQUE (closer_id)
);

CREATE INDEX IF NOT EXISTS closer_profiles_closer_id_idx ON closer_profiles(closer_id);

ALTER TABLE closer_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'closer_profiles'
      AND policyname = 'closer_profiles_rls'
  ) THEN
    CREATE POLICY "closer_profiles_rls" ON closer_profiles
      FOR ALL USING (
        auth.uid() = closer_id
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
