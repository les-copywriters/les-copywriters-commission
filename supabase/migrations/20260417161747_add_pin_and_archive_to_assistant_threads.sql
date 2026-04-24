-- Add pinning and archiving support to assistant threads
ALTER TABLE assistant_threads ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE assistant_threads ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE assistant_threads ADD COLUMN IF NOT EXISTS share_id uuid DEFAULT gen_random_uuid();

-- Add index for performance on pinned/archived filtering
CREATE INDEX IF NOT EXISTS assistant_threads_pin_archive_idx ON assistant_threads (is_pinned, is_archived);
