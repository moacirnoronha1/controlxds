import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, FileText } from "lucide-react";
import { useProdutos } from "@/lib/estoque";
import {
  useCriarRequisicao, useRequisicoes, useSetores,
} from "@/lib/requisicoes";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/requisicoes")({
  component: RequisicoesPage,
});

type ItemDraft = { produto_id: string; quantidade: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  liberada: "default",
  cancelada: "destructive",
};

function RequisicoesPage() {
  const { user, role } = useAuth();
  const isRequisitante = role === "requisitante";
  const reqs = useRequisicoes();
  const setores = useSetores();
  const produtos = useProdutos();
  const criar = useCriarRequisicao();

  const [open, setOpen] = useState(false);
  const [requisitante, setRequisitante] = useState(user?.nome ?? "");
  const [setor, setSetor] = useState(user?.setor ?? "");
  const [observacao, setObservacao] = useState("");
  const [extra, setExtra] = useState(false);
  const [soExtras, setSoExtras] = useState(false);
  const [itens, setItens] = useState<ItemDraft[]>([{ produto_id: "", quantidade: "" }]);

  const setoresAtivos = useMemo(
    () => (setores.data ?? []).filter((s) => s.ativo),
    [setores.data],
  );

  function reset() {
    setRequisitante(user?.nome ?? ""); setSetor(user?.setor ?? ""); setObservacao(""); setExtra(false);
    setItens([{ produto_id: "", quantidade: "" }]);
  }

  const listaFiltrada = useMemo(() => {
    let all = reqs.data ?? [];
    if (isRequisitante && user) {
      all = all.filter((r) => r.requisitante.trim().toLowerCase() === user.nome.trim().toLowerCase());
    }
    if (soExtras) all = all.filter((r) => r.extra);
    return all;
  }, [reqs.data, isRequisitante, user, soExtras]);

  async function salvar() {
    const validos = itens
      .filter((i) => i.produto_id && Number(i.quantidade) > 0)
      .map((i) => {
        const p = produtos.data?.find((pp) => pp.id === i.produto_id);
        return {
          produto_id: i.produto_id,
          quantidade_solicitada: Number(i.quantidade),
          codigo: p?.codigo_barras ?? null,
        };
      });
    if (!user?.nome) return;
    if (!requisitante.trim() || !setor || validos.length === 0) return;
    await criar.mutateAsync({
      requisitante: requisitante.trim(),
      setor,
      observacao: observacao.trim() || undefined,
      extra,
      itens: validos,
    });
    setOpen(false);
    reset();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requisições de Material</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de retirada do estoque. Ao liberar, gera saída automática.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova requisição</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova requisição</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Requisitante (usuário logado)</Label>
                  <Input value={requisitante} readOnly disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Destino / Setor</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {setoresAtivos.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                          Cadastre setores em Configurações
                        </div>
                      )}
                      {setoresAtivos.map((s) => (
                        <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Itens</Label>
                <div className="space-y-2">
                  {itens.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Select
                          value={it.produto_id}
                          onValueChange={(v) => {
                            const copy = [...itens]; copy[idx] = { ...copy[idx], produto_id: v }; setItens(copy);
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                          <SelectContent>
                            {(produtos.data ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} ({p.estoque_atual} {p.unidade_medida})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number" min="0" step="any" className="w-24"
                        placeholder="Qtd"
                        value={it.quantidade}
                        onChange={(e) => {
                          const copy = [...itens]; copy[idx] = { ...copy[idx], quantidade: e.target.value }; setItens(copy);
                        }}
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        onClick={() => setItens(itens.length === 1 ? [{ produto_id: "", quantidade: "" }] : itens.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setItens([...itens, { produto_id: "", quantidade: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <Checkbox checked={extra} onCheckedChange={(v) => setExtra(v === true)} />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">Requisição extra / fora do horário</span>
                  <span className="text-xs text-muted-foreground">
                    Marque quando o pedido for feito fora do horário padrão de requisição.
                  </span>
                </span>
              </label>

              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={criar.isPending}>Criar requisição</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <Checkbox checked={soExtras} onCheckedChange={(v) => setSoExtras(v === true)} />
        Mostrar apenas requisições extras / fora do horário
      </label>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Requisitante</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reqs.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!reqs.isLoading && listaFiltrada.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma requisição.</TableCell></TableRow>
            )}
            {listaFiltrada.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">#{String(r.numero).padStart(5, "0")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.data).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>{r.requisitante}</TableCell>
                <TableCell>{r.setor}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge>
                    {r.extra && <Badge variant="outline">Extra / fora do horário</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/requisicoes/$id" params={{ id: r.id }}>
                      <FileText className="h-4 w-4 mr-1" /> Abrir
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
