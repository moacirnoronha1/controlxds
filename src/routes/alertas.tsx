import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useProdutos, useLotes, useMovimentacoes } from "@/lib/estoque";
import { calcularMinimos, LEAD_TIME_DIAS } from "@/lib/estoque-minimo";
import { useEmprestimos } from "@/lib/emprestimos";
import {
  AlertTriangle, PackageX, CalendarClock, CalendarX, Repeat, DollarSign, HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/alertas")({
  component: AlertasPage,
  head: () => ({ meta: [{ title: "Alertas" }] }),
});

type Alerta = {
  tipo: "baixo" | "vencido" | "proximo" | "atrasado" | "sem_custo" | "sem_validade";
  titulo: string;
  detalhe: string;
  produto?: string;
};

function AlertasPage() {
  const { data: produtos = [] } = useProdutos();
  const { data: lotes = [] } = useLotes();
  const { data: emprestimos = [] } = useEmprestimos();
  const { data: movs = [] } = useMovimentacoes();
  const minimos = useMemo(() => calcularMinimos(produtos, movs), [produtos, movs]);

  const alertas = useMemo<Alerta[]>(() => {
    const out: Alerta[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Estoque baixo
    for (const p of produtos) {
      if (p.ativo && p.estoque_atual <= p.estoque_minimo) {
        out.push({
          tipo: "baixo",
          titulo: "Estoque baixo",
          produto: p.nome,
          detalhe: `${p.estoque_atual} ${p.unidade_medida} (mín. ${p.estoque_minimo})`,
        });
      }
    }

    // Vencidos / próximos por lote com saldo
    for (const l of lotes) {
      if (Number(l.saldo) <= 0) continue;
      if (!l.validade) continue;
      const val = new Date(l.validade);
      const diff = Math.round((val.getTime() - hoje.getTime()) / 86400000);
      if (diff < 0) {
        out.push({
          tipo: "vencido",
          titulo: "Lote vencido",
          produto: l.produtos?.nome,
          detalhe: `Venceu em ${val.toLocaleDateString("pt-BR")} · ${l.saldo} ${l.produtos?.unidade_medida ?? ""}`,
        });
      } else if (diff <= 30) {
        out.push({
          tipo: "proximo",
          titulo: "Próximo do vencimento",
          produto: l.produtos?.nome,
          detalhe: `Vence em ${diff} dia(s) · ${val.toLocaleDateString("pt-BR")}`,
        });
      }
    }

    // Empréstimos atrasados
    for (const e of emprestimos) {
      if (e.status === "atrasado") {
        out.push({
          tipo: "atrasado",
          titulo: "Empréstimo atrasado",
          produto: e.produto_nome,
          detalhe: `Previsto ${e.previsao_devolucao ? new Date(e.previsao_devolucao).toLocaleDateString("pt-BR") : "—"} · ${e.tipo === "emprestamos" ? "Emprestamos" : "Tomamos"}`,
        });
      }
    }

    // Produtos sem custo (todos os lotes ativos sem custo)
    const lotesPorProduto = new Map<string, typeof lotes>();
    for (const l of lotes) {
      if (Number(l.saldo) <= 0) continue;
      const arr = lotesPorProduto.get(l.produto_id) ?? [];
      arr.push(l);
      lotesPorProduto.set(l.produto_id, arr);
    }
    for (const [pid, lts] of lotesPorProduto) {
      const p = produtos.find((x) => x.id === pid);
      if (!p) continue;
      if (lts.every((l) => l.custo_unitario == null)) {
        out.push({
          tipo: "sem_custo",
          titulo: "Produto sem custo",
          produto: p.nome,
          detalhe: `${lts.length} lote(s) sem custo unitário`,
        });
      }
      if (lts.every((l) => !l.validade)) {
        out.push({
          tipo: "sem_validade",
          titulo: "Produto sem validade",
          produto: p.nome,
          detalhe: `${lts.length} lote(s) sem validade informada`,
        });
      }
    }

    return out;
  }, [produtos, lotes, emprestimos]);

  const grupos: { key: Alerta["tipo"]; label: string; icon: typeof AlertTriangle; cls: string }[] = [
    { key: "vencido", label: "Vencidos", icon: CalendarX, cls: "text-destructive" },
    { key: "proximo", label: "Próximos do vencimento", icon: CalendarClock, cls: "text-amber-500" },
    { key: "baixo", label: "Estoque baixo", icon: PackageX, cls: "text-destructive" },
    { key: "atrasado", label: "Empréstimos atrasados", icon: Repeat, cls: "text-amber-500" },
    { key: "sem_custo", label: "Sem custo", icon: DollarSign, cls: "text-muted-foreground" },
    { key: "sem_validade", label: "Sem validade", icon: HelpCircle, cls: "text-muted-foreground" },
  ];

  const total = alertas.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Alertas
        </h1>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "Nenhum alerta no momento." : `${total} alerta(s) ativos.`}
        </p>
      </div>

      {grupos.map(({ key, label, icon: Icon, cls }) => {
        const itens = alertas.filter((a) => a.tipo === key);
        if (itens.length === 0) return null;
        return (
          <Card key={key} className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Icon className={"h-4 w-4 " + cls} />
              <span className="font-semibold text-sm">{label}</span>
              <Badge variant="outline" className="ml-auto">{itens.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((a, i) => (
                  <TableRow key={key + i}>
                    <TableCell className="font-medium">{a.produto ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.detalhe}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      })}

      {total === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Tudo certo. Nenhum alerta ativo.
        </Card>
      )}
    </div>
  );
}
