import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, Trash2, FileSearch } from "lucide-react";
import {
  useInventarios, useCriarInventario, useExcluirInventario, STATUS_LABEL, TIPO_LABEL,
  type InventarioTipo, type InventarioStatus,
} from "@/lib/inventario";
import { useProdutos } from "@/lib/estoque";
import { useAuth, can } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/inventario")({
  component: InventarioListPage,
});


const STATUS_VARIANT: Record<InventarioStatus, "default" | "secondary" | "outline"> = {
  aberto: "outline",
  em_conferencia: "secondary",
  fechado: "default",
};

function InventarioListPage() {
  const { role } = useAuth();
  const podeCriar = can(role, "createMovement");
  const podeExcluir = can(role, "manageProducts");
  const [mes, setMes] = useState<string>("");
  const { data: invs = [], isLoading } = useInventarios(mes || undefined);
  const excluir = useExcluirInventario();
  const [openNew, setOpenNew] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventário</h1>
          <p className="text-sm text-muted-foreground">Conferência física do estoque</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-[180px]"
            placeholder="Filtrar mês"
          />
          {podeCriar && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DialogTrigger>
              <NovoInventarioDialog onDone={() => setOpenNew(false)} />
            </Dialog>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Fechado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && invs.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum inventário</TableCell></TableRow>
            )}
            {invs.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono">{format(new Date(inv.referencia), "MM/yyyy")}</TableCell>
                <TableCell className="max-w-[260px] truncate">{inv.titulo || "—"}</TableCell>
                <TableCell><Badge variant="outline">{TIPO_LABEL[inv.tipo]}</Badge></TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(inv.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.fechado_em ? format(new Date(inv.fechado_em), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/inventario/$id" params={{ id: inv.id }}>
                        <FileSearch className="h-4 w-4" />
                      </Link>
                    </Button>
                    {podeExcluir && inv.status !== "fechado" && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Excluir inventário?")) excluir.mutate(inv.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NovoInventarioDialog({ onDone }: { onDone: () => void }) {
  const [tipo, setTipo] = useState<InventarioTipo>("completo");
  const [titulo, setTitulo] = useState(`Inventário ${format(new Date(), "MM/yyyy")}`);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const { data: produtos = [] } = useProdutos();
  const criar = useCriarInventario();

  const filtrados = useMemo(
    () => produtos.filter((p) => p.ativo && p.nome.toLowerCase().includes(busca.toLowerCase())),
    [produtos, busca],
  );

  const submit = async () => {
    const id = await criar.mutateAsync({
      tipo,
      titulo,
      produto_ids: tipo === "parcial" ? Array.from(selecionados) : undefined,
    });
    onDone();
    // navegar
    window.location.href = `/inventario/${id}`;
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo inventário</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as InventarioTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rapido">Rápido — todos os produtos ativos</SelectItem>
              <SelectItem value="completo">Completo — todos os produtos ativos</SelectItem>
              <SelectItem value="parcial">Parcial — selecionar produtos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tipo === "parcial" && (
          <div className="space-y-2">
            <Input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div className="max-h-64 overflow-y-auto rounded-md border p-2 space-y-1">
              {filtrados.map((p) => {
                const checked = selecionados.has(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        setSelecionados((s) => {
                          const n = new Set(s);
                          if (c) n.add(p.id); else n.delete(p.id);
                          return n;
                        });
                      }}
                    />
                    <span className="flex-1">{p.nome}</span>
                    <span className="text-muted-foreground text-xs">{p.estoque_atual} {p.unidade_medida}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{selecionados.size} selecionado(s)</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={criar.isPending || (tipo === "parcial" && selecionados.size === 0)}
        >
          <ClipboardList className="h-4 w-4 mr-1" /> Criar inventário
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
