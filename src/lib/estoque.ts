import { supabase } from "@/integrations/supabase/client";
import { upper } from "@/lib/utils";
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
  dias_seguranca: number;
  codigo_barras: string | null;
  codigo_caixa: string | null;
  unidades_por_caixa: number;
  local_padrao_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type LocalEstoque = {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Lote = {
  id: string;
  produto_id: string;
  local_id: string;
  validade: string | null;
  custo_unitario: number | null;
  quantidade_inicial: number;
  saldo: number;
  fornecedor: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  produtos?: { nome: string; unidade_medida: string } | null;
  locais_estoque?: { nome: string } | null;
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
  tipo: MovTipo;
  quantidade: number;
  data_movimentacao: string;
  observacao: string | null;
  responsavel: string | null;
  fornecedor: string | null;
  barco: string | null;
  lote_id: string | null;
  local_id: string | null;
  created_at: string;
  produtos?: { nome: string; unidade_medida: string } | null;
  locais_estoque?: { nome: string } | null;
};

export const CATEGORIAS = [
  "BEBIDA ALCOÓLICA",
  "BEBIDA NÃO ALCOÓLICA",
  "VINHOS",
  "FRUTAS E VERDURAS",
  "FRIOS",
  "SECOS",
  "LIMPEZA",
  "ESCRITÓRIO",
  "OUTROS",
] as const;


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

export function useLocais() {
  return useQuery({
    queryKey: ["locais_estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locais_estoque")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as LocalEstoque[];
    },
  });
}

export function useSaveLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: { id?: string; nome: string; ativo?: boolean }) => {
      if (l.id) {
        const { error } = await supabase
          .from("locais_estoque")
          .update({ nome: upper(l.nome), ativo: l.ativo ?? true })
          .eq("id", l.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("locais_estoque")
          .insert({ nome: upper(l.nome) });
        if (error) throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locais_estoque"] });
      toast.success("Local salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locais_estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locais_estoque"] });
      toast.success("Local removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLotes(produtoId?: string) {
  return useQuery({
    queryKey: ["lotes", produtoId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("lotes")
        .select("*, produtos(nome, unidade_medida), locais_estoque(nome)")
        .order("validade", { ascending: true, nullsFirst: false });
      if (produtoId) q = q.eq("produto_id", produtoId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Lote[];
    },
  });
}

export function useMovimentacoes(limit?: number) {
  return useQuery({
    queryKey: ["movimentacoes", limit ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes")
        .select("*, produtos(nome, unidade_medida), locais_estoque(nome)")
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
      const clean = { ...p, nome: upper(p.nome) };
      if (clean.categoria) clean.categoria = upper(clean.categoria);
      // estoque_inicial e estoque_atual não são mais editados pelo cadastro
      delete (clean as { estoque_inicial?: number }).estoque_inicial;
      delete (clean as { estoque_atual?: number }).estoque_atual;

      if (p.id) {
        const { error } = await supabase.from("produtos").update(clean).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(clean);
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
      qc.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Produto excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type NovaEntradaLote = {
  produto_id: string;
  local_id: string;
  quantidade: number;
  validade?: string | null;
  custo_unitario?: number | null;
  fornecedor?: string;
  observacao?: string;
  responsavel?: string;
};

export function useCriarEntradaLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: NovaEntradaLote) => {
      const { error } = await supabase.rpc("criar_entrada_lote", {
        _produto_id: e.produto_id,
        _local_id: e.local_id,
        _quantidade: e.quantidade,
        _validade: (e.validade ?? null) as unknown as string,
        _custo_unitario: (e.custo_unitario ?? null) as unknown as number,
        _fornecedor: e.fornecedor ?? "",
        _observacao: e.observacao ?? "",
        _responsavel: e.responsavel ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Entrada registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type NovaSaidaFefo = {
  produto_id: string;
  local_id?: string | null;
  quantidade: number;
  responsavel?: string;
  observacao?: string;
};

export function useRegistrarSaidaFefo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NovaSaidaFefo) => {
      const { error } = await supabase.rpc("registrar_saida_fefo", {
        _produto_id: s.produto_id,
        _local_id: (s.local_id ?? null) as unknown as string,
        _quantidade: s.quantidade,
        _responsavel: s.responsavel ?? "",
        _observacao: s.observacao ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Saída registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Compat: alguns lugares ainda chamam useRegistrarMovimentacao (scan.tsx).
// Encaminha para as novas RPCs.
export function useRegistrarMovimentacao() {
  const entrada = useCriarEntradaLote();
  const saida = useRegistrarSaidaFefo();
  return {
    isPending: entrada.isPending || saida.isPending,
    mutateAsync: async (m: {
      produto_id: string;
      tipo: "entrada" | "saida";
      quantidade: number;
      observacao?: string;
      responsavel?: string;
      fornecedor?: string;
      local_id?: string | null;
      validade?: string | null;
      custo_unitario?: number | null;
    }) => {
      if (m.tipo === "entrada") {
        if (!m.local_id) throw new Error("Local de estoque é obrigatório na entrada");
        await entrada.mutateAsync({
          produto_id: m.produto_id,
          local_id: m.local_id,
          quantidade: m.quantidade,
          validade: m.validade ?? null,
          custo_unitario: m.custo_unitario ?? null,
          fornecedor: m.fornecedor,
          observacao: m.observacao,
          responsavel: m.responsavel,
        });
      } else {
        await saida.mutateAsync({
          produto_id: m.produto_id,
          local_id: m.local_id ?? null,
          quantidade: m.quantidade,
          responsavel: m.responsavel,
          observacao: m.observacao,
        });
      }
    },
  };
}
