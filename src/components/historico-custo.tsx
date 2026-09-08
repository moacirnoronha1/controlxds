import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useLotes, type Produto } from "@/lib/estoque";
import {
  calcularIndicadores, fmtMoeda, fmtVariacao, lotesParaEntradas,
} from "@/lib/custos";

type Props = {
  produto: Produto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function HistoricoCustoDialog({ produto, open, onOpenChange }: Props) {
  const { data: lotes = [], isLoading } = useLotes(produto?.id);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [fornecedor, setFornecedor] = useState("all");

  const todas = useMemo(() => lotesParaEntradas(lotes), [lotes]);

  const fornecedores = useMemo(() => {
    const s = new Set<string>();
    for (const e of todas) if (e.fornecedor) s.add(e.fornecedor);
    return Array.from(s).sort();
  }, [todas]);

  const entradas = useMemo(
    () =>
      todas.filter((e) => {
        const d = e.data.slice(0, 10);
        if (de && d < de) return false;
        if (ate && d > ate) return false;
        if (fornecedor !== "all" && (e.fornecedor ?? "") !== fornecedor) return false;
        return true;
      }),
    [todas, de, ate, fornecedor],
  );

  const ind = useMemo(() => calcularIndicadores(entradas), [entradas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Custo — {produto?.nome ?? ""}</DialogTitle>
        </DialogHeader>

        {ind.alerta && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Atenção: custo deste produto teve variação alta ({fmtVariacao(ind.variacao)}).
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Ind label="Último custo un." value={fmtMoeda(ind.ultimo)} />
          <Ind label="Custo anterior" value={fmtMoeda(ind.anterior)} />
          <Ind
            label="Variação"
            value={fmtVariacao(ind.variacao)}
            tone={ind.variacao == null ? undefined : ind.variacao > 0 ? "danger" : "ok"}
          />
          <Ind label="Custo médio ponderado" value={fmtMoeda(ind.medioPonderado)} />
          <Ind label="Menor custo un." value={fmtMoeda(ind.menor)} tone="ok" />
          <Ind label="Maior custo un." value={fmtMoeda(ind.maior)} tone="danger" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Fornecedor</Label>
            <Select value={fornecedor} onValueChange={setFornecedor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo un.</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && entradas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma entrada com custo informado.</TableCell></TableRow>
              )}
              {[...entradas].reverse().map((e) => (
                <TableRow key={e.lote_id}>
                  <TableCell className="tabular-nums">
                    {new Date(e.data).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{e.fornecedor ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {e.validade ? new Date(e.validade).toLocaleDateString("pt-BR") : "—"}
                    {e.local && <Badge variant="outline" className="ml-2">{e.local}</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.quantidade} {produto?.unidade_medida}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(e.custoUnitario)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtMoeda(e.custoTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Ind({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={
        "text-base font-semibold tabular-nums " +
        (tone === "ok" ? "text-emerald-500" : tone === "danger" ? "text-destructive" : "")
      }>{value}</div>
    </div>
  );
}
