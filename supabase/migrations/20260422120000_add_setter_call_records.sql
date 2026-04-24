CREATE TABLE IF NOT EXISTS setter_call_records (
  id                 bigserial PRIMARY KEY,
  profile_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  aircall_call_id    text NOT NULL,
  direction          text,
  status             text,
  started_at         timestamptz,
  ended_at           timestamptz,
  duration_seconds   integer DEFAULT 0,
  talk_time_seconds  integer DEFAULT 0,
  contact_name       text,
  contact_phone      text,
  recording_url      text,
  notes              text,
  raw_payload        jsonb,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (aircall_call_id, profile_id)
);

CREATE INDEX IF NOT EXISTS setter_call_records_profile_started_idx
  ON setter_call_records (profile_id, started_at DESC);

ALTER TABLE setter_call_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'setter_call_records' AND policyname = 'setter_call_records_rls'
  ) THEN
    CREATE POLICY "setter_call_records_rls" ON setter_call_records
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.role = 'admin' OR profiles.id = setter_call_records.profile_id)
        )
      );
  END IF;
END $$;
