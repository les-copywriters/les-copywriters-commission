-- Create a table for global company-wide settings
CREATE TABLE IF NOT EXISTS global_settings (
  key text PRIMARY KEY,
  value text,
  description text,
  is_secret boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage global settings
CREATE POLICY "global_settings_admin_all" ON global_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert placeholder for Aircall credentials
INSERT INTO global_settings (key, value, description, is_secret)
VALUES 
  ('aircall_api_id', NULL, 'Global Aircall API ID', false),
  ('aircall_api_token', NULL, 'Global Aircall API Token', true),
  ('iclosed_api_key', NULL, 'Global iClosed API Key', true),
  ('iclosed_api_base_url', 'https://api.iclosed.io/v1', 'Global iClosed API Base URL', false)
ON CONFLICT (key) DO NOTHING;
