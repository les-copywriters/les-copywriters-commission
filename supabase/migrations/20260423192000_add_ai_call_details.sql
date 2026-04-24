-- Add AI-enhanced call details to setter call records
ALTER TABLE setter_call_records 
ADD COLUMN IF NOT EXISTS transcription text,
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS ai_topics jsonb,
ADD COLUMN IF NOT EXISTS ai_sentiments jsonb,
ADD COLUMN IF NOT EXISTS talk_listen_ratio jsonb; -- e.g. {"agent": 0.63, "customer": 0.37}
