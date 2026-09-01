import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProdutos, useMovimentacoes } from "@/lib/estoque";
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const { role } = useAuth();
  if (role === "requisitante") return <Navigate to="/requisicoes" replace />;
  return <Dashboard />;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function Dashboard() {
  const { data: produtos = [] } = useProdutos();
  const { data: movs = [] } = useMovimentacoes();

  const minimos = useMemo(() => calcularMinimos(produtos, movs), [produtos, movs]);

  const stats = useMemo(() => {
    const baixo = produtos.filter((p) => p.ativo && (minimos.get(p.id)?.baixo ?? false));
    const entradasHoje = movs.filter((m) => m.tipo === "entrada" && isToday(m.data_movimentacao));
    const saidasHoje = movs.filter((m) => m.tipo === "saida" && isToday(m.data_movimentacao));
    return {
      total: produtos.length,
      baixo: baixo.length,
      entradasHoje: entradasHoje.reduce((a, b) => a + Number(b.quantidade), 0),
      saidasHoje: saidasHoje.reduce((a, b) => a + Number(b.quantidade), 0),
      baixoList: baixo,
    };
  }, [produtos, movs, minimos]);

  const consumoPorProduto = useMemo(() => {
    const map = new Map<string, number>();
    movs
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const nome = m.produtos?.nome || "—";
        map.set(nome, (map.get(nome) ?? 0) + Number(m.quantidade));
      });
    return Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [movs]);

  const cards = [
    { label: "Produtos cadastrados", value: stats.total, icon: Package, color: "text-primary" },
    { label: "Estoque baixo", value: stats.baixo, icon: AlertTriangle, color: "text-destructive" },
    { label: "Entradas hoje", value: stats.entradasHoje, icon: ArrowDownToLine, color: "text-success" },
    { label: "Saídas hoje", value: stats.saidasHoje, icon: ArrowUpFromLine, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do estoque em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="mt-2 text-3xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Produtos mais consumidos</CardTitle>
          </CardHeader>
          <CardContent>
            {consumoPorProduto.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Sem saídas registradas ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={consumoPorProduto}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="qtd" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Reposição urgente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.baixoList.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Tudo certo no estoque.
              </div>
            ) : (
              <ul className="space-y-2">
                {stats.baixoList.slice(0, 8).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2"
                  >
                    <span className="truncate">{p.nome}</span>
                    <Badge variant="destructive" className="shrink-0">
                      {p.estoque_atual} {p.unidade_medida}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas movimentações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.slice(0, 10).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(m.data_movimentacao).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === "entrada" ? "default" : "secondary"}>
                      {m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.produtos?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.quantidade} {m.produtos?.unidade_medida}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.responsavel ?? m.fornecedor ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {movs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma movimentação registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
