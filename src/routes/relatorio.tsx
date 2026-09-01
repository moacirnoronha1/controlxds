import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProdutos, useMovimentacoes, useLotes } from "@/lib/estoque";
import { calcularMinimos, LEAD_TIME_DIAS } from "@/lib/estoque-minimo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, DollarSign, MapPin, Package } from "lucide-react";

export const Route = createFileRoute("/relatorio")({
  component: RelatorioPage,
  head: () => ({ meta: [{ title: "Relatório de Consumo" }] }),
});

function RelatorioPage() {
  const { data: produtos = [] } = useProdutos();
  const { data: movs = [] } = useMovimentacoes();
  const { data: lotes = [] } = useLotes();
  const [search, setSearch] = useState("");
  const minimos = useMemo(() => calcularMinimos(produtos, movs), [produtos, movs]);

  const linhas = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;

    const consumoPorProduto = new Map<string, { d: number; q: number }[]>();
    for (const m of movs) {
      if (m.tipo !== "saida") continue;
      const arr = consumoPorProduto.get(m.produto_id) ?? [];
      arr.push({
        d: new Date(m.data_movimentacao).getTime(),
        q: Number(m.quantidade),
      });
      consumoPorProduto.set(m.produto_id, arr);
    }

    const mediaPeriodo = (arr: { d: number; q: number }[], dias: number) => {
      const cutoff = now - dias * DAY;
      const total = arr
        .filter((x) => x.d >= cutoff)
        .reduce((s, x) => s + x.q, 0);
      return total / dias;
    };

    return produtos.map((p) => {
      const arr = consumoPorProduto.get(p.id) ?? [];
      const m5 = mediaPeriodo(arr, 5);
      const m10 = mediaPeriodo(arr, 10);
      const m15 = mediaPeriodo(arr, 15);
      const m20 = mediaPeriodo(arr, 20);
      const m30 = mediaPeriodo(arr, 30);
      const ref = m10 || m5 || m30;
      const previsao = ref > 0 ? p.estoque_atual / ref : Infinity;
      const cobertura = 30; // dias-alvo
      const necessidade = ref * cobertura;
      const sugestaoBruta = necessidade - p.estoque_atual;
      const sugestao = ref > 0 && sugestaoBruta > 0 ? Math.ceil(sugestaoBruta) : 0;
      const info = minimos.get(p.id);
      const minimoAuto = info?.minimoAuto ?? 0;
      const minimoEfetivo = info?.minimoEfetivo ?? Number(p.estoque_minimo) || 0;
      const reposicao = Math.max(0, Math.ceil(minimoEfetivo - Number(p.estoque_atual)));
      return { p, m5, m10, m15, m20, m30, previsao, sugestao, minimoAuto, reposicao };
    });
  }, [produtos, movs, minimos]);


  const filtradas = useMemo(
    () =>
      linhas.filter((l) =>
        l.p.nome.toLowerCase().includes(search.toLowerCase()),
      ),
    [linhas, search],
  );

  const mediasRef = linhas.map((l) => l.m30).filter((v) => v > 0);
  const sorted = [...mediasRef].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const q2 = sorted[Math.floor((sorted.length * 2) / 3)] ?? 0;

  const nivel = (v: number) => {
    if (v <= 0) return { label: "Sem consumo", cls: "bg-muted text-muted-foreground" };
    if (v < q1 || q1 === 0) return { label: "Baixo", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    if (v < q2) return { label: "Médio", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: "Alto", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  };

  const fmt = (n: number) =>
    n === 0 ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  const fmtPrev = (d: number) => {
    if (!isFinite(d)) return "—";
    if (d > 365) return ">1 ano";
    return `${Math.round(d)} dias`;
  };

  const fmtMoney = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Custos por lote/categoria/local (a partir dos lotes com saldo > 0 e custo definido)
  const custos = useMemo(() => {
    const produtoById = new Map(produtos.map((p) => [p.id, p]));
    const porCategoria = new Map<string, number>();
    const porLocal = new Map<string, number>();
    type LinhaLote = {
      id: string;
      produto: string;
      categoria: string;
      local: string;
      validade: string | null;
      saldo: number;
      custoUnit: number;
      custoTotal: number;
    };
    const porLote: LinhaLote[] = [];
    let totalGeral = 0;

    for (const l of lotes) {
      const saldo = Number(l.saldo);
      if (saldo <= 0 || l.custo_unitario == null) continue;
      const cu = Number(l.custo_unitario);
      const total = cu * saldo;
      const p = produtoById.get(l.produto_id);
      const cat = p?.categoria ?? "—";
      const loc = l.locais_estoque?.nome ?? "—";
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + total);
      porLocal.set(loc, (porLocal.get(loc) ?? 0) + total);
      porLote.push({
        id: l.id,
        produto: p?.nome ?? "—",
        categoria: cat,
        local: loc,
        validade: l.validade,
        saldo,
        custoUnit: cu,
        custoTotal: total,
      });
      totalGeral += total;
    }

    porLote.sort((a, b) => b.custoTotal - a.custoTotal);

    return {
      totalGeral,
      porCategoria: Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]),
      porLocal: Array.from(porLocal.entries()).sort((a, b) => b[1] - a[1]),
      porLote,
    };
  }, [lotes, produtos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Relatório de Consumo
          </h1>
          <p className="text-sm text-muted-foreground">
            Média de saídas e previsão de duração do estoque.
          </p>
        </div>
        <Input
          placeholder="Filtrar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Produto</TableHead>
              <TableHead className="text-right">Média 5d</TableHead>
              <TableHead className="text-right">Média 10d</TableHead>
              <TableHead className="text-right">Média 15d</TableHead>
              <TableHead className="text-right">Média 20d</TableHead>
              <TableHead className="text-right">Média mensal</TableHead>
              <TableHead className="text-right">Estoque atual</TableHead>
              <TableHead className="text-right">
                Mín. automático ({LEAD_TIME_DIAS}d)
              </TableHead>
              <TableHead className="text-right">Repor até o mínimo</TableHead>
              <TableHead className="text-right">Previsão</TableHead>
              <TableHead className="text-right">Sugestão compra (30d)</TableHead>
              <TableHead>Consumo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map(({ p, m5, m10, m15, m20, m30, previsao, sugestao, minimoAuto, reposicao }) => {
                const n = nivel(m30);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.nome}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.unidade_medida}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m5)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m10)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m15)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(m20)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {fmt(m30)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.estoque_atual}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPrev(previsao)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {sugestao > 0 ? (
                        <span className="text-amber-400">
                          {sugestao} {p.unidade_medida}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={n.cls}>
                        {n.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })

            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Custo total por categoria</span>
            <Badge variant="outline" className="ml-auto">{fmtMoney(custos.totalGeral)}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custos.porCategoria.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">Sem lotes com custo informado</TableCell></TableRow>
              ) : custos.porCategoria.map(([cat, v]) => (
                <TableRow key={cat}>
                  <TableCell>{cat}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtMoney(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Custo total por local de estoque</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custos.porLocal.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">Sem lotes com custo informado</TableCell></TableRow>
              ) : custos.porLocal.map(([loc, v]) => (
                <TableRow key={loc}>
                  <TableCell>{loc}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtMoney(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Custo total por lote</span>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Custo un.</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custos.porLote.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum lote com custo informado</TableCell></TableRow>
              ) : custos.porLote.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.produto}</TableCell>
                  <TableCell><Badge variant="outline">{l.categoria}</Badge></TableCell>
                  <TableCell>{l.local}</TableCell>
                  <TableCell className="tabular-nums">
                    {l.validade ? new Date(l.validade).toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.saldo}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(l.custoUnit)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtMoney(l.custoTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
