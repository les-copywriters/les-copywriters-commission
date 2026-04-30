-- ─── Cleanup duplicate call_analyses records ─────────────────────────────────
--
-- Fathom creates one recording entry per recorder active in the call
-- (AI notetaker + host Fathom extension + client Fathom extension).
-- Each gets a different fathom_meeting_id but the same title, date, and closer.
--
-- This script keeps ONE record per session (closer + title + date), choosing
-- the "best" copy in this priority order:
--   1. status = 'done'      (already AI-analyzed — most valuable)
--   2. status = 'synced'    (has transcript — ready to analyze)
--   3. status = 'analyzing' (in progress)
--   4. status = 'pending'   (no transcript yet)
--   5. oldest created_at    (tie-break: keep the first one imported)
--
-- Records where call_title or call_date is NULL are left untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — Preview what will be removed (run this first to verify)
-- SELECT
--   ca.call_title,
--   ca.call_date,
--   count(*) AS total_recordings,
--   count(*) - 1 AS will_delete
-- FROM call_analyses ca
-- WHERE ca.call_title IS NOT NULL
--   AND ca.call_date  IS NOT NULL
-- GROUP BY ca.closer_id, ca.call_title, ca.call_date
-- HAVING count(*) > 1
-- ORDER BY total_recordings DESC, ca.call_date DESC;

-- Step 2 — Delete the duplicates
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY closer_id, call_title, call_date
      ORDER BY
        CASE status
          WHEN 'done'      THEN 1
          WHEN 'synced'    THEN 2
          WHEN 'analyzing' THEN 3
          WHEN 'pending'   THEN 4
          ELSE                  5
        END ASC,
        created_at ASC          -- oldest first as tie-breaker
    ) AS rn
  FROM public.call_analyses
  WHERE call_title IS NOT NULL
    AND call_date  IS NOT NULL
)
DELETE FROM public.call_analyses
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Confirm what remains
SELECT
  count(*)                                              AS total_records,
  count(*) FILTER (WHERE status = 'done')               AS analyzed,
  count(*) FILTER (WHERE status = 'synced')             AS ready,
  count(*) FILTER (WHERE status = 'pending')            AS pending,
  count(DISTINCT (closer_id, call_title, call_date))    AS unique_sessions
FROM public.call_analyses;
