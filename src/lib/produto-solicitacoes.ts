import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type SolicitacaoTipo = "inclusao" | "edicao" | "exclusao";
export type SolicitacaoStatus = "pendente" | "aprovado" | "recusado";

export const SOLICITACAO_TIPO_LABEL: Record<SolicitacaoTipo, string> = {
  inclusao: "Inclusão",
  edicao: "Edição",
  exclusao: "Exclusão",
};

export const SOLICITACAO_STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export type ProdutoSolicitacao = {
  id: string;
  tipo: SolicitacaoTipo;
  produto_id: string | null;
  produto_nome: string;
  dados_antes: Record<string, unknown> | null;
  dados_propostos: Record<string, unknown> | null;
  motivo: string | null;
  solicitado_por: string | null;
  status: SolicitacaoStatus;
  decidido_por: string | null;
  decisao_motivo: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
};

// A tabela é nova; o client tipado ainda não a conhece.
const table = () => (supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
}).from("produto_solicitacoes");

export function useProdutoSolicitacoes() {
  return useQuery({
    queryKey: ["produto_solicitacoes"],
    queryFn: async () => {
      const { data, error } = await table()
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoSolicitacao[];
    },
  });
}

export type NovaSolicitacaoProduto = {
  tipo: SolicitacaoTipo;
  produto_id?: string | null;
  produto_nome: string;
  dados_antes?: Record<string, unknown> | null;
  dados_propostos?: Record<string, unknown> | null;
  motivo?: string | null;
  solicitado_por: string;
};

export function useCriarSolicitacaoProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NovaSolicitacaoProduto) => {
      const { error } = await table().insert({
        tipo: s.tipo,
        produto_id: s.produto_id ?? null,
        produto_nome: s.produto_nome,
        dados_antes: s.dados_antes ?? null,
        dados_propostos: s.dados_propostos ?? null,
        motivo: s.motivo ?? null,
        solicitado_por: s.solicitado_por,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produto_solicitacoes"] });
      toast.success("Solicitação enviada — aguardando aprovação do Mestre");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["produto_solicitacoes"] });
  qc.invalidateQueries({ queryKey: ["produtos"] });
}

export function useAprovarSolicitacaoProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; responsavel: string }) => {
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: Error | null }>)("aprovar_produto_solicitacao", {
        _solicitacao_id: p.id,
        _responsavel: p.responsavel,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success("Solicitação aprovada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecusarSolicitacaoProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; responsavel: string; motivo: string }) => {
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: Error | null }>)("recusar_produto_solicitacao", {
        _solicitacao_id: p.id,
        _responsavel: p.responsavel,
        _motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success("Solicitação recusada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const CAMPO_LABEL: Record<string, string> = {
  nome: "Nome",
  categoria: "Categoria",
  unidade_medida: "Unidade",
  estoque_minimo: "Estoque mínimo",
  dias_seguranca: "Dias de segurança",
  codigo_barras: "Código de barras",
  codigo_caixa: "Código da caixa",
  unidades_por_caixa: "Unidades por caixa",
  local_padrao_id: "Local padrão",
  ativo: "Ativo",
};

export function diffCampos(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
) {
  const d = depois ?? {};
  const a = antes ?? {};
  return Object.keys(d)
    .filter((k) => String(a[k] ?? "") !== String(d[k] ?? ""))
    .map((k) => ({
      campo: CAMPO_LABEL[k] ?? k,
      de: a[k] === null || a[k] === undefined || a[k] === "" ? "—" : String(a[k]),
      para: d[k] === null || d[k] === undefined || d[k] === "" ? "—" : String(d[k]),
    }));
}
