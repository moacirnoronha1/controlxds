import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
import { toast } from "sonner";
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

  const DRAFT_KEY = "gx:requisicao-rascunho";

  const [open, setOpen] = useState(false);
  const [requisitante, setRequisitante] = useState(user?.nome ?? "");
  const [setor, setSetor] = useState(user?.setor ?? "");
  const [observacao, setObservacao] = useState("");
  const [extra, setExtra] = useState(false);
  const [soExtras, setSoExtras] = useState(false);
  const [itens, setItens] = useState<ItemDraft[]>([{ produto_id: "", quantidade: "" }]);
  const [draftCarregado, setDraftCarregado] = useState(false);

  // Mantém o nome do requisitante em dia sem apagar o que já foi preenchido
  useEffect(() => {
    if (user?.nome) setRequisitante((prev) => prev || user.nome);
    if (user?.setor) setSetor((prev) => prev || user.setor!);
  }, [user?.nome, user?.setor]);

  // Carrega rascunho salvo localmente (uma vez)
  useEffect(() => {
    if (draftCarregado) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as {
          setor?: string; observacao?: string; extra?: boolean; itens?: ItemDraft[];
        };
        if (d.itens?.some((i) => i.produto_id || i.quantidade)) {
          setItens(d.itens);
          if (d.setor) setSetor(d.setor);
          if (d.observacao) setObservacao(d.observacao);
          setExtra(!!d.extra);
        }
      }
    } catch { /* rascunho inválido, ignora */ }
    setDraftCarregado(true);
  }, [draftCarregado]);

  // Salva rascunho enquanto o usuário preenche
  useEffect(() => {
    if (!draftCarregado) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ setor, observacao, extra, itens }));
    } catch { /* storage cheio, ignora */ }
  }, [draftCarregado, setor, observacao, extra, itens]);

  const setoresAtivos = useMemo(
    () => (setores.data ?? []).filter((s) => s.ativo),
    [setores.data],
  );

  const { totalItens, totalUnidades } = useMemo(() => {
    const validos = itens.filter((i) => i.produto_id && Number(i.quantidade) > 0);
    return {
      totalItens: validos.length,
      totalUnidades: validos.reduce((acc, i) => acc + Number(i.quantidade), 0),
    };
  }, [itens]);

  function reset() {
    setRequisitante(user?.nome ?? ""); setSetor(user?.setor ?? ""); setObservacao(""); setExtra(false);
    setItens([{ produto_id: "", quantidade: "" }]);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
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
    if (!user?.nome) { toast.error("Usuário não identificado. Faça login novamente."); return; }
    if (!requisitante.trim()) { toast.error("Requisitante não identificado."); return; }
    if (!setor) { toast.error("Selecione o destino / setor."); return; }
    if (validos.length === 0) { toast.error("Adicione ao menos um item com quantidade."); return; }

    try {
      await criar.mutateAsync({
        requisitante: requisitante.trim(),
        setor,
        observacao: observacao.trim() || undefined,
        extra,
        itens: validos,
      });
    } catch {
      // erro já exibido pelo hook; mantém todos os dados preenchidos
      return;
    }
    // só limpa após sucesso
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova requisição</Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl flex flex-col max-h-[90dvh] p-0"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle>Nova requisição</DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="px-6 py-2 shrink-0 grid gap-4">
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
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
                <div className="space-y-2">
                  <Label>Itens</Label>
                  <div className="space-y-2">
                    {itens.map((it, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
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
                          type="number" min="0" step="any" className="w-24 shrink-0"
                          placeholder="Qtd"
                          value={it.quantidade}
                          onChange={(e) => {
                            const copy = [...itens]; copy[idx] = { ...copy[idx], quantidade: e.target.value }; setItens(copy);
                          }}
                        />
                        <Button
                          type="button" variant="ghost" size="icon" className="shrink-0"
                          onClick={() => setItens(itens.length === 1 ? [{ produto_id: "", quantidade: "" }] : itens.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-2 shrink-0 grid gap-4">
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
            </div>

            <div className="border-t px-6 py-4 shrink-0 bg-background">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {totalItens} {totalItens === 1 ? "item" : "itens"} · Total: {totalUnidades} unidades
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setItens([...itens, { produto_id: "", quantidade: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={salvar} disabled={criar.isPending}>Criar requisição</Button>
                </div>
              </div>
            </div>
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
