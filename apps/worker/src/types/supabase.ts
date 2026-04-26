// Hand-rolled minimal Database type for Walour worker.
// Covers only the tables ingest.ts touches.
// TODO: Replace with `npx supabase gen types typescript --project-id <id>` once
//       the Supabase CLI is available in CI.

export interface Database {
  public: {
    Tables: {
      threat_reports: {
        Row: {
          id: string
          address: string
          type: string
          source: string
          evidence_url: string | null
          confidence: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          address: string
          type: string
          source: string
          evidence_url?: string | null
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address?: string
          type?: string
          source?: string
          evidence_url?: string | null
          confidence?: number
          created_at?: string
          updated_at?: string
        }
      }
      outages: {
        Row: {
          id: string
          provider: string
          error_msg: string | null
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          provider: string
          error_msg?: string | null
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          provider?: string
          error_msg?: string | null
          created_at?: string
          closed_at?: string | null
        }
      }
      ingestion_errors: {
        Row: {
          id: string
          source: string
          payload: unknown
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          source: string
          payload: unknown
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          source?: string
          payload?: unknown
          reason?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_threat: {
        Args: {
          p_address: string
          p_type: string
          p_source: string
          p_evidence_url: string | null
          p_confidence_delta: number
        }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}
