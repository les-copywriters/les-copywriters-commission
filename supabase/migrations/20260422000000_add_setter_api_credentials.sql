ALTER TABLE setter_integration_mappings
  ADD COLUMN IF NOT EXISTS aircall_api_id    text,
  ADD COLUMN IF NOT EXISTS aircall_api_token text,
  ADD COLUMN IF NOT EXISTS iclosed_api_key   text,
  ADD COLUMN IF NOT EXISTS iclosed_api_base_url text;
