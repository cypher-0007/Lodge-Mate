export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      beta_lodges_config: {
        Row: {
          id: string
          access_fee_ngn: number
          access_duration_days: number
          is_paid_access_enabled: boolean
          currency: string
          title: string
          description: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          access_fee_ngn?: number
          access_duration_days?: number
          is_paid_access_enabled?: boolean
          currency?: string
          title?: string
          description?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          access_fee_ngn?: number
          access_duration_days?: number
          is_paid_access_enabled?: boolean
          currency?: string
          title?: string
          description?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      beta_access_passes: {
        Row: {
          id: string
          user_id: string
          payment_reference: string
          payment_provider: string
          amount_paid: number
          currency: string
          duration_days: number
          starts_at: string
          expires_at: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_reference: string
          payment_provider?: string
          amount_paid: number
          currency?: string
          duration_days: number
          starts_at?: string
          expires_at: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_reference?: string
          payment_provider?: string
          amount_paid?: number
          currency?: string
          duration_days?: number
          starts_at?: string
          expires_at?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      beta_pending_payments: {
        Row: {
          id: string
          user_id: string
          payment_reference: string
          payment_provider: string
          snapshot_fee_ngn: number
          snapshot_duration_days: number
          snapshot_currency: string
          status: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_reference: string
          payment_provider?: string
          snapshot_fee_ngn: number
          snapshot_duration_days: number
          snapshot_currency?: string
          status?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_reference?: string
          payment_provider?: string
          snapshot_fee_ngn?: number
          snapshot_duration_days?: number
          snapshot_currency?: string
          status?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          note: string | null
          preferred_date: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          note?: string | null
          preferred_date?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          note?: string | null
          preferred_date?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          amenities: string[]
          area: string
          beta_status: Database["public"]["Enums"]["beta_approval_status"]
          created_at: string
          description: string
          distance: string
          id: string
          image_url: string | null
          inspection_notes: string | null
          is_beta: boolean
          kind: string
          owner_id: string
          period: string
          price: number
          provider_phone: string | null
          school: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          verified: boolean
          video_url: string | null
        }
        Insert: {
          amenities?: string[]
          area?: string
          beta_status?: Database["public"]["Enums"]["beta_approval_status"]
          created_at?: string
          description?: string
          distance?: string
          id?: string
          image_url?: string | null
          inspection_notes?: string | null
          is_beta?: boolean
          kind?: string
          owner_id: string
          period?: string
          price?: number
          provider_phone?: string | null
          school?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          verified?: boolean
          video_url?: string | null
        }
        Update: {
          amenities?: string[]
          area?: string
          beta_status?: Database["public"]["Enums"]["beta_approval_status"]
          created_at?: string
          description?: string
          distance?: string
          id?: string
          image_url?: string | null
          inspection_notes?: string | null
          is_beta?: boolean
          kind?: string
          owner_id?: string
          period?: string
          price?: number
          provider_phone?: string | null
          school?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          verified?: boolean
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          provider_type: "landlord" | "agent" | null
          school: string | null
          updated_at: string
        }
        Insert: {
          banned?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          provider_type?: "landlord" | "agent" | null
          school?: string | null
          updated_at?: string
        }
        Update: {
          banned?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          provider_type?: "landlord" | "agent" | null
          school?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      beta_lodges_preview: {
        Row: {
          amenities: string[]
          area: string
          beta_status: Database["public"]["Enums"]["beta_approval_status"]
          created_at: string
          description: string
          distance: string
          id: string
          image_url: string | null
          is_beta: boolean
          period: string
          price: number
          school: string
          title: string
          verified: boolean
        }
        Relationships: []
      }
    }
    Functions: {
      confirm_beta_pending_payment: {
        Args: {
          _payment_ref: string
          _verified_amount_ngn: number
          _user_id: string
        }
        Returns: Database["public"]["Tables"]["beta_access_passes"]["Row"]
      }
      get_beta_lodge_details: {
        Args: {
          _listing_id: string
        }
        Returns: {
          amenities: string[]
          area: string
          beta_status: Database["public"]["Enums"]["beta_approval_status"]
          created_at: string
          description: string
          distance: string
          id: string
          image_url: string | null
          inspection_notes: string | null
          is_beta: boolean
          kind: string
          owner_id: string
          period: string
          price: number
          provider_phone: string | null
          school: string
          title: string
          verified: boolean
          video_url: string | null
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_beta_access: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      initiate_beta_checkout: {
        Args: {
          _user_id: string
          _payment_ref: string
          _provider?: string
        }
        Returns: Database["public"]["Tables"]["beta_pending_payments"]["Row"]
      }
      issue_verified_beta_pass: {
        Args: {
          _amount_paid: number
          _payment_ref: string
          _provider: string
          _user_id: string
        }
        Returns: Database["public"]["Tables"]["beta_access_passes"]["Row"]
      }
      sync_user_signup_role: {
        Args: {
          _role: string
          _provider_type?: string | null
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "landlord" | "admin"
      beta_approval_status: "none" | "pending" | "approved" | "rejected"
      listing_status: "pending" | "approved" | "rejected" | "removed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "landlord", "admin"],
      listing_status: ["pending", "approved", "rejected", "removed"],
    },
  },
} as const
