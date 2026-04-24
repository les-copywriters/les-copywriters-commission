DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'setter_integration_mappings'
      AND policyname = 'setter_integration_mappings_self_write'
  ) THEN
    CREATE POLICY "setter_integration_mappings_self_write" ON setter_integration_mappings
      FOR ALL USING (auth.uid() = profile_id)
      WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;
