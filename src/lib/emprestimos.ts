import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type EmprestimoTipo = "emprestamos" | "tomamos_emprestado";
export type EmprestimoStatus = "pendente" | "devolvido" | "atrasado";

export type Emprestimo = {
  id: string;
  tipo: EmprestimoTipo;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  unidade_medida: string | null;
  origem: string | null;
  destino: string | null;
  responsavel: string | null;
  data_emprestimo: string;
  previsao_devolucao: string | null;
  data_devolucao: string | null;
  observacao: string | null;
  status: EmprestimoStatus;
  local_id: string | null;
  lote_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useEmprestimos() {
  return useQuery({
    queryKey: ["emprestimos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select("*")
        .order("data_emprestimo", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Marcar atrasados no cliente (sem alterar no banco)
      const hoje = new Date().toISOString().slice(0, 10);
      return (data as Emprestimo[]).map((e) => {
        if (
          e.status === "pendente" &&
          e.previsao_devolucao &&
          e.previsao_devolucao < hoje
        ) {
          return { ...e, status: "atrasado" as const };
        }
        return e;
      });
    },
  });
}

function invalidarEstoque(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["emprestimos"] });
  qc.invalidateQueries({ queryKey: ["produtos"] });
  qc.invalidateQueries({ queryKey: ["lotes"] });
  qc.invalidateQueries({ queryKey: ["movimentacoes"] });
}

export function useCriarEmprestimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      tipo: EmprestimoTipo;
      produto_id: string;
      produto_nome: string;
      quantidade: number;
      unidade_medida?: string | null;
      local_id: string;
      lote_id?: string | null;
      origem?: string | null;
      destino?: string | null;
      responsavel: string;
      data_emprestimo: string;
      previsao_devolucao: string;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.rpc("registrar_emprestimo", {
        _tipo: p.tipo,
        _produto_id: p.produto_id,
        _produto_nome: p.produto_nome,
        _quantidade: p.quantidade,
        _unidade_medida: p.unidade_medida ?? null,
        _local_id: p.local_id,
        _lote_id: p.lote_id ?? null,
        _origem: p.origem ?? null,
        _destino: p.destino ?? null,
        _responsavel: p.responsavel,
        _data_emprestimo: p.data_emprestimo,
        _previsao_devolucao: p.previsao_devolucao,
        _observacao: p.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarEstoque(qc);
      toast.success("Empréstimo registrado e estoque atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDevolverEmprestimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; data: string; responsavel?: string | null }) => {
      const { error } = await supabase.rpc("devolver_emprestimo", {
        _id: p.id,
        _data: p.data,
        _responsavel: p.responsavel ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarEstoque(qc);
      toast.success("Devolução registrada e estoque atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEmprestimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emprestimos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emprestimos"] });
      toast.success("Empréstimo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
