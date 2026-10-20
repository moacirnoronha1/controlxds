import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ValidadeSolicitacao = {
  id: string;
  lote_id: string;
  produto_id: string;
  validade_antiga: string | null;
  validade_nova: string;
  motivo: string;
  solicitado_por: string;
  status: "pendente" | "aprovado" | "recusado";
  decidido_por: string | null;
  decisao_motivo: string | null;
  decidido_em: string | null;
  created_at: string;
  produtos?: { nome: string } | null;
  lotes?: { saldo: number; locais_estoque?: { nome: string } | null } | null;
};

export function useValidadeSolicitacoes() {
  return useQuery({
    queryKey: ["validade_solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validade_solicitacoes")
        .select("*, produtos(nome), lotes(saldo, locais_estoque(nome))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ValidadeSolicitacao[];
    },
  });
}

export function useSolicitarValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { lote_id: string; validade_nova: string; motivo: string }) => {
      const { error } = await supabase.rpc("solicitar_alteracao_validade", {
        _lote_id: p.lote_id, _validade_nova: p.validade_nova, _motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["validade_solicitacoes"] });
      toast.success("Solicitação enviada — aguardando aprovação do Mestre");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecidirValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; aprovar: boolean; motivo?: string }) => {
      const { error } = await supabase.rpc("decidir_alteracao_validade", {
        _id: p.id, _aprovar: p.aprovar, _motivo: p.motivo ?? "",
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["validade_solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["lotes"] });
      toast.success(v.aprovar ? "Validade alterada" : "Solicitação recusada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
