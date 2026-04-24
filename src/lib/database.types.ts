export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: "closer" | "setter" | "admin";
          fathom_api_key: string | null;
        };
        Insert: {
          id: string;
          name: string;
          role: "closer" | "setter" | "admin";
          fathom_api_key?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          role?: "closer" | "setter" | "admin";
          fathom_api_key?: string | null;
        };
        Relationships: [];
      };
      assistant_threads: {
        Row: {
          id: string;
          closer_id: string;
          created_by: string | null;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          closer_id: string;
          created_by?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          closer_id?: string;
          created_by?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_threads_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assistant_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_messages: {
        Row: {
          id: string;
          thread_id: string;
          closer_id: string;
          role: "user" | "assistant";
          content: string;
          citations: Json;
          context_snapshot: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          closer_id: string;
          role: "user" | "assistant";
          content: string;
          citations?: Json;
          context_snapshot?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          closer_id?: string;
          role?: "user" | "assistant";
          content?: string;
          citations?: Json;
          context_snapshot?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_messages_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assistant_messages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assistant_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "assistant_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_memory_snapshots: {
        Row: {
          id: string;
          closer_id: string;
          summary: string;
          message_count_covered: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          closer_id: string;
          summary?: string;
          message_count_covered?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          closer_id?: string;
          summary?: string;
          message_count_covered?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_memory_snapshots_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          date: string;
          client_name: string;
          client_email: string;
          product: string;
          closer_id: string;
          setter_id: string;
          amount: number;
          amount_ttc: number | null;
          tax_amount: number | null;
          closer_commission: number;
          setter_commission: number;
          bonus: number | null;
          refunded: boolean;
          impaye: boolean;
          payment_platform: string | null;
          payment_type: "pif" | "installments";
          num_installments: number | null;
          installment_amount: number | null;
          first_payment_date: string | null;
          call_recording_link: string | null;
          notes: string | null;
          jotform_submission_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          client_name: string;
          client_email: string;
          product: string;
          closer_id: string;
          setter_id: string;
          amount: number;
          amount_ttc?: number | null;
          tax_amount?: number | null;
          closer_commission: number;
          setter_commission: number;
          bonus?: number | null;
          refunded?: boolean;
          impaye?: boolean;
          payment_platform?: string | null;
          payment_type?: "pif" | "installments";
          num_installments?: number | null;
          installment_amount?: number | null;
          first_payment_date?: string | null;
          call_recording_link?: string | null;
          notes?: string | null;
          jotform_submission_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          client_name?: string;
          client_email?: string;
          product?: string;
          closer_id?: string;
          setter_id?: string;
          amount?: number;
          amount_ttc?: number | null;
          tax_amount?: number | null;
          closer_commission?: number;
          setter_commission?: number;
          bonus?: number | null;
          refunded?: boolean;
          impaye?: boolean;
          payment_platform?: string | null;
          payment_type?: "pif" | "installments";
          num_installments?: number | null;
          installment_amount?: number | null;
          first_payment_date?: string | null;
          call_recording_link?: string | null;
          notes?: string | null;
          jotform_submission_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_setter_id_fkey";
            columns: ["setter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          date: string;
          status: "pending" | "approved" | "refused";
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount: number;
          date: string;
          status: "pending" | "approved" | "refused";
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount?: number;
          date?: string;
          status?: "pending" | "approved" | "refused";
          created_at?: string;
        };
        Relationships: [];
      };
      bonus_tiers: {
        Row: {
          id: string;
          min_sales: number;
          bonus_amount: number;
        };
        Insert: {
          id?: string;
          min_sales: number;
          bonus_amount: number;
        };
        Update: {
          id?: string;
          min_sales?: number;
          bonus_amount?: number;
        };
        Relationships: [];
      };
      impayes: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount: number;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount?: number;
          date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      closer_frameworks: {
        Row: {
          id: string;
          closer_id: string;
          framework: string;
          generated_from_calls: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          closer_id: string;
          framework: string;
          generated_from_calls?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          closer_id?: string;
          framework?: string;
          generated_from_calls?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "closer_frameworks_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      closer_profiles: {
        Row: {
          id: string;
          closer_id: string;
          overview: string;
          strengths: string[];
          development_priorities: string[];
          common_objections: string[];
          winning_patterns: string[];
          risk_patterns: string[];
          coaching_tags: string[];
          average_scores: Json;
          calls_analyzed: number;
          last_compiled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          closer_id: string;
          overview?: string;
          strengths?: string[];
          development_priorities?: string[];
          common_objections?: string[];
          winning_patterns?: string[];
          risk_patterns?: string[];
          coaching_tags?: string[];
          average_scores?: Json;
          calls_analyzed?: number;
          last_compiled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          closer_id?: string;
          overview?: string;
          strengths?: string[];
          development_priorities?: string[];
          common_objections?: string[];
          winning_patterns?: string[];
          risk_patterns?: string[];
          coaching_tags?: string[];
          average_scores?: Json;
          calls_analyzed?: number;
          last_compiled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "closer_profiles_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      call_analyses: {
        Row: {
          id: string;
          closer_id: string;
          fathom_meeting_id: string | null;
          call_title: string | null;
          call_date: string | null;
          duration_seconds: number | null;
          transcript: string | null;
          score: number | null;
          feedback: Json | null;
          analysis_details: Json | null;
          status: "pending" | "synced" | "analyzing" | "done" | "error";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          closer_id: string;
          fathom_meeting_id?: string | null;
          call_title?: string | null;
          call_date?: string | null;
          duration_seconds?: number | null;
          transcript?: string | null;
          score?: number | null;
          feedback?: Json | null;
          analysis_details?: Json | null;
          status?: "pending" | "synced" | "analyzing" | "done" | "error";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          closer_id?: string;
          fathom_meeting_id?: string | null;
          call_title?: string | null;
          call_date?: string | null;
          duration_seconds?: number | null;
          transcript?: string | null;
          score?: number | null;
          feedback?: Json | null;
          analysis_details?: Json | null;
          status?: "pending" | "synced" | "analyzing" | "done" | "error";
          error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_analyses_closer_id_fkey";
            columns: ["closer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
