import type { Database, Json } from "./database.types";

type SetterIntegrationMappingRow = {
  profile_id: string;
  aircall_api_id: string | null;
  aircall_api_token: string | null;
  aircall_user_id: string | null;
  aircall_email: string | null;
  pipedrive_owner_id: string | null;
  pipedrive_email: string | null;
  iclosed_api_key: string | null;
  iclosed_api_base_url: string | null;
  iclosed_user_id: string | null;
  iclosed_email: string | null;
  notes: string | null;
  updated_at: string | null;
};

type SetterCallMetricDailyRow = {
  profile_id: string;
  metric_date: string;
  source: "aircall";
  calls_made: number;
  calls_answered: number;
  talk_time_seconds: number;
};

type SetterFunnelMetricDailyRow = {
  profile_id: string;
  metric_date: string;
  source: "pipedrive" | "iclosed";
  leads_validated: number;
  leads_canceled: number;
  show_ups: number;
  closes: number;
};

type IntegrationSyncRunRow = {
  id: string;
  service: string | null;
  source: string;
  mode: string;
  status: string;
  synced_from: string | null;
  synced_to: string | null;
  records_seen: number;
  rows_written: number;
  errors: string[] | null;
  started_at: string;
  finished_at: string | null;
  triggered_by: string | null;
};

type SetterCallRecordRow = {
  id: number;
  profile_id: string;
  aircall_call_id: string;
  direction: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  talk_time_seconds: number;
  contact_name: string | null;
  contact_phone: string | null;
  recording_url: string | null;
  notes: string | null;
  transcription: string | null;
  summary: string | null;
  ai_topics: Json;
  ai_sentiments: Json;
  talk_listen_ratio: Json;
  raw_payload: Json | null;
};

type IClosedEventRecordRow = {
  id: string;
  profile_id: string;
  iclosed_event_id: string;
  phone_number: string | null;
  date_time: string;
  outcome: string | null;
  no_sale_reason: string | null;
  cancelled_by: string | null;
  amount_collected: number | null;
};

type CloserFrameworkHistoryRow = {
  id: string;
  closer_id: string;
  framework: string;
  generated_from_calls: string[];
  calls_count: number;
  created_at: string;
};

type ExtraTables = {
  closer_framework_history: {
    Row: CloserFrameworkHistoryRow;
    Insert: Omit<CloserFrameworkHistoryRow, "id"> & { id?: string };
    Update: Partial<CloserFrameworkHistoryRow>;
    Relationships: [];
  };
  setter_integration_mappings: {
    Row: SetterIntegrationMappingRow;
    Insert: Partial<SetterIntegrationMappingRow> & { profile_id: string };
    Update: Partial<SetterIntegrationMappingRow>;
    Relationships: [];
  };
  setter_call_metrics_daily: {
    Row: SetterCallMetricDailyRow;
    Insert: SetterCallMetricDailyRow;
    Update: Partial<SetterCallMetricDailyRow>;
    Relationships: [];
  };
  setter_funnel_metrics_daily: {
    Row: SetterFunnelMetricDailyRow;
    Insert: SetterFunnelMetricDailyRow;
    Update: Partial<SetterFunnelMetricDailyRow>;
    Relationships: [];
  };
  integration_sync_runs: {
    Row: IntegrationSyncRunRow;
    Insert: Partial<IntegrationSyncRunRow> & { source: string; status: string; started_at: string };
    Update: Partial<IntegrationSyncRunRow>;
    Relationships: [];
  };
  setter_call_records: {
    Row: SetterCallRecordRow;
    Insert: Omit<SetterCallRecordRow, "id"> & { id?: number };
    Update: Partial<SetterCallRecordRow>;
    Relationships: [];
  };
  iclosed_event_records: {
    Row: IClosedEventRecordRow;
    Insert: IClosedEventRecordRow;
    Update: Partial<IClosedEventRecordRow>;
    Relationships: [];
  };
};

type ExtraFunctions = {
  setter_performance_range: {
    Args: { date_from: string; date_to: string };
    Returns: Record<string, unknown>[];
  };
  setter_daily_activity: {
    Args: { date_from: string; date_to: string; p_profile_id: string | null };
    Returns: Record<string, unknown>[];
  };
};

export type ExtendedDatabase = {
  public: {
    Tables: Database["public"]["Tables"] & ExtraTables;
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"] & ExtraFunctions;
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};
