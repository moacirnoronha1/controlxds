import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type DatabaseTableUsage = {
  tabela: string;
  registros: number;
  bytes: number;
};

export type DatabaseUsage = {
  database_bytes: number;
  tabelas: DatabaseTableUsage[];
  arquivaveis: Record<"requisicoes" | "inventarios" | "emprestimos" | "avarias", number>;
  testes_elegiveis: Record<"requisicoes" | "inventarios" | "emprestimos" | "avarias", number>;
  duplicidades_suspeitas: Record<"movimentacoes" | "itens_requisicao", number>;
  retencao_dias: number;
  arquivos_no_banco: boolean;
  gerado_em: string;
};

export function useDatabaseUsage() {
  return useQuery({
    queryKey: ["database-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_uso_banco");
      if (error) throw error;
      return data as unknown as DatabaseUsage;
    },
  });
}

export function useArchiveOldData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("arquivar_dados_antigos", { _dias: 180 });
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      const total = Object.entries(result)
        .filter(([key]) => key !== "sessoes_expiradas")
        .reduce((sum, [, value]) => sum + Number(value || 0), 0);
      toast.success(total ? `${total} registro(s) arquivado(s)` : "Nenhum registro antigo para arquivar");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCleanTestData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("limpar_dados_teste_seguros");
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      const total = Object.values(result).reduce((sum, value) => sum + Number(value || 0), 0);
      toast.success(total ? `${total} dado(s) de teste removido(s)` : "Nenhum dado de teste elegível");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}