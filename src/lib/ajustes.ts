import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type AjusteTipo = "entrada" | "saida" | "correcao";
export type AjusteStatus = "pendente" | "aprovado" | "recusado";

export const AJUSTE_TIPO_LABEL: Record<AjusteTipo, string> = {
  entrada: "Entrada",
  saida: "Saída",
  correcao: "Correção",
};

export const AJUSTE_STATUS_LABEL: Record<AjusteStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export type AjusteEstoque = {
  id: string;
  produto_id: string;
  local_id: string | null;
  lote_id: string | null;
  tipo: AjusteTipo;
  quantidade: number;
  motivo: string | null;
  solicitado_por: string | null;
  decidido_por: string | null;
  decisao_motivo: string | null;
  status: AjusteStatus;
  saldo_antes: number | null;
  saldo_depois: number | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  produtos?: { nome: string; unidade_medida: string } | null;
  locais_estoque?: { nome: string } | null;
  lotes?: { validade: string | null } | null;
};

export function useAjustes() {
  return useQuery({
    queryKey: ["ajustes_estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ajustes_estoque")
        .select("*, produtos(nome, unidade_medida), locais_estoque(nome), lotes(validade)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AjusteEstoque[];
    },
  });
}

export type NovoAjuste = {
  produto_id: string;
  local_id?: string | null;
  lote_id?: string | null;
  tipo: AjusteTipo;
  quantidade: number;
  motivo?: string | null;
  solicitado_por: string;
};

export function useCriarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NovoAjuste) => {
      const { error } = await supabase.from("ajustes_estoque").insert({
        produto_id: a.produto_id,
        local_id: a.local_id ?? null,
        lote_id: a.lote_id ?? null,
        tipo: a.tipo,
        quantidade: a.quantidade,
        motivo: a.motivo ?? null,
        solicitado_por: a.solicitado_por,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ajustes_estoque"] });
      toast.success("Ajuste solicitado — aguardando aprovação");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function invalidateEstoque(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["ajustes_estoque"] });
  qc.invalidateQueries({ queryKey: ["produtos"] });
  qc.invalidateQueries({ queryKey: ["lotes"] });
  qc.invalidateQueries({ queryKey: ["movimentacoes"] });
}

export function useAprovarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; responsavel: string }) => {
      const { error } = await supabase.rpc("aprovar_ajuste", {
        _ajuste_id: p.id,
        _responsavel: p.responsavel,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEstoque(qc);
      toast.success("Ajuste aprovado e estoque atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecusarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; responsavel: string; motivo: string }) => {
      const { error } = await supabase.rpc("recusar_ajuste", {
        _ajuste_id: p.id,
        _responsavel: p.responsavel,
        _motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEstoque(qc);
      toast.success("Ajuste recusado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
