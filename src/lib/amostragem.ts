import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Produto } from "@/lib/estoque";

export type Amostragem = {
  id: string;
  data: string;
  responsavel: string | null;
  local_id: string | null;
  observacao: string | null;
  fechado_em: string | null;
  created_at: string;
  updated_at: string;
  locais_estoque?: { nome: string } | null;
};

export type AmostragemItem = {
  id: string;
  amostragem_id: string;
  produto_id: string;
  categoria: string | null;
  local_nome: string | null;
  estoque_sistema: number;
  contagem_fisica: number | null;
  diferenca: number | null;
  observacao: string | null;
  produtos?: { nome: string; unidade_medida: string } | null;
};

export const ITENS_POR_RELATORIO = 5;

/** Sorteio aleatório sem repetição, variando categorias enquanto houver produtos. */
export function sortearProdutos(produtos: Produto[], quantidade = ITENS_POR_RELATORIO): Produto[] {
  const embaralhar = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const porCategoria = new Map<string, Produto[]>();
  for (const p of produtos) {
    const c = p.categoria || "OUTROS";
    porCategoria.set(c, [...(porCategoria.get(c) ?? []), p]);
  }

  const escolhidos: Produto[] = [];
  const usados = new Set<string>();

  // 1ª rodada: um produto por categoria (categorias em ordem aleatória)
  for (const cat of embaralhar([...porCategoria.keys()])) {
    if (escolhidos.length >= quantidade) break;
    const cand = embaralhar(porCategoria.get(cat)!).find((p) => !usados.has(p.id));
    if (cand) {
      escolhidos.push(cand);
      usados.add(cand.id);
    }
  }

  // Completa com qualquer produto restante
  for (const p of embaralhar(produtos)) {
    if (escolhidos.length >= quantidade) break;
    if (!usados.has(p.id)) {
      escolhidos.push(p);
      usados.add(p.id);
    }
  }

  return embaralhar(escolhidos);
}

export function useAmostragens() {
  return useQuery({
    queryKey: ["amostragens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amostragens")
        .select("*, locais_estoque(nome)")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Amostragem[];
    },
  });
}

export function useAmostragemItens(amostragemId?: string) {
  return useQuery({
    queryKey: ["amostragem_itens", amostragemId],
    enabled: !!amostragemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amostragem_itens")
        .select("*, produtos(nome, unidade_medida)")
        .eq("amostragem_id", amostragemId!)
        .order("created_at");
      if (error) throw error;
      return data as AmostragemItem[];
    },
  });
}

export type NovaAmostragem = {
  data: string;
  responsavel: string;
  local_id: string | null;
  local_nome: string | null;
  observacao?: string;
  itens: {
    produto_id: string;
    categoria: string | null;
    estoque_sistema: number;
  }[];
};

export function useCriarAmostragem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NovaAmostragem) => {
      const { data: rel, error } = await supabase
        .from("amostragens")
        .insert({
          data: a.data,
          responsavel: a.responsavel || null,
          local_id: a.local_id,
          observacao: a.observacao || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: e2 } = await supabase.from("amostragem_itens").insert(
        a.itens.map((i) => ({
          amostragem_id: rel.id as string,
          produto_id: i.produto_id,
          categoria: i.categoria,
          local_nome: a.local_nome,
          estoque_sistema: i.estoque_sistema,
        })),
      );
      if (e2) throw e2;
      return rel.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostragens"] });
      toast.success("Relatório de amostragem gerado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSalvarContagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: {
      id: string;
      amostragem_id: string;
      contagem_fisica: number | null;
      observacao: string | null;
      estoque_sistema: number;
    }) => {
      const diferenca =
        i.contagem_fisica === null ? null : Number(i.contagem_fisica) - Number(i.estoque_sistema);
      const { error } = await supabase
        .from("amostragem_itens")
        .update({
          contagem_fisica: i.contagem_fisica,
          diferenca,
          observacao: i.observacao,
        })
        .eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["amostragem_itens", v.amostragem_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirAmostragem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amostragens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amostragens"] });
      toast.success("Relatório excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
