-- Returns per-setter KPIs for a given date range.
-- Joins setter_call_records (Aircall) with iclosed_event_records (iClosed).
-- Called by the frontend via supabase.rpc('setter_performance_range', { date_from, date_to }).
CREATE OR REPLACE FUNCTION setter_performance_range(date_from DATE, date_to DATE)
RETURNS TABLE (
  profile_id           UUID,
  full_name            TEXT,
  dialed               BIGINT,
  pickup               BIGINT,
  pickup_rate_pct      NUMERIC,
  validated            BIGINT,
  shows                BIGINT,
  no_shows             BIGINT,
  show_rate_pct        NUMERIC,
  setter_cancellations BIGINT,
  cancel_rate_pct      NUMERIC,
  closed               BIGINT,
  close_rate_pct       NUMERIC,
  total_encaisse       NUMERIC,
  eur_per_validated    NUMERIC,
  avg_duration_seconds INT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    p.id                                            AS profile_id,
    p.name                                          AS full_name,

    -- Aircall volumes
    COUNT(DISTINCT c.id)                            AS dialed,
    COUNT(DISTINCT c.id) FILTER (
      WHERE c.status IN ('answered', 'done')
    )                                               AS pickup,
    ROUND(
      100.0 * COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('answered', 'done'))
      / NULLIF(COUNT(DISTINCT c.id), 0)
    , 1)                                            AS pickup_rate_pct,

    -- iClosed funnel
    COUNT(DISTINCT b.id) FILTER (
      WHERE b.outcome IN ('QUALIFIED', 'APPROVED', 'WON', 'NO_SALE')
        AND (b.no_sale_reason IS NULL
             OR b.no_sale_reason NOT IN ('ADMIN_CANCELLED', 'CONTACT_CANCELLED'))
    )                                               AS validated,

    COUNT(DISTINCT b.id) FILTER (
      WHERE b.outcome IN ('WON', 'NO_SALE')
        AND (b.no_sale_reason IS DISTINCT FROM 'NO_SHOW')
    )                                               AS shows,

    COUNT(DISTINCT b.id) FILTER (
      WHERE b.no_sale_reason = 'NO_SHOW'
    )                                               AS no_shows,

    ROUND(
      100.0 * COUNT(DISTINCT b.id) FILTER (
        WHERE b.outcome IN ('WON', 'NO_SALE')
          AND (b.no_sale_reason IS DISTINCT FROM 'NO_SHOW')
      )
      / NULLIF(COUNT(DISTINCT b.id) FILTER (
        WHERE b.outcome IN ('QUALIFIED', 'APPROVED', 'WON', 'NO_SALE')
          AND (b.no_sale_reason IS NULL
               OR b.no_sale_reason NOT IN ('ADMIN_CANCELLED', 'CONTACT_CANCELLED'))
      ), 0)
    , 1)                                            AS show_rate_pct,

    -- Setter cancellations: cancelledBy = 'setter' (raw iClosed field)
    COUNT(DISTINCT b.id) FILTER (
      WHERE LOWER(b.cancelled_by) = 'setter'
    )                                               AS setter_cancellations,

    -- Cancel rate = setter cancellations / pickups (per spec)
    ROUND(
      100.0 * COUNT(DISTINCT b.id) FILTER (WHERE LOWER(b.cancelled_by) = 'setter')
      / NULLIF(COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('answered', 'done')), 0)
    , 1)                                            AS cancel_rate_pct,

    COUNT(DISTINCT b.id) FILTER (
      WHERE b.outcome = 'WON'
    )                                               AS closed,

    ROUND(
      100.0 * COUNT(DISTINCT b.id) FILTER (WHERE b.outcome = 'WON')
      / NULLIF(COUNT(DISTINCT b.id) FILTER (
        WHERE b.outcome IN ('WON', 'NO_SALE')
          AND (b.no_sale_reason IS DISTINCT FROM 'NO_SHOW')
      ), 0)
    , 1)                                            AS close_rate_pct,

    COALESCE(SUM(b.amount_collected), 0)            AS total_encaisse,

    COALESCE(
      SUM(b.amount_collected) / NULLIF(
        COUNT(DISTINCT b.id) FILTER (
          WHERE b.outcome IN ('QUALIFIED', 'APPROVED', 'WON', 'NO_SALE')
            AND (b.no_sale_reason IS NULL
                 OR b.no_sale_reason NOT IN ('ADMIN_CANCELLED', 'CONTACT_CANCELLED'))
        ), 0
      ), 0
    )::NUMERIC                                      AS eur_per_validated,

    COALESCE(
      AVG(c.duration_seconds) FILTER (
        WHERE c.status IN ('answered', 'done')
      ), 0
    )::INT                                          AS avg_duration_seconds

  FROM profiles p
  LEFT JOIN setter_call_records c
    ON c.profile_id = p.id
    AND c.started_at::DATE BETWEEN date_from AND date_to
  LEFT JOIN iclosed_event_records b
    ON b.profile_id = p.id
    AND b.date_time::DATE BETWEEN date_from AND date_to
  WHERE p.role = 'setter'
  GROUP BY p.id, p.name
  ORDER BY total_encaisse DESC;
$$;

-- Also create a helper that returns daily activity for the bar chart.
-- Returns one row per (profile_id, date) within the range.
CREATE OR REPLACE FUNCTION setter_daily_activity(date_from DATE, date_to DATE, p_profile_id UUID DEFAULT NULL)
RETURNS TABLE (
  profile_id  UUID,
  activity_date DATE,
  dialed      BIGINT,
  pickup      BIGINT,
  validated   BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    p.id                    AS profile_id,
    d.activity_date::DATE,
    COUNT(DISTINCT c.id)    AS dialed,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('answered', 'done')) AS pickup,
    COUNT(DISTINCT b.id) FILTER (
      WHERE b.outcome IN ('QUALIFIED', 'APPROVED', 'WON', 'NO_SALE')
        AND (b.no_sale_reason IS NULL
             OR b.no_sale_reason NOT IN ('ADMIN_CANCELLED', 'CONTACT_CANCELLED'))
    )                       AS validated
  FROM profiles p
  -- Generate every date in range so we get zeros for quiet days
  CROSS JOIN generate_series(date_from, date_to, '1 day'::interval) AS d(activity_date)
  LEFT JOIN setter_call_records c
    ON c.profile_id = p.id
    AND c.started_at::DATE = d.activity_date::DATE
  LEFT JOIN iclosed_event_records b
    ON b.profile_id = p.id
    AND b.date_time::DATE = d.activity_date::DATE
  WHERE p.role = 'setter'
    AND (p_profile_id IS NULL OR p.id = p_profile_id)
  GROUP BY p.id, d.activity_date
  ORDER BY p.id, d.activity_date;
$$;
