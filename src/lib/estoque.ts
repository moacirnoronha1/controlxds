import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  estoque_inicial: number;
  estoque_atual: number;
  estoque_minimo: number;
  codigo_barras: string | null;
  codigo_caixa: string | null;
  unidades_por_caixa: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ScanMatch = {
  produto: Produto;
  tipo_codigo: "unidade" | "caixa";
  multiplicador: number;
};

export async function findProdutoByCodigo(codigo: string): Promise<ScanMatch | null> {
  const c = codigo.trim();
  if (!c) return null;
  const { data: porUnidade, error: e1 } = await supabase
    .from("produtos")
    .select("*")
    .eq("codigo_barras", c)
    .eq("ativo", true)
    .maybeSingle();
  if (e1) throw e1;
  if (porUnidade) {
    return { produto: porUnidade as Produto, tipo_codigo: "unidade", multiplicador: 1 };
  }
  const { data: porCaixa, error: e2 } = await supabase
    .from("produtos")
    .select("*")
    .eq("codigo_caixa", c)
    .eq("ativo", true)
    .maybeSingle();
  if (e2) throw e2;
  if (porCaixa) {
    const p = porCaixa as Produto;
    return { produto: p, tipo_codigo: "caixa", multiplicador: Number(p.unidades_por_caixa) || 1 };
  }
  return null;
}

export type Movimentacao = {
  id: string;
  produto_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  data_movimentacao: string;
  observacao: string | null;
  responsavel: string | null;
  fornecedor: string | null;
  barco: string | null;
  created_at: string;
  produtos?: { nome: string; unidade_medida: string } | null;
};

export const CATEGORIAS = ["Secos", "Frios", "Bebidas", "Limpeza", "Cozinha", "Outros"] as const;
export const UNIDADES = ["un", "kg", "g", "L", "mL", "cx", "pct", "dz"] as const;

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });
}

export function useMovimentacoes(limit?: number) {
  return useQuery({
    queryKey: ["movimentacoes", limit ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes")
        .select("*, produtos(nome, unidade_medida)")
        .order("data_movimentacao", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as Movimentacao[];
    },
  });
}

export function useSaveProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Produto> & { nome: string }) => {
      if (p.id) {
        const { error } = await supabase.from("produtos").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const payload = { ...p, estoque_atual: p.estoque_inicial ?? 0 };
        const { error } = await supabase.from("produtos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success("Produto excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: {
      produto_id: string;
      tipo: "entrada" | "saida";
      quantidade: number;
      observacao?: string;
      responsavel?: string;
      fornecedor?: string;
      barco?: string;
    }) => {
      const { error } = await supabase.from("movimentacoes").insert(m);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success(v.tipo === "entrada" ? "Entrada registrada" : "Saída registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
