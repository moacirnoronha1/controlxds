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
      inventario_itens: {
        Row: {
          contado_em: string | null
          contado_por: string | null
          contagem_fisica: number | null
          created_at: string
          diferenca: number | null
          estoque_sistema: number
          id: string
          inventario_id: string
          observacao: string | null
          produto_id: string
          updated_at: string
        }
        Insert: {
          contado_em?: string | null
          contado_por?: string | null
          contagem_fisica?: number | null
          created_at?: string
          diferenca?: number | null
          estoque_sistema?: number
          id?: string
          inventario_id: string
          observacao?: string | null
          produto_id: string
          updated_at?: string
        }
        Update: {
          contado_em?: string | null
          contado_por?: string | null
          contagem_fisica?: number | null
          created_at?: string
          diferenca?: number | null
          estoque_sistema?: number
          id?: string
          inventario_id?: string
          observacao?: string | null
          produto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_itens_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios: {
        Row: {
          created_at: string
          criado_por: string | null
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacao: string | null
          referencia: string
          status: Database["public"]["Enums"]["inventario_status"]
          tipo: Database["public"]["Enums"]["inventario_tipo"]
          titulo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          referencia?: string
          status?: Database["public"]["Enums"]["inventario_status"]
          tipo?: Database["public"]["Enums"]["inventario_tipo"]
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          referencia?: string
          status?: Database["public"]["Enums"]["inventario_status"]
          tipo?: Database["public"]["Enums"]["inventario_tipo"]
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          barco: string | null
          created_at: string
          data_movimentacao: string
          fornecedor: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          responsavel: string | null
          tipo: string
        }
        Insert: {
          barco?: string | null
          created_at?: string
          data_movimentacao?: string
          fornecedor?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          responsavel?: string | null
          tipo: string
        }
        Update: {
          barco?: string | null
          created_at?: string
          data_movimentacao?: string
          fornecedor?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          responsavel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo_barras: string | null
          created_at: string
          estoque_atual: number
          estoque_inicial: number
          estoque_minimo: number
          id: string
          nome: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          codigo_barras?: string | null
          created_at?: string
          estoque_atual?: number
          estoque_inicial?: number
          estoque_minimo?: number
          id?: string
          nome: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo_barras?: string | null
          created_at?: string
          estoque_atual?: number
          estoque_inicial?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      criar_inventario: {
        Args: {
          _produto_ids?: string[]
          _tipo: Database["public"]["Enums"]["inventario_tipo"]
          _titulo: string
        }
        Returns: string
      }
      fechar_inventario: {
        Args: { _inventario_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "estoquista" | "leitor"
      inventario_status: "aberto" | "em_conferencia" | "fechado"
      inventario_tipo: "rapido" | "parcial" | "completo"
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
      app_role: ["admin", "estoquista", "leitor"],
      inventario_status: ["aberto", "em_conferencia", "fechado"],
      inventario_tipo: ["rapido", "parcial", "completo"],
    },
  },
} as const
