
-- RPC to recompute daily call metrics from the source of truth (setter_call_records)
-- This is much more memory-efficient than doing it in the Edge Function.

CREATE OR REPLACE FUNCTION recompute_setter_call_metrics(
  p_profile_ids uuid[],
  p_min_date date,
  p_max_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected integer;
BEGIN
  INSERT INTO setter_call_metrics_daily (
    profile_id,
    metric_date,
    source,
    calls_made,
    calls_answered,
    talk_time_seconds,
    raw_payload,
    updated_at
  )
  SELECT
    profile_id,
    (started_at AT TIME ZONE 'UTC')::date as metric_date,
    'aircall' as source,
    COUNT(*) as calls_made,
    COUNT(*) FILTER (WHERE status IN ('answered', 'done')) as calls_answered,
    SUM(COALESCE(talk_time_seconds, 0)) as talk_time_seconds,
    jsonb_build_object('count', COUNT(*)) as raw_payload,
    now() as updated_at
  FROM setter_call_records
  WHERE profile_id = ANY(p_profile_ids)
    AND started_at >= (p_min_date::text || ' 00:00:00Z')::timestamptz
    AND started_at <= (p_max_date::text || ' 23:59:59Z')::timestamptz
  GROUP BY profile_id, (started_at AT TIME ZONE 'UTC')::date
  ON CONFLICT (profile_id, metric_date, source)
  DO UPDATE SET
    calls_made = EXCLUDED.calls_made,
    calls_answered = EXCLUDED.calls_answered,
    talk_time_seconds = EXCLUDED.talk_time_seconds,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected;
END;
$$;
