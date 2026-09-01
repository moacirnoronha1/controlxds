import type { Movimentacao, Produto } from "@/lib/estoque";

export const LEAD_TIME_DIAS = 10;
export const JANELA_MEDIA_DIAS = 10;

/** Saída gerada por requisição liberada (observação criada pela RPC liberar_requisicao). */
export function isSaidaRequisicao(m: Movimentacao) {
  return m.tipo === "saida" && (m.observacao ?? "").toUpperCase().includes("REQUISIÇÃO #");
}

export type MinimoInfo = {
  mediaDiaria: number;
  diasSeguranca: number;
  minimoAuto: number;
  /** Mínimo usado nos alertas: o maior entre o manual e o automático. */
  minimoEfetivo: number;
  baixo: boolean;
};

/**
 * Estoque mínimo automático =
 *   média diária de saída (requisições liberadas, últimos 10 dias)
 *   × (lead time 10 dias + dias de segurança do produto)
 */
export function calcularMinimos(
  produtos: Produto[],
  movs: Movimentacao[],
): Map<string, MinimoInfo> {
  const DAY = 86400000;
  const cutoff = Date.now() - JANELA_MEDIA_DIAS * DAY;

  const totalPorProduto = new Map<string, number>();
  for (const m of movs) {
    if (!isSaidaRequisicao(m)) continue;
    if (new Date(m.data_movimentacao).getTime() < cutoff) continue;
    totalPorProduto.set(
      m.produto_id,
      (totalPorProduto.get(m.produto_id) ?? 0) + Number(m.quantidade),
    );
  }

  const out = new Map<string, MinimoInfo>();
  for (const p of produtos) {
    const mediaDiaria = (totalPorProduto.get(p.id) ?? 0) / JANELA_MEDIA_DIAS;
    const diasSeguranca = Number(p.dias_seguranca ?? 0) || 0;
    const minimoAuto = Math.ceil(mediaDiaria * (LEAD_TIME_DIAS + diasSeguranca));
    const minimoEfetivo = Math.max(Number(p.estoque_minimo) || 0, minimoAuto);
    out.set(p.id, {
      mediaDiaria,
      diasSeguranca,
      minimoAuto,
      minimoEfetivo,
      baixo: Number(p.estoque_atual) <= minimoEfetivo,
    });
  }
  return out;
}
