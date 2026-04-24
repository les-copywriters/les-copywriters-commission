-- Remove the unique constraint to allow multiple threads per closer
ALTER TABLE assistant_threads DROP CONSTRAINT IF EXISTS assistant_threads_closer_id_unique;

-- Add a title column to identify different chats
ALTER TABLE assistant_threads ADD COLUMN IF NOT EXISTS title text;

-- Update existing threads to have a default title
UPDATE assistant_threads SET title = 'Coaching Session' WHERE title IS NULL;
