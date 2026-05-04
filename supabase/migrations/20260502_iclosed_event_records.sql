-- Raw iClosed event records (one row per booking/event call)
-- Mirrors the role that setter_call_records plays for Aircall.
CREATE TABLE IF NOT EXISTS iclosed_event_records (
  id                   bigserial PRIMARY KEY,
  profile_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  iclosed_event_id     text NOT NULL,
  iclosed_setter_id    text,
  iclosed_closer_id    text,
  date_time            timestamptz,
  invitee_name         text,
  invitee_email        text,
  phone_number         text,
  call_type            text,
  outcome              text,        -- WON, NO_SALE, QUALIFIED, UNQUALIFIED, PENDING, APPROVED, REJECTED
  no_sale_reason       text,        -- NO_SHOW, ADMIN_CANCELLED, CONTACT_CANCELLED, NOT_INTERESTED, …
  cancelled_by         text,        -- raw string from iClosed: "setter", "admin", "contact"
  cancel_reason        text,
  amount_collected     numeric(10,2) NOT NULL DEFAULT 0,
  amount_contracted    numeric(10,2) NOT NULL DEFAULT 0,
  raw_payload          jsonb,
  synced_at            timestamptz DEFAULT now(),
  UNIQUE (iclosed_event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS iclosed_event_records_profile_date_idx
  ON iclosed_event_records (profile_id, date_time DESC);

CREATE INDEX IF NOT EXISTS iclosed_event_records_profile_outcome_idx
  ON iclosed_event_records (profile_id, outcome);

CREATE INDEX IF NOT EXISTS iclosed_event_records_phone_idx
  ON iclosed_event_records (phone_number);

ALTER TABLE iclosed_event_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'iclosed_event_records'
      AND policyname = 'iclosed_event_records_rls'
  ) THEN
    CREATE POLICY "iclosed_event_records_rls" ON iclosed_event_records
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.id = iclosed_event_records.profile_id)
        )
      );
  END IF;
END $$;
