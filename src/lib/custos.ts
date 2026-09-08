import { useMemo } from "react";
import { useLotes, type Lote } from "@/lib/estoque";

export type EntradaCusto = {
  lote_id: string;
  produto_id: string;
  data: string;
  fornecedor: string | null;
  validade: string | null;
  local: string | null;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
};

export type IndicadoresCusto = {
  ultimo: number | null;
  anterior: number | null;
  medioPonderado: number | null;
  menor: number | null;
  maior: number | null;
  /** Variação percentual entre último e anterior (ex.: 37.5) */
  variacao: number | null;
  alerta: boolean;
  entradas: EntradaCusto[];
};

export const LIMITE_VARIACAO = 20; // %

export function lotesParaEntradas(lotes: Lote[]): EntradaCusto[] {
  return lotes
    .filter((l) => l.custo_unitario != null && Number(l.custo_unitario) > 0)
    .map((l) => {
      const q = Number(l.quantidade_inicial) || 0;
      const cu = Number(l.custo_unitario);
      return {
        lote_id: l.id,
        produto_id: l.produto_id,
        data: l.created_at,
        fornecedor: l.fornecedor,
        validade: l.validade,
        local: l.locais_estoque?.nome ?? null,
        quantidade: q,
        custoUnitario: cu,
        custoTotal: q * cu,
      };
    })
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

export function calcularIndicadores(entradas: EntradaCusto[]): IndicadoresCusto {
  if (entradas.length === 0) {
    return {
      ultimo: null, anterior: null, medioPonderado: null,
      menor: null, maior: null, variacao: null, alerta: false, entradas,
    };
  }
  const ultimo = entradas[entradas.length - 1].custoUnitario;
  const anterior = entradas.length > 1 ? entradas[entradas.length - 2].custoUnitario : null;
  let somaQtd = 0;
  let somaValor = 0;
  let menor = Infinity;
  let maior = -Infinity;
  for (const e of entradas) {
    somaQtd += e.quantidade;
    somaValor += e.custoTotal;
    if (e.custoUnitario < menor) menor = e.custoUnitario;
    if (e.custoUnitario > maior) maior = e.custoUnitario;
  }
  const medioPonderado = somaQtd > 0 ? somaValor / somaQtd : null;
  const variacao = anterior && anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : null;
  return {
    ultimo,
    anterior,
    medioPonderado,
    menor: isFinite(menor) ? menor : null,
    maior: isFinite(maior) ? maior : null,
    variacao,
    alerta: variacao != null && Math.abs(variacao) > LIMITE_VARIACAO,
    entradas,
  };
}

/** Indicadores de custo por produto, a partir de todos os lotes. */
export function useCustosPorProduto() {
  const { data: lotes = [], isLoading } = useLotes();
  const mapa = useMemo(() => {
    const entradas = lotesParaEntradas(lotes);
    const porProduto = new Map<string, EntradaCusto[]>();
    for (const e of entradas) {
      const arr = porProduto.get(e.produto_id) ?? [];
      arr.push(e);
      porProduto.set(e.produto_id, arr);
    }
    const out = new Map<string, IndicadoresCusto>();
    for (const [pid, arr] of porProduto) out.set(pid, calcularIndicadores(arr));
    return out;
  }, [lotes]);
  return { indicadores: mapa, isLoading };
}

export const fmtMoeda = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtVariacao = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
