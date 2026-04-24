CREATE TABLE IF NOT EXISTS setter_integration_mappings (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  aircall_user_id text,
  aircall_email text,
  pipedrive_owner_id text,
  pipedrive_email text,
  iclosed_user_id text,
  iclosed_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setter_call_metrics_daily (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('aircall')),
  calls_made integer NOT NULL DEFAULT 0,
  calls_answered integer NOT NULL DEFAULT 0,
  talk_time_seconds integer NOT NULL DEFAULT 0,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, metric_date, source)
);

CREATE TABLE IF NOT EXISTS setter_funnel_metrics_daily (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('pipedrive', 'iclosed')),
  leads_validated integer NOT NULL DEFAULT 0,
  leads_canceled integer NOT NULL DEFAULT 0,
  show_ups integer NOT NULL DEFAULT 0,
  closes integer NOT NULL DEFAULT 0,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, metric_date, source)
);

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('aircall', 'pipedrive', 'iclosed', 'scheduler')),
  mode text NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'scheduled')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'error')),
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  synced_from date,
  synced_to date,
  records_seen integer NOT NULL DEFAULT 0,
  rows_written integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS setter_call_metrics_daily_profile_date_idx
  ON setter_call_metrics_daily (profile_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS setter_funnel_metrics_daily_profile_date_idx
  ON setter_funnel_metrics_daily (profile_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS integration_sync_runs_source_started_at_idx
  ON integration_sync_runs (source, started_at DESC);
CREATE INDEX IF NOT EXISTS integration_sync_runs_status_started_at_idx
  ON integration_sync_runs (status, started_at DESC);

ALTER TABLE setter_integration_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE setter_call_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE setter_funnel_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'setter_integration_mappings'
      AND policyname = 'setter_integration_mappings_select'
  ) THEN
    CREATE POLICY "setter_integration_mappings_select" ON setter_integration_mappings
      FOR SELECT USING (
        auth.uid() = profile_id
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
      AND tablename = 'setter_integration_mappings'
      AND policyname = 'setter_integration_mappings_admin_write'
  ) THEN
    CREATE POLICY "setter_integration_mappings_admin_write" ON setter_integration_mappings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
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
      AND tablename = 'setter_call_metrics_daily'
      AND policyname = 'setter_call_metrics_daily_rls'
  ) THEN
    CREATE POLICY "setter_call_metrics_daily_rls" ON setter_call_metrics_daily
      FOR SELECT USING (
        auth.uid() = profile_id
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
      AND tablename = 'setter_funnel_metrics_daily'
      AND policyname = 'setter_funnel_metrics_daily_rls'
  ) THEN
    CREATE POLICY "setter_funnel_metrics_daily_rls" ON setter_funnel_metrics_daily
      FOR SELECT USING (
        auth.uid() = profile_id
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
      AND tablename = 'integration_sync_runs'
      AND policyname = 'integration_sync_runs_admin_rls'
  ) THEN
    CREATE POLICY "integration_sync_runs_admin_rls" ON integration_sync_runs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
