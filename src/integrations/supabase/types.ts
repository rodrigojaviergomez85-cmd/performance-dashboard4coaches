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
      abs_incidencias: {
        Row: {
          applicable: number
          class_id: number
          coach: string | null
          coach_id: number | null
          creado: string
          fecha: string
          horario: string | null
          id: string
          level: string | null
          syllabus: string | null
        }
        Insert: {
          applicable?: number
          class_id: number
          coach?: string | null
          coach_id?: number | null
          creado?: string
          fecha: string
          horario?: string | null
          id?: string
          level?: string | null
          syllabus?: string | null
        }
        Update: {
          applicable?: number
          class_id?: number
          coach?: string | null
          coach_id?: number | null
          creado?: string
          fecha?: string
          horario?: string | null
          id?: string
          level?: string | null
          syllabus?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          creado: string
          detalle: Json
          id: string
        }
        Insert: {
          accion: string
          actor_id?: string | null
          creado?: string
          detalle?: Json
          id?: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          creado?: string
          detalle?: Json
          id?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          activo: boolean
          auth_user_id: string | null
          categoria: string | null
          coach_id: number
          coordinador: string | null
          creado: string
          email: string
          estado: string | null
          id: string
          id_coordinador: number | null
          nombre: string
          pais: string | null
          rol: string
          sucursal: string | null
          tenure: string | null
        }
        Insert: {
          activo?: boolean
          auth_user_id?: string | null
          categoria?: string | null
          coach_id: number
          coordinador?: string | null
          creado?: string
          email: string
          estado?: string | null
          id?: string
          id_coordinador?: number | null
          nombre: string
          pais?: string | null
          rol?: string
          sucursal?: string | null
          tenure?: string | null
        }
        Update: {
          activo?: boolean
          auth_user_id?: string | null
          categoria?: string | null
          coach_id?: number
          coordinador?: string | null
          creado?: string
          email?: string
          estado?: string | null
          id?: string
          id_coordinador?: number | null
          nombre?: string
          pais?: string | null
          rol?: string
          sucursal?: string | null
          tenure?: string | null
        }
        Relationships: []
      }
      dsat_evals: {
        Row: {
          applicable: number
          class_id: number | null
          coach_comment: string | null
          coach_score: number | null
          creado: string
          experience_comment: string | null
          id: string
          level: string | null
          period_month: string | null
          razon_no_cuenta: string | null
          schedule: string | null
          status: string | null
          syllabus: string | null
          teacher_id: number | null
          teacher_name: string | null
          token: string
        }
        Insert: {
          applicable?: number
          class_id?: number | null
          coach_comment?: string | null
          coach_score?: number | null
          creado?: string
          experience_comment?: string | null
          id?: string
          level?: string | null
          period_month?: string | null
          razon_no_cuenta?: string | null
          schedule?: string | null
          status?: string | null
          syllabus?: string | null
          teacher_id?: number | null
          teacher_name?: string | null
          token: string
        }
        Update: {
          applicable?: number
          class_id?: number | null
          coach_comment?: string | null
          coach_score?: number | null
          creado?: string
          experience_comment?: string | null
          id?: string
          level?: string | null
          period_month?: string | null
          razon_no_cuenta?: string | null
          schedule?: string | null
          status?: string | null
          syllabus?: string | null
          teacher_id?: number | null
          teacher_name?: string | null
          token?: string
        }
        Relationships: []
      }
      encuestas: {
        Row: {
          coach_id: number
          comentario: string | null
          creado: string
          curso: string | null
          id: string
          origen: string | null
          periodo: string
          primera_semana: boolean
          score: number
        }
        Insert: {
          coach_id: number
          comentario?: string | null
          creado?: string
          curso?: string | null
          id?: string
          origen?: string | null
          periodo: string
          primera_semana?: boolean
          score: number
        }
        Update: {
          coach_id?: number
          comentario?: string | null
          creado?: string
          curso?: string | null
          id?: string
          origen?: string | null
          periodo?: string
          primera_semana?: boolean
          score?: number
        }
        Relationships: []
      }
      lateness: {
        Row: {
          coordinator: string | null
          creado: string
          fecha: string
          id: string
          late_count: number
          senior: string | null
          teacher_id: number | null
          teacher_name: string | null
        }
        Insert: {
          coordinator?: string | null
          creado?: string
          fecha: string
          id?: string
          late_count?: number
          senior?: string | null
          teacher_id?: number | null
          teacher_name?: string | null
        }
        Update: {
          coordinator?: string | null
          creado?: string
          fecha?: string
          id?: string
          late_count?: number
          senior?: string | null
          teacher_id?: number | null
          teacher_name?: string | null
        }
        Relationships: []
      }
      nl_evals: {
        Row: {
          class_id: number
          coach: string | null
          coach_id: number | null
          creado: string
          evaluator: string | null
          fecha: string
          horario: string | null
          id: string
          level: string | null
          resultado: string | null
          student: string | null
          student_id: number | null
          syllabus: string | null
        }
        Insert: {
          class_id: number
          coach?: string | null
          coach_id?: number | null
          creado?: string
          evaluator?: string | null
          fecha: string
          horario?: string | null
          id?: string
          level?: string | null
          resultado?: string | null
          student?: string | null
          student_id?: number | null
          syllabus?: string | null
        }
        Update: {
          class_id?: number
          coach?: string | null
          coach_id?: number | null
          creado?: string
          evaluator?: string | null
          fecha?: string
          horario?: string | null
          id?: string
          level?: string | null
          resultado?: string | null
          student?: string | null
          student_id?: number | null
          syllabus?: string | null
        }
        Relationships: []
      }
      otp_intentos: {
        Row: {
          creado: string
          email: string
          id: string
        }
        Insert: {
          creado?: string
          email: string
          id?: string
        }
        Update: {
          creado?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      parametros: {
        Row: {
          id: boolean
          min_encuestas: number
          trimestre_activo: string | null
          umbral_great: number
          umbral_superstar: number
        }
        Insert: {
          id?: boolean
          min_encuestas?: number
          trimestre_activo?: string | null
          umbral_great?: number
          umbral_superstar?: number
        }
        Update: {
          id?: boolean
          min_encuestas?: number
          trimestre_activo?: string | null
          umbral_great?: number
          umbral_superstar?: number
        }
        Relationships: []
      }
      qa_evals: {
        Row: {
          applicable: number
          clase: string | null
          clase_date: string | null
          coach: string | null
          coach_id: number | null
          comments: string | null
          creado: string
          eval_by: string | null
          eval_id: number
          id: string
          level: string | null
          schedule: string | null
          score: number | null
          syllabus: string | null
          week: number | null
        }
        Insert: {
          applicable?: number
          clase?: string | null
          clase_date?: string | null
          coach?: string | null
          coach_id?: number | null
          comments?: string | null
          creado?: string
          eval_by?: string | null
          eval_id: number
          id?: string
          level?: string | null
          schedule?: string | null
          score?: number | null
          syllabus?: string | null
          week?: number | null
        }
        Update: {
          applicable?: number
          clase?: string | null
          clase_date?: string | null
          coach?: string | null
          coach_id?: number | null
          comments?: string | null
          creado?: string
          eval_by?: string | null
          eval_id?: number
          id?: string
          level?: string | null
          schedule?: string | null
          score?: number | null
          syllabus?: string | null
          week?: number | null
        }
        Relationships: []
      }
      revisiones: {
        Row: {
          actualizado: string
          cuenta: boolean
          encuesta_id: string
          motivo: string | null
          revisor_id: string | null
        }
        Insert: {
          actualizado?: string
          cuenta?: boolean
          encuesta_id: string
          motivo?: string | null
          revisor_id?: string | null
        }
        Update: {
          actualizado?: string
          cuenta?: boolean
          encuesta_id?: string
          motivo?: string | null
          revisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revisiones_encuesta_id_fkey"
            columns: ["encuesta_id"]
            isOneToOne: true
            referencedRelation: "encuestas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisiones_revisor_id_fkey"
            columns: ["revisor_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tiene_rol: { Args: { _roles: string[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
