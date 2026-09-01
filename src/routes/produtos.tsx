import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  CATEGORIAS,
  UNIDADES,
  useDeleteProduto,
  useProdutos,
  useSaveProduto,
  useLocais,
  useMovimentacoes,
  type Produto,
} from "@/lib/estoque";
import { calcularMinimos, LEAD_TIME_DIAS } from "@/lib/estoque-minimo";
import { Card } from "@/components/ui/card";
import { ImportProdutos } from "@/components/import-produtos";
import { useAuth, can } from "@/hooks/use-auth";

export const Route = createFileRoute("/produtos")({
  component: ProdutosPage,
});

function ProdutosPage() {
  const { role } = useAuth();
  const canEdit = can(role, "manageProducts");
  const { data: produtos = [], isLoading } = useProdutos();
  const { data: locais = [] } = useLocais();
  const save = useSaveProduto();
  const del = useDeleteProduto();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Produto> | null>(null);

  const filtered = useMemo(() => {
    return produtos.filter(
      (p) =>
        (cat === "all" || p.categoria === cat) &&
        p.nome.toLowerCase().includes(q.toLowerCase()),
    );
  }, [produtos, q, cat]);

  function openNew() {
    const defaultLocal = locais.find((l) => l.nome === "Estoque Principal") ?? locais[0];
    setEditing({
      nome: "",
      categoria: "SECOS",
      unidade_medida: "un",
      estoque_minimo: 0,
      codigo_barras: null,
      codigo_caixa: null,
      unidades_por_caixa: 1,
      local_padrao_id: defaultLocal?.id ?? null,
      ativo: true,
    });
    setOpen(true);
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setOpen(true);
  }

  async function handleSave() {
    if (!editing?.nome?.trim()) return;
    await save.mutateAsync(editing as Produto);
    setOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie seus insumos.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <ImportProdutos />
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo produto
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum produto. Clique em "Novo produto" para começar.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const baixo = p.estoque_atual <= p.estoque_minimo;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={baixo ? "text-destructive font-semibold" : ""}>
                      {p.estoque_atual} {p.unidade_medida}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.estoque_minimo} {p.unidade_medida}
                  </TableCell>
                  <TableCell>
                    {baixo ? (
                      <Badge variant="destructive">Baixo</Badge>
                    ) : (
                      <Badge className="bg-success text-success-foreground hover:bg-success/90">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Excluir ${p.nome}?`)) del.mutate(p.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={editing.nome ?? ""}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Ex: Arroz branco 5kg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editing.categoria}
                    onValueChange={(v) => setEditing({ ...editing, categoria: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Unidade</Label>
                  <Select
                    value={editing.unidade_medida}
                    onValueChange={(v) => setEditing({ ...editing, unidade_medida: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Estoque mínimo (manual)</Label>
                  <Input
                    type="number"
                    value={editing.estoque_minimo ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, estoque_minimo: Number(e.target.value) })
                    }
                  />
                  {editing.id && (
                    <p className="text-xs text-muted-foreground">
                      Sugerido pelo sistema: {minimos.get(editing.id)?.minimoAuto ?? 0}{" "}
                      {editing.unidade_medida} (média{" "}
                      {(minimos.get(editing.id)?.mediaDiaria ?? 0).toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      })}
                      /dia × {LEAD_TIME_DIAS + (Number(editing.dias_seguranca) || 0)} dias)
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Dias de segurança (opcional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editing.dias_seguranca ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, dias_seguranca: Number(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Somados ao lead time de {LEAD_TIME_DIAS} dias no mínimo automático.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Local de estoque padrão</Label>
                  <Select
                    value={editing.local_padrao_id ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, local_padrao_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {locais.filter((l) => l.ativo).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Código de barras (unidade)</Label>
                <Input
                  value={editing.codigo_barras ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, codigo_barras: e.target.value.trim() || null })
                  }
                  placeholder="Ex: 7891234567890"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Ao bipar este código, movimenta 1 unidade.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Código da caixa</Label>
                  <Input
                    value={editing.codigo_caixa ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, codigo_caixa: e.target.value.trim() || null })
                    }
                    placeholder="Opcional"
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidades por caixa</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={editing.unidades_por_caixa ?? 1}
                    onChange={(e) =>
                      setEditing({ ...editing, unidades_por_caixa: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Ao bipar o código da caixa, o sistema movimenta automaticamente N unidades.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
