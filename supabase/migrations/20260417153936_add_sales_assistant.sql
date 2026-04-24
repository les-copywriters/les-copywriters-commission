CREATE TABLE IF NOT EXISTS assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_threads_closer_id_unique UNIQUE (closer_id)
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  closer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_memory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  message_count_covered integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_messages_thread_id_idx ON assistant_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS assistant_messages_closer_id_idx ON assistant_messages(closer_id, created_at);
CREATE INDEX IF NOT EXISTS assistant_threads_closer_id_idx ON assistant_threads(closer_id);
CREATE INDEX IF NOT EXISTS assistant_memory_snapshots_closer_id_idx ON assistant_memory_snapshots(closer_id, updated_at DESC);

ALTER TABLE assistant_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_memory_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_threads'
      AND policyname = 'assistant_threads_rls'
  ) THEN
    CREATE POLICY "assistant_threads_rls" ON assistant_threads
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
      AND tablename = 'assistant_messages'
      AND policyname = 'assistant_messages_rls'
  ) THEN
    CREATE POLICY "assistant_messages_rls" ON assistant_messages
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
      AND tablename = 'assistant_memory_snapshots'
      AND policyname = 'assistant_memory_snapshots_rls'
  ) THEN
    CREATE POLICY "assistant_memory_snapshots_rls" ON assistant_memory_snapshots
      FOR ALL USING (
        auth.uid() = closer_id
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
