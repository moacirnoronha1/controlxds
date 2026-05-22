import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type InventarioStatus = "aberto" | "em_conferencia" | "fechado";
export type InventarioTipo = "rapido" | "parcial" | "completo";

export type Inventario = {
  id: string;
  referencia: string;
  tipo: InventarioTipo;
  status: InventarioStatus;
  titulo: string | null;
  observacao: string | null;
  criado_por: string | null;
  fechado_por: string | null;
  fechado_em: string | null;
  created_at: string;
  updated_at: string;
};

export type InventarioItem = {
  id: string;
  inventario_id: string;
  produto_id: string;
  estoque_sistema: number;
  contagem_fisica: number | null;
  diferenca: number;
  observacao: string | null;
  contado_por: string | null;
  contado_em: string | null;
  produtos?: { nome: string; unidade_medida: string; categoria: string } | null;
};

export const STATUS_LABEL: Record<InventarioStatus, string> = {
  aberto: "Aberto",
  em_conferencia: "Em conferência",
  fechado: "Fechado",
};

export const TIPO_LABEL: Record<InventarioTipo, string> = {
  rapido: "Rápido",
  parcial: "Parcial",
  completo: "Completo",
};

export function useInventarios(mes?: string) {
  return useQuery({
    queryKey: ["inventarios", mes ?? "all"],
    queryFn: async () => {
      let q = supabase.from("inventarios").select("*").order("created_at", { ascending: false });
      if (mes) {
        const [y, m] = mes.split("-").map(Number);
        const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
        const end = new Date(y, m, 1).toISOString().slice(0, 10);
        q = q.gte("referencia", start).lt("referencia", end);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Inventario[];
    },
  });
}

export function useInventario(id: string | undefined) {
  return useQuery({
    queryKey: ["inventario", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventarios").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Inventario | null;
    },
  });
}

export function useInventarioItens(id: string | undefined) {
  return useQuery({
    queryKey: ["inventario-itens", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_itens")
        .select("*, produtos(nome, unidade_medida, categoria)")
        .eq("inventario_id", id!)
        .order("created_at");
      if (error) throw error;
      return data as InventarioItem[];
    },
  });
}

export function useCriarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { tipo: InventarioTipo; titulo: string; produto_ids?: string[] }) => {
      const { data, error } = await supabase.rpc("criar_inventario", {
        _tipo: v.tipo,
        _titulo: v.titulo,
        ...(v.produto_ids ? { _produto_ids: v.produto_ids } : {}),
      });
      if (error) throw error;
      return data as string;

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      toast.success("Inventário criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAtualizarContagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; contagem_fisica: number | null; observacao?: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("inventario_itens")
        .update({
          contagem_fisica: v.contagem_fisica,
          observacao: v.observacao ?? null,
          contado_por: u.user?.id ?? null,
          contado_em: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["inventario-itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFecharInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fechar_inventario", { _inventario_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["inventario-itens"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success("Inventário fechado e estoque ajustado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      toast.success("Inventário excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
