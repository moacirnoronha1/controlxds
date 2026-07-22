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

export function useCriarEmprestimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      tipo: EmprestimoTipo;
      produto_id?: string | null;
      produto_nome: string;
      quantidade: number;
      unidade_medida?: string | null;
      origem?: string | null;
      destino?: string | null;
      responsavel?: string | null;
      data_emprestimo: string;
      previsao_devolucao?: string | null;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.from("emprestimos").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emprestimos"] });
      toast.success("Empréstimo registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDevolverEmprestimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; data: string }) => {
      const { error } = await supabase
        .from("emprestimos")
        .update({ status: "devolvido", data_devolucao: p.data })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emprestimos"] });
      toast.success("Devolução registrada");
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
