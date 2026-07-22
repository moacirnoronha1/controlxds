import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type RequisicaoStatus = "pendente" | "liberada" | "cancelada";

export type Requisicao = {
  id: string;
  numero: number;
  data: string;
  requisitante: string;
  setor: string;
  responsavel_liberacao: string | null;
  status: RequisicaoStatus;
  observacao: string | null;
  liberada_em: string | null;
  cancelada_em: string | null;
  created_at: string;
};

export type RequisicaoItem = {
  id: string;
  requisicao_id: string;
  produto_id: string;
  codigo: string | null;
  quantidade_solicitada: number;
  quantidade_liberada: number | null;
  produtos?: { nome: string; unidade_medida: string; codigo_barras: string | null } | null;
};

export type Setor = { id: string; nome: string; ativo: boolean };
export type Responsavel = { id: string; nome: string; cargo: string | null; ativo: boolean };

export function useSetores() {
  return useQuery({
    queryKey: ["setores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*").order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });
}

export function useResponsaveis() {
  return useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("responsaveis").select("*").order("nome");
      if (error) throw error;
      return data as Responsavel[];
    },
  });
}

export function useSaveSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("setores").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setores"] }); toast.success("Setor adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("setores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["setores"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; cargo?: string }) => {
      const { error } = await supabase.from("responsaveis").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsaveis"] }); toast.success("Responsável adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["responsaveis"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRequisicoes() {
  return useQuery({
    queryKey: ["requisicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requisicoes")
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as Requisicao[];
    },
  });
}

export function useRequisicao(id: string | undefined) {
  return useQuery({
    queryKey: ["requisicao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: req, error } = await supabase
        .from("requisicoes")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      const { data: itens, error: e2 } = await supabase
        .from("requisicao_itens")
        .select("*, produtos(nome, unidade_medida, codigo_barras)")
        .eq("requisicao_id", id!);
      if (e2) throw e2;
      return { requisicao: req as Requisicao, itens: (itens ?? []) as unknown as RequisicaoItem[] };
    },
  });
}

export function useCriarRequisicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      requisitante: string;
      setor: string;
      observacao?: string;
      itens: { produto_id: string; codigo?: string | null; quantidade_solicitada: number }[];
    }) => {
      const { data: req, error } = await supabase
        .from("requisicoes")
        .insert({
          requisitante: p.requisitante,
          setor: p.setor,
          observacao: p.observacao ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const itens = p.itens.map((i) => ({ ...i, requisicao_id: req.id }));
      const { error: e2 } = await supabase.from("requisicao_itens").insert(itens);
      if (e2) throw e2;
      return req as Requisicao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      toast.success("Requisição criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLiberarRequisicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      responsavel: string;
      liberacoes: Record<string, number>;
    }) => {
      const { error } = await supabase.rpc("liberar_requisicao", {
        _requisicao_id: p.id,
        _responsavel: p.responsavel,
        _liberacoes: p.liberacoes,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      qc.invalidateQueries({ queryKey: ["requisicao", v.id] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Requisição liberada, estoque baixado (FEFO)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelarRequisicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancelar_requisicao", { _requisicao_id: id });
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      qc.invalidateQueries({ queryKey: ["requisicao", id] });
      toast.success("Requisição cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
