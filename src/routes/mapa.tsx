import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useProdutos, useMovimentacoes } from "@/lib/estoque";
import { Search } from "lucide-react";

export const Route = createFileRoute("/mapa")({
  component: MapaPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

function MapaPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [q, setQ] = useState("");

  const { data: produtos = [] } = useProdutos();
  const { data: movs = [] } = useMovimentacoes();

  const grid = useMemo(() => {
    const map = new Map<string, Map<number, { in: number; out: number }>>();
    for (const m of movs) {
      const d = new Date(m.data_movimentacao);
      if (d.getMonth() !== mes || d.getFullYear() !== ano) continue;
      const dia = d.getDate();
      if (!map.has(m.produto_id)) map.set(m.produto_id, new Map());
      const row = map.get(m.produto_id)!;
      const cell = row.get(dia) ?? { in: 0, out: 0 };
      if (m.tipo === "entrada") cell.in += Number(m.quantidade);
      else cell.out += Number(m.quantidade);
      row.set(dia, cell);
    }
    return map;
  }, [movs, mes, ano]);

  const produtosFiltrados = useMemo(
    () => produtos.filter((p) => p.nome.toLowerCase().includes(q.toLowerCase())),
    [produtos, q],
  );

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const fmt = (n: number) =>
    n === 0 ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa de Movimentação</h1>
          <p className="text-sm text-muted-foreground">
            Entradas e saídas diárias por produto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 w-[220px]"
            />
          </div>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="border-collapse text-xs w-full">
            <thead className="sticky top-0 z-30 bg-card">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-40 bg-card border-b border-r border-border px-3 py-2 text-left font-semibold min-w-[200px]"
                >
                  Produto
                </th>
                {DIAS.map((d) => (
                  <th
                    key={d}
                    colSpan={2}
                    className="border-b border-r border-border px-2 py-1 text-center font-semibold tabular-nums bg-muted/30"
                  >
                    {d}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="sticky right-0 z-40 bg-card border-b border-l border-border px-3 py-2 text-right font-semibold min-w-[90px]"
                >
                  Saldo
                </th>
              </tr>
              <tr>
                {DIAS.map((d) => (
                  <Fragment key={d}>
                    <th
                      className="border-b border-border px-1.5 py-1 text-center font-medium text-[10px] text-emerald-500 bg-muted/10"
                    >
                      IN
                    </th>
                    <th
                      className="border-b border-r border-border px-1.5 py-1 text-center font-medium text-[10px] text-rose-500 bg-muted/10"
                    >
                      OUT
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map((p, idx) => {
                const row = grid.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className={idx % 2 ? "bg-muted/10" : ""}
                  >
                    <td
                      className={`sticky left-0 z-20 border-b border-r border-border px-3 py-1.5 font-medium whitespace-nowrap ${
                        idx % 2 ? "bg-card" : "bg-card"
                      }`}
                    >
                      <div className="flex flex-col leading-tight">
                        <span>{p.nome}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.categoria} · {p.unidade_medida}
                        </span>
                      </div>
                    </td>
                    {DIAS.map((d) => {
                      const cell = row?.get(d);
                      return (
                        <Fragment key={d}>
                          <td
                            className="border-b border-border px-1.5 py-1 text-center tabular-nums text-emerald-500"
                          >
                            {cell ? fmt(cell.in) : ""}
                          </td>
                          <td
                            className="border-b border-r border-border px-1.5 py-1 text-center tabular-nums text-rose-500"
                          >
                            {cell ? fmt(cell.out) : ""}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td
                      className={`sticky right-0 z-20 border-b border-l border-border px-3 py-1.5 text-right font-semibold tabular-nums ${
                        p.estoque_atual <= p.estoque_minimo
                          ? "text-rose-500"
                          : ""
                      } bg-card`}
                    >
                      {fmt(Number(p.estoque_atual))}
                    </td>
                  </tr>
                );
              })}
              {produtosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={DIAS.length * 2 + 2}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
