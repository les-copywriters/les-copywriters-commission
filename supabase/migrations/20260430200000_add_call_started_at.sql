-- Add start datetime to call_analyses so we can deduplicate recordings
-- that belong to the same session (same closer + same start time = same meeting,
-- even if Fathom assigned different recording IDs to the notetaker vs host copy).
alter table public.call_analyses
  add column if not exists call_started_at timestamptz;

-- Index for fast deduplication lookups during sync
create index if not exists call_analyses_closer_started_at_idx
  on public.call_analyses (closer_id, call_started_at)
  where call_started_at is not null;

comment on column public.call_analyses.call_started_at is
  'Full UTC start datetime from Fathom scheduled_start_time. Used to identify and deduplicate multiple recordings of the same meeting session.';
