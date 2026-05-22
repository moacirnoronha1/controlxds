import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import {
  useInventario, useInventarioItens, useAtualizarContagem, useFecharInventario,
  STATUS_LABEL, TIPO_LABEL, type InventarioStatus,
} from "@/lib/inventario";
import { useAuth, can } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/inventario_/$id")({
  component: InventarioDetailPage,
});

const STATUS_VARIANT: Record<InventarioStatus, "default" | "secondary" | "outline"> = {
  aberto: "outline",
  em_conferencia: "secondary",
  fechado: "default",
};

function InventarioDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: inv } = useInventario(id);
  const { data: itens = [], isLoading } = useInventarioItens(id);
  const atualizar = useAtualizarContagem();
  const fechar = useFecharInventario();

  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [soDiv, setSoDiv] = useState(false);

  useEffect(() => {
    const c: Record<string, string> = {};
    const o: Record<string, string> = {};
    for (const it of itens) {
      c[it.id] = it.contagem_fisica != null ? String(it.contagem_fisica) : "";
      o[it.id] = it.observacao ?? "";
    }
    setContagens(c);
    setObs(o);
  }, [itens]);

  const filtrados = useMemo(() => {
    let r = itens;
    if (busca) r = r.filter((it) => it.produtos?.nome.toLowerCase().includes(busca.toLowerCase()));
    if (soDiv) r = r.filter((it) => it.contagem_fisica != null && Number(it.diferenca) !== 0);
    return r;
  }, [itens, busca, soDiv]);

  const stats = useMemo(() => {
    let contados = 0, divs = 0, sobra = 0, falta = 0;
    for (const it of itens) {
      if (it.contagem_fisica != null) {
        contados++;
        const d = Number(it.diferenca);
        if (d > 0) sobra += d;
        if (d < 0) falta += -d;
        if (d !== 0) divs++;
      }
    }
    return { contados, total: itens.length, divs, sobra, falta };
  }, [itens]);

  const fechado = inv?.status === "fechado";
  const podeEditar = !fechado && can(role, "createMovement");
  const podeFechar = !fechado && can(role, "manageProducts");

  const salvarLinha = (itemId: string) => {
    const raw = contagens[itemId];
    const val = raw === "" ? null : Number(raw);
    if (val !== null && (isNaN(val) || val < 0)) {
      toast.error("Quantidade inválida");
      return;
    }
    atualizar.mutate({ id: itemId, contagem_fisica: val, observacao: obs[itemId] || null });
  };

  if (!inv) {
    return <div className="p-6 text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/inventario"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-semibold">{inv.titulo || "Inventário"}</h1>
            <Badge variant="outline">{TIPO_LABEL[inv.tipo]}</Badge>
            <Badge variant={STATUS_VARIANT[inv.status]}>
              {fechado && <Lock className="h-3 w-3 mr-1" />}
              {STATUS_LABEL[inv.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Referência {format(new Date(inv.referencia), "MM/yyyy")} · criado {format(new Date(inv.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
            {inv.fechado_em && ` · fechado ${format(new Date(inv.fechado_em), "dd/MM/yy HH:mm", { locale: ptBR })}`}
          </p>
        </div>
        {podeFechar && (
          <Button
            onClick={() => {
              if (confirm("Fechar inventário e gerar ajustes de estoque?")) {
                fechar.mutate(id, { onSuccess: () => navigate({ to: "/inventario" }) });
              }
            }}
            disabled={fechar.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar e fechar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Itens" value={`${stats.contados}/${stats.total}`} />
        <Stat label="Divergências" value={stats.divs} tone={stats.divs ? "warn" : undefined} />
        <Stat label="Sobra total" value={fmt(stats.sobra)} tone="ok" />
        <Stat label="Falta total" value={fmt(stats.falta)} tone="danger" />
        <Stat label="Líquido" value={fmt(stats.sobra - stats.falta)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Button variant={soDiv ? "default" : "outline"} onClick={() => setSoDiv((v) => !v)}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Só divergências
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Produto</TableHead>
              <TableHead className="text-right">Sistema</TableHead>
              <TableHead className="text-right w-[140px]">Contagem</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="min-w-[180px]">Observação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtrados.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nada para mostrar</TableCell></TableRow>
            )}
            {filtrados.map((it) => {
              const raw = contagens[it.id] ?? "";
              const contado = raw === "" ? null : Number(raw);
              const dif = contado === null || isNaN(contado) ? null : contado - Number(it.estoque_sistema);
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium">{it.produtos?.nome}</div>
                    <div className="text-xs text-muted-foreground">{it.produtos?.categoria} · {it.produtos?.unidade_medida}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(it.estoque_sistema)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={raw}
                      disabled={!podeEditar}
                      onChange={(e) => setContagens((s) => ({ ...s, [it.id]: e.target.value }))}
                      onBlur={() => podeEditar && salvarLinha(it.id)}
                      className="text-right"
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono",
                    dif !== null && dif > 0 && "text-emerald-600 dark:text-emerald-400",
                    dif !== null && dif < 0 && "text-destructive",
                  )}>
                    {dif === null ? "—" : (dif > 0 ? `+${fmt(dif)}` : fmt(dif))}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={obs[it.id] ?? ""}
                      disabled={!podeEditar}
                      onChange={(e) => setObs((s) => ({ ...s, [it.id]: e.target.value }))}
                      onBlur={() => podeEditar && salvarLinha(it.id)}
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell>
                    {podeEditar && (
                      <Button size="icon" variant="ghost" onClick={() => salvarLinha(it.id)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(
        "text-lg font-semibold font-mono",
        tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "danger" && "text-destructive",
      )}>{value}</div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);
}
