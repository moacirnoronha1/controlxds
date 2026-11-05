import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/auditoria-estoque")({
  component: AuditoriaPage,
  head: () => ({
    meta: [
      { title: "Auditoria de Estoque | GX Control" },
      { name: "description", content: "Relatório de divergências entre produtos, lotes e inventários fechados." },
      { property: "og:title", content: "Auditoria de Estoque | GX Control" },
      { property: "og:description", content: "Relatório de divergências entre produtos, lotes e inventários fechados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Linha = {
  produto_id: string; nome: string; categoria: string; unidade: string;
  estoque_produto: number; soma_lotes: number; diferenca_lotes: number;
  inventario_titulo: string | null; inventario_fechado_em: string | null; saldo_inventario: number | null;
  entradas_pos: number; saidas_pos: number; saldo_esperado: number | null;
  diferenca_inexplicada: number | null; qtd_mov_pos: number;
};

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

function situacao(l: Linha) {
  const inexpl = l.diferenca_inexplicada !== null && Math.abs(Number(l.diferenca_inexplicada)) > 0.000001;
  const lotes = Math.abs(Number(l.diferenca_lotes)) > 0.000001;
  if (inexpl) return { t: "Divergência sem explicação", v: "destructive" as const };
  if (lotes) return { t: "Saldo sem lote", v: "secondary" as const };
  if (l.qtd_mov_pos > 0) return { t: "Explicada por movimentações", v: "outline" as const };
  return null;
}

function AuditoriaPage() {
  const [busca, setBusca] = useState("");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["auditoria-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auditoria_estoque");
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const linhas = useMemo(
    () => data
      .map((l) => ({ l, s: situacao(l) }))
      .filter((x) => x.s && x.l.nome.toLowerCase().includes(busca.toLowerCase())),
    [data, busca],
  );
  const total = (t: string) => linhas.filter((x) => x.s?.t === t).length;

  const exportar = () => {
    const cab = ["Produto", "Categoria", "Situação", "Estoque produto", "Soma lotes", "Dif. lotes", "Último inventário", "Fechado em", "Saldo inventário", "Entradas após", "Saídas após", "Saldo esperado", "Dif. sem explicação"];
    const rows = linhas.map(({ l, s }) => [l.nome, l.categoria, s?.t, l.estoque_produto, l.soma_lotes, l.diferenca_lotes, l.inventario_titulo ?? "", l.inventario_fechado_em ? new Date(l.inventario_fechado_em).toLocaleString("pt-BR") : "", l.saldo_inventario ?? "", l.entradas_pos, l.saidas_pos, l.saldo_esperado ?? "", l.diferenca_inexplicada ?? ""]);
    const csv = [cab, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `auditoria-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6" /> AUDITORIA DE ESTOQUE</h1>
        <Button variant="outline" onClick={exportar} disabled={!linhas.length}><Download className="mr-2 h-4 w-4" />Exportar relatório</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Somente leitura. Compara o estoque do produto, a soma dos lotes e o último inventário fechado mais as movimentações feitas depois dele.
        Nenhum saldo é alterado aqui — correções devem ser feitas em <Link to="/ajustes" className="underline">Ajuste de Estoque</Link>, que exige aprovação do Mestre.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Sem explicação</div><div className="text-2xl font-bold">{total("Divergência sem explicação")}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Saldo sem lote</div><div className="text-2xl font-bold">{total("Saldo sem lote")}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Explicadas por movimentações após o inventário</div><div className="text-2xl font-bold">{total("Explicada por movimentações")}</div></Card>
      </div>
      <Input placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
      {error && <p className="text-destructive">Erro ao carregar: {(error as Error).message}</p>}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Produto</TableHead><TableHead>Situação</TableHead>
            <TableHead className="text-right">Produto</TableHead><TableHead className="text-right">Lotes</TableHead>
            <TableHead>Último inventário</TableHead><TableHead className="text-right">Saldo inv.</TableHead>
            <TableHead className="text-right">+ Entradas</TableHead><TableHead className="text-right">− Saídas</TableHead>
            <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Sem explicação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={10}>Carregando…</TableCell></TableRow>}
            {!isLoading && !linhas.length && <TableRow><TableCell colSpan={10}>Nenhuma inconsistência encontrada.</TableCell></TableRow>}
            {linhas.map(({ l, s }) => (
              <TableRow key={l.produto_id}>
                <TableCell className="font-medium">{l.nome}<div className="text-xs text-muted-foreground">{l.categoria}</div></TableCell>
                <TableCell><Badge variant={s!.v}>{s!.t}</Badge></TableCell>
                <TableCell className="text-right font-mono">{n(l.estoque_produto)}</TableCell>
                <TableCell className="text-right font-mono">{n(l.soma_lotes)}</TableCell>
                <TableCell className="text-xs">{l.inventario_titulo ?? "—"}<div className="text-muted-foreground">{l.inventario_fechado_em ? new Date(l.inventario_fechado_em).toLocaleString("pt-BR") : ""}</div></TableCell>
                <TableCell className="text-right font-mono">{n(l.saldo_inventario)}</TableCell>
                <TableCell className="text-right font-mono">{n(l.entradas_pos)}</TableCell>
                <TableCell className="text-right font-mono">{n(l.saidas_pos)}</TableCell>
                <TableCell className="text-right font-mono">{n(l.saldo_esperado)}</TableCell>
                <TableCell className="text-right font-mono">{n(l.diferenca_inexplicada)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
