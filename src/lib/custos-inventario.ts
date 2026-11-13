import type { Lote } from "@/lib/estoque";
import type { InventarioItem } from "@/lib/inventario";

/** Custo médio ponderado por produto usando só entradas/lotes com custo > 0 até a data de corte. */
export function custoMedioAte(lotes: Pick<Lote, "produto_id" | "custo_unitario" | "quantidade_inicial" | "created_at">[], dataCorte: string) {
  const corte = new Date(dataCorte).getTime();
  const acc = new Map<string, { q: number; v: number }>();
  for (const l of lotes) {
    const cu = Number(l.custo_unitario);
    const q = Number(l.quantidade_inicial) || 0;
    if (!(cu > 0) || q <= 0) continue;
    if (new Date(l.created_at).getTime() > corte) continue;
    const a = acc.get(l.produto_id) ?? { q: 0, v: 0 };
    a.q += q;
    a.v += q * cu;
    acc.set(l.produto_id, a);
  }
  const out = new Map<string, number>();
  for (const [pid, a] of acc) if (a.q > 0) out.set(pid, a.v / a.q);
  return out;
}

export type LinhaFinanceira = { item: InventarioItem; custo: number | null; diferenca: number | null; valor: number | null };

export type ResumoFinanceiro = { sobra: number; falta: number; liquido: number; semCusto: number };

export function analiseFinanceira(itens: InventarioItem[], custos: Map<string, number>) {
  const linhas: LinhaFinanceira[] = [];
  const r: ResumoFinanceiro = { sobra: 0, falta: 0, liquido: 0, semCusto: 0 };
  for (const it of itens) {
    const custo = custos.get(it.produto_id) ?? null;
    const diferenca = it.contagem_fisica == null ? null : Number(it.contagem_fisica) - Number(it.estoque_sistema);
    const valor = diferenca == null || custo == null ? null : diferenca * custo;
    if (diferenca != null && diferenca !== 0) {
      if (valor == null) r.semCusto++;
      else if (valor > 0) r.sobra += valor;
      else r.falta += -valor;
    }
    linhas.push({ item: it, custo, diferenca, valor });
  }
  r.liquido = r.sobra - r.falta;
  return { linhas, resumo: r };
}

export const SEM_CUSTO = "Custo não informado";
