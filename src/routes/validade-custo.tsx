import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarClock } from "lucide-react";
import { useLotes, useProdutos, useLocais, CATEGORIAS } from "@/lib/estoque";

export const Route = createFileRoute("/validade-custo")({
  component: ValidadeCustoPage,
  head: () => ({ meta: [{ title: "Validade e Custo" }] }),
});

type StatusValidade = "vencido" | "proximo" | "ok" | "sem_validade";

function classifyValidade(v: string | null): StatusValidade {
  if (!v) return "sem_validade";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = new Date(v);
  const diffDias = Math.round((val.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return "vencido";
  if (diffDias <= 30) return "proximo";
  return "ok";
}

const STATUS_BADGE: Record<StatusValidade, { label: string; cls: string }> = {
  vencido: { label: "Vencido", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
  proximo: { label: "Vence em breve", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  sem_validade: { label: "Sem validade", cls: "bg-muted text-muted-foreground border" },
};

function ValidadeCustoPage() {
  const { data: lotes = [], isLoading } = useLotes();
  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [local, setLocal] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const produtoById = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  const rows = useMemo(() => {
    return lotes
      .filter((l) => Number(l.saldo) > 0)
      .map((l) => {
        const p = produtoById.get(l.produto_id);
        const st = classifyValidade(l.validade);
        const custo = l.custo_unitario == null ? null : Number(l.custo_unitario);
        const saldo = Number(l.saldo);
        return {
          lote: l,
          produto: p,
          categoria: p?.categoria ?? "—",
          local: l.locais_estoque?.nome ?? "—",
          status: st,
          custo,
          saldo,
          custoTotal: custo == null ? null : custo * saldo,
        };
      })
      .filter((r) => {
        if (busca && !(r.produto?.nome ?? "").toLowerCase().includes(busca.toLowerCase())) return false;
        if (cat !== "all" && r.categoria !== cat) return false;
        if (local !== "all" && r.lote.local_id !== local) return false;
        if (status !== "all" && r.status !== status && !(status === "sem_custo" && r.custo == null)) return false;
        return true;
      });
  }, [lotes, produtoById, busca, cat, local, status]);

  const totais = useMemo(() => {
    let vencidos = 0, proximos = 0, semVal = 0, semCusto = 0, custoTotal = 0;
    for (const r of rows) {
      if (r.status === "vencido") vencidos++;
      else if (r.status === "proximo") proximos++;
      else if (r.status === "sem_validade") semVal++;
      if (r.custo == null) semCusto++;
      else custoTotal += r.custoTotal ?? 0;
    }
    return { vencidos, proximos, semVal, semCusto, custoTotal };
  }, [rows]);

  const fmtMoney = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Validade e Custo
        </h1>
        <p className="text-sm text-muted-foreground">
          Lotes disponíveis com validade, custo unitário e status.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Vencidos" value={totais.vencidos} tone="danger" />
        <StatCard label="Próximos (30d)" value={totais.proximos} tone="warn" />
        <StatCard label="Sem validade" value={totais.semVal} />
        <StatCard label="Sem custo" value={totais.semCusto} />
        <StatCard label="Custo total" value={fmtMoney(totais.custoTotal)} tone="ok" />
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <Input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} className="md:max-w-xs" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={local} onValueChange={setLocal}>
          <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos locais</SelectItem>
            {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="proximo">Próximos do vencimento</SelectItem>
            <SelectItem value="sem_validade">Sem validade</SelectItem>
            <SelectItem value="sem_custo">Sem custo</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
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
              <TableHead>Fornecedor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum lote encontrado</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const badge = STATUS_BADGE[r.status];
              return (
                <TableRow key={r.lote.id}>
                  <TableCell className="font-medium">{r.produto?.nome ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.categoria}</Badge></TableCell>
                  <TableCell>{r.local}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.lote.validade
                      ? new Date(r.lote.validade).toLocaleDateString("pt-BR")
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.saldo} {r.produto?.unidade_medida}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.custo == null ? <span className="text-muted-foreground">—</span> : fmtMoney(r.custo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.custoTotal == null ? <span className="text-muted-foreground">—</span> : fmtMoney(r.custoTotal)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.lote.fornecedor ?? "—"}</TableCell>
                  <TableCell className="space-x-1">
                    <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
                    {r.custo == null && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border">Sem custo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={
        "text-lg font-semibold font-mono " +
        (tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : tone === "danger" ? "text-destructive" : "")
      }>{value}</div>
    </div>
  );
}
