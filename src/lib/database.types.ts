export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: "closer" | "setter" | "admin";
        };
        Insert: {
          id: string;
          name: string;
          role: "closer" | "setter" | "admin";
        };
        Update: {
          id?: string;
          name?: string;
          role?: "closer" | "setter" | "admin";
        };
        Relationships: [];
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
