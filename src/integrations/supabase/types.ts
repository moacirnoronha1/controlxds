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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      avarias: {
        Row: {
          barco: string | null
          chk_aguardando: boolean
          chk_aprovado: boolean
          chk_comunicado: boolean
          chk_descontado: boolean
          chk_evidencia: boolean
          chk_recusado: boolean
          chk_registrada: boolean
          chk_resolvido: boolean
          created_at: string
          data: string
          id: string
          local_id: string | null
          lote_id: string | null
          manifesto: string | null
          momento: Database["public"]["Enums"]["avaria_momento"]
          motivo: string | null
          observacao: string | null
          produto_id: string
          quantidade: number
          quantidade_aproveitada: number | null
          quantidade_avariada: number | null
          quantidade_recebida: number | null
          responsavel: string | null
          status: Database["public"]["Enums"]["avaria_status"]
          tipo: Database["public"]["Enums"]["avaria_tipo"]
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          barco?: string | null
          chk_aguardando?: boolean
          chk_aprovado?: boolean
          chk_comunicado?: boolean
          chk_descontado?: boolean
          chk_evidencia?: boolean
          chk_recusado?: boolean
          chk_registrada?: boolean
          chk_resolvido?: boolean
          created_at?: string
          data?: string
          id?: string
          local_id?: string | null
          lote_id?: string | null
          manifesto?: string | null
          momento: Database["public"]["Enums"]["avaria_momento"]
          motivo?: string | null
          observacao?: string | null
          produto_id: string
          quantidade?: number
          quantidade_aproveitada?: number | null
          quantidade_avariada?: number | null
          quantidade_recebida?: number | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["avaria_status"]
          tipo: Database["public"]["Enums"]["avaria_tipo"]
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          barco?: string | null
          chk_aguardando?: boolean
          chk_aprovado?: boolean
          chk_comunicado?: boolean
          chk_descontado?: boolean
          chk_evidencia?: boolean
          chk_recusado?: boolean
          chk_registrada?: boolean
          chk_resolvido?: boolean
          created_at?: string
          data?: string
          id?: string
          local_id?: string | null
          lote_id?: string | null
          manifesto?: string | null
          momento?: Database["public"]["Enums"]["avaria_momento"]
          motivo?: string | null
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          quantidade_aproveitada?: number | null
          quantidade_avariada?: number | null
          quantidade_recebida?: number | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["avaria_status"]
          tipo?: Database["public"]["Enums"]["avaria_tipo"]
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avarias_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avarias_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avarias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      emprestimos: {
        Row: {
          created_at: string
          data_devolucao: string | null
          data_emprestimo: string
          destino: string | null
          id: string
          observacao: string | null
          origem: string | null
          previsao_devolucao: string | null
          produto_id: string | null
          produto_nome: string
          quantidade: number
          responsavel: string | null
          status: Database["public"]["Enums"]["emprestimo_status"]
          tipo: Database["public"]["Enums"]["emprestimo_tipo"]
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_devolucao?: string | null
          data_emprestimo?: string
          destino?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          previsao_devolucao?: string | null
          produto_id?: string | null
          produto_nome: string
          quantidade: number
          responsavel?: string | null
          status?: Database["public"]["Enums"]["emprestimo_status"]
          tipo: Database["public"]["Enums"]["emprestimo_tipo"]
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_devolucao?: string | null
          data_emprestimo?: string
          destino?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          previsao_devolucao?: string | null
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          responsavel?: string | null
          status?: Database["public"]["Enums"]["emprestimo_status"]
          tipo?: Database["public"]["Enums"]["emprestimo_tipo"]
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emprestimos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      locais_estoque: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      lotes: {
        Row: {
          created_at: string
          custo_unitario: number | null
          fornecedor: string | null
          id: string
          local_id: string
          observacao: string | null
          produto_id: string
          quantidade_inicial: number
          saldo: number
          updated_at: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          fornecedor?: string | null
          id?: string
          local_id: string
          observacao?: string | null
          produto_id: string
          quantidade_inicial: number
          saldo: number
          updated_at?: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          fornecedor?: string | null
          id?: string
          local_id?: string
          observacao?: string | null
          produto_id?: string
          quantidade_inicial?: number
          saldo?: number
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          barco: string | null
          created_at: string
          data_movimentacao: string
          fornecedor: string | null
          id: string
          local_id: string | null
          lote_id: string | null
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
          local_id?: string | null
          lote_id?: string | null
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
          local_id?: string | null
          lote_id?: string | null
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          responsavel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          chave: string
          cnpj: string | null
          created_at: string
          data_emissao: string | null
          fornecedor: string | null
          id: string
          numero: string | null
          observacao: string | null
          responsavel: string | null
          updated_at: string
        }
        Insert: {
          chave: string
          cnpj?: string | null
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          responsavel?: string | null
          updated_at?: string
        }
        Update: {
          chave?: string
          cnpj?: string | null
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          responsavel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo_barras: string | null
          codigo_caixa: string | null
          created_at: string
          estoque_atual: number
          estoque_inicial: number
          estoque_minimo: number
          id: string
          local_padrao_id: string | null
          nome: string
          unidade_medida: string
          unidades_por_caixa: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          codigo_barras?: string | null
          codigo_caixa?: string | null
          created_at?: string
          estoque_atual?: number
          estoque_inicial?: number
          estoque_minimo?: number
          id?: string
          local_padrao_id?: string | null
          nome: string
          unidade_medida?: string
          unidades_por_caixa?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo_barras?: string | null
          codigo_caixa?: string | null
          created_at?: string
          estoque_atual?: number
          estoque_inicial?: number
          estoque_minimo?: number
          id?: string
          local_padrao_id?: string | null
          nome?: string
          unidade_medida?: string
          unidades_por_caixa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_local_padrao_id_fkey"
            columns: ["local_padrao_id"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
        ]
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
      requisicao_itens: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          produto_id: string
          quantidade_liberada: number | null
          quantidade_solicitada: number
          requisicao_id: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          produto_id: string
          quantidade_liberada?: number | null
          quantidade_solicitada: number
          requisicao_id: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          produto_id?: string
          quantidade_liberada?: number | null
          quantidade_solicitada?: number
          requisicao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicoes: {
        Row: {
          cancelada_em: string | null
          created_at: string
          data: string
          id: string
          liberada_em: string | null
          numero: number
          observacao: string | null
          requisitante: string
          responsavel_liberacao: string | null
          setor: string
          status: Database["public"]["Enums"]["requisicao_status"]
          updated_at: string
        }
        Insert: {
          cancelada_em?: string | null
          created_at?: string
          data?: string
          id?: string
          liberada_em?: string | null
          numero?: number
          observacao?: string | null
          requisitante: string
          responsavel_liberacao?: string | null
          setor: string
          status?: Database["public"]["Enums"]["requisicao_status"]
          updated_at?: string
        }
        Update: {
          cancelada_em?: string | null
          created_at?: string
          data?: string
          id?: string
          liberada_em?: string | null
          numero?: number
          observacao?: string | null
          requisitante?: string
          responsavel_liberacao?: string | null
          setor?: string
          status?: Database["public"]["Enums"]["requisicao_status"]
          updated_at?: string
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      sessoes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
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
      usuarios: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          cargo: Database["public"]["Enums"]["user_cargo"]
          created_at: string
          id: string
          nome: string
          senha_hash: string
          setor: string | null
          updated_at: string
          username: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          cargo?: Database["public"]["Enums"]["user_cargo"]
          created_at?: string
          id?: string
          nome: string
          senha_hash: string
          setor?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          cargo?: Database["public"]["Enums"]["user_cargo"]
          created_at?: string
          id?: string
          nome?: string
          senha_hash?: string
          setor?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_usuario: {
        Args: {
          _ativo: boolean
          _cargo: Database["public"]["Enums"]["user_cargo"]
          _id: string
          _nome: string
          _senha: string
          _setor: string
          _token: string
          _username: string
        }
        Returns: undefined
      }
      cancelar_requisicao: {
        Args: { _requisicao_id: string }
        Returns: undefined
      }
      criar_entrada_lote: {
        Args: {
          _custo_unitario: number
          _fornecedor: string
          _local_id: string
          _observacao: string
          _produto_id: string
          _quantidade: number
          _responsavel: string
          _validade: string
        }
        Returns: string
      }
      criar_inventario: {
        Args: {
          _produto_ids?: string[]
          _tipo: Database["public"]["Enums"]["inventario_tipo"]
          _titulo: string
        }
        Returns: string
      }
      criar_usuario: {
        Args: {
          _ativo: boolean
          _cargo: Database["public"]["Enums"]["user_cargo"]
          _nome: string
          _senha: string
          _setor: string
          _token: string
          _username: string
        }
        Returns: string
      }
      excluir_usuario: {
        Args: { _id: string; _token: string }
        Returns: undefined
      }
      exigir_mestre: { Args: { _token: string }; Returns: string }
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
      is_app_user: { Args: never; Returns: boolean }
      liberar_requisicao: {
        Args: {
          _liberacoes?: Json
          _requisicao_id: string
          _responsavel: string
        }
        Returns: undefined
      }
      listar_usuarios: {
        Args: { _token: string }
        Returns: {
          ativo: boolean
          cargo: Database["public"]["Enums"]["user_cargo"]
          id: string
          nome: string
          setor: string
          username: string
        }[]
      }
      login_usuario: {
        Args: { _senha: string; _username: string }
        Returns: {
          ativo: boolean
          cargo: Database["public"]["Enums"]["user_cargo"]
          id: string
          nome: string
          setor: string
          token: string
          username: string
        }[]
      }
      nf_ja_importada: {
        Args: { _chave: string }
        Returns: {
          existe: boolean
          numero: string
        }[]
      }
      registrar_saida_fefo: {
        Args: {
          _local_id: string
          _observacao: string
          _produto_id: string
          _quantidade: number
          _responsavel: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "estoquista" | "leitor"
      avaria_momento: "na_chegada" | "depois_chegada"
      avaria_status:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "recusado"
        | "descontado"
        | "resolvido"
      avaria_tipo:
        | "vencido"
        | "quebrado"
        | "danificado"
        | "perda_operacional"
        | "divergencia_contagem"
        | "outro"
      emprestimo_status: "pendente" | "devolvido" | "atrasado"
      emprestimo_tipo: "emprestamos" | "tomamos_emprestado"
      inventario_status: "aberto" | "em_conferencia" | "fechado"
      inventario_tipo: "rapido" | "parcial" | "completo"
      requisicao_status: "pendente" | "liberada" | "cancelada"
      user_cargo: "mestre" | "estoquista" | "lider" | "requisitante"
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
      avaria_momento: ["na_chegada", "depois_chegada"],
      avaria_status: [
        "pendente",
        "em_analise",
        "aprovado",
        "recusado",
        "descontado",
        "resolvido",
      ],
      avaria_tipo: [
        "vencido",
        "quebrado",
        "danificado",
        "perda_operacional",
        "divergencia_contagem",
        "outro",
      ],
      emprestimo_status: ["pendente", "devolvido", "atrasado"],
      emprestimo_tipo: ["emprestamos", "tomamos_emprestado"],
      inventario_status: ["aberto", "em_conferencia", "fechado"],
      inventario_tipo: ["rapido", "parcial", "completo"],
      requisicao_status: ["pendente", "liberada", "cancelada"],
      user_cargo: ["mestre", "estoquista", "lider", "requisitante"],
    },
  },
} as const
