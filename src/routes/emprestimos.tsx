import { createFileRoute } from "@tanstack/react-router";
import { upper } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, ArrowLeftRight, ArrowRightLeft, CheckCircle2, Trash2 } from "lucide-react";
import { useProdutos, useLocais, useLotes } from "@/lib/estoque";
import {
  useEmprestimos, useCriarEmprestimo, useDevolverEmprestimo, useDeleteEmprestimo,
  type EmprestimoTipo, type EmprestimoStatus,
} from "@/lib/emprestimos";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";


export const Route = createFileRoute("/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos | GX Control" },
      { name: "description", content: "Controle de empréstimos e devoluções do estoque no GX Control." },
      { property: "og:title", content: "Empréstimos | GX Control" },
      { property: "og:description", content: "Controle de empréstimos e devoluções do estoque no GX Control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmprestimosPage,
});

const STATUS_VARIANT: Record<EmprestimoStatus, "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  devolvido: "default",
  atrasado: "destructive",
};

const STATUS_LABEL: Record<EmprestimoStatus, string> = {
  pendente: "Pendente",
  devolvido: "Devolvido",
  atrasado: "Atrasado",
};

const TIPO_LABEL: Record<EmprestimoTipo, string> = {
  emprestamos: "Emprestamos",
  tomamos_emprestado: "Tomamos emprestado",
};

type Filtro = "todos" | EmprestimoTipo;
const TODOS_OS_LOTES = "todos-os-lotes";
const ESTOQUE_SEM_LOTE = "estoque-sem-lote";

function EmprestimosPage() {
  const { user } = useAuth();
  const [arquivados, setArquivados] = useState(false);
  const emp = useEmprestimos(arquivados);

  const produtos = useProdutos();
  const criar = useCriarEmprestimo();
  const devolver = useDevolverEmprestimo();
  const remover = useDeleteEmprestimo();
  const locais = useLocais();

  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [tipo, setTipo] = useState<EmprestimoTipo>("emprestamos");
  const [produtoId, setProdutoId] = useState<string>("");
  const [produtoNome, setProdutoNome] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const [loteId, setLoteId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [dataEmp, setDataEmp] = useState(() => new Date().toISOString().slice(0, 10));
  const [previsao, setPrevisao] = useState("");
  const [observacao, setObservacao] = useState("");
  const lotes = useLotes(produtoId || undefined);
  const produtoSelecionado = produtos.data?.find((p) => p.id === produtoId) ?? null;
  const lotesDoLocal = useMemo(
    () => (lotes.data ?? []).filter((l) => Number(l.saldo) > 0 && l.local_id === localId),
    [lotes.data, localId],
  );
  const saldoLotesLocal = useMemo(
    () => lotesDoLocal.reduce((total, lote) => total + (Number(lote.saldo) || 0), 0),
    [lotesDoLocal],
  );
  const saldoTodosLotes = useMemo(
    () => (lotes.data ?? []).reduce((total, lote) => total + Math.max(0, Number(lote.saldo) || 0), 0),
    [lotes.data],
  );
  const saldoSemLote = Math.max(0, Number(produtoSelecionado?.estoque_atual ?? 0) - saldoTodosLotes);
  const saldoDisponivelLocal = saldoLotesLocal + saldoSemLote;

  const lista = useMemo(() => {
    const rows = emp.data ?? [];
    if (filtro === "todos") return rows;
    return rows.filter((r) => r.tipo === filtro);
  }, [emp.data, filtro]);

  function reset() {
    setTipo("emprestamos");
    setProdutoId("");
    setProdutoNome("");
    setLocalId("");
    setLoteId("");
    setQuantidade("");
    setUnidade("");
    setOrigem("");
    setDestino("");
    setDataEmp(new Date().toISOString().slice(0, 10));
    setPrevisao("");
    setObservacao("");
  }

  async function salvar() {
    const q = Number(quantidade);
    if (!user?.nome) return;
    if (!produtoId) {
      toast.error("Selecione o produto do catálogo");
      return;
    }
    if (!q || q <= 0) {
      toast.error("Informe a quantidade");
      return;
    }
    if (!localId) {
      toast.error("Selecione o local de estoque");
      return;
    }
    if (!previsao) {
      toast.error("Informe a previsão de devolução");
      return;
    }
    if (tipo === "emprestamos") {
      const saldoSelecionado = loteId && loteId !== TODOS_OS_LOTES && loteId !== ESTOQUE_SEM_LOTE
        ? Number(lotesDoLocal.find((l) => l.id === loteId)?.saldo ?? 0)
        : loteId === ESTOQUE_SEM_LOTE
          ? saldoSemLote
          : saldoDisponivelLocal;
      if (q > saldoSelecionado) {
        toast.error(`Estoque insuficiente. Disponível: ${saldoSelecionado}, solicitado: ${q}`);
        return;
      }
    }
    await criar.mutateAsync({
      tipo,
      produto_id: produtoId,
      produto_nome: upper(produtoNome.trim()),
      quantidade: q,
      unidade_medida: unidade.trim() || null,
      local_id: localId,
      lote_id: tipo === "emprestamos" && loteId !== TODOS_OS_LOTES && loteId !== ESTOQUE_SEM_LOTE
        ? loteId || null
        : null,
      origem: origem.trim() || null,
      destino: destino.trim() || null,
      responsavel: user.nome,
      data_emprestimo: dataEmp,
      previsao_devolucao: previsao,
      observacao: observacao.trim() || null,
    });
    setOpen(false);
    reset();
  }

  function onProdutoChange(id: string) {
    setProdutoId(id);
    setLoteId(TODOS_OS_LOTES);
    const p = produtos.data?.find((x) => x.id === id);
    if (p) {
      setProdutoNome(p.nome);
      setUnidade(p.unidade_medida);
      if (p.local_padrao_id) setLocalId(p.local_padrao_id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empréstimos</h1>
          <p className="text-sm text-muted-foreground">
            Controle temporário de itens — não afeta compra nem requisição.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo empréstimo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar empréstimo</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <Tabs value={tipo} onValueChange={(v) => setTipo(v as EmprestimoTipo)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="emprestamos">
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Emprestamos
                  </TabsTrigger>
                  <TabsTrigger value="tomamos_emprestado">
                    <ArrowLeftRight className="h-4 w-4 mr-2" /> Tomamos emprestado
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid gap-2">
                <Label>Produto do catálogo <span className="text-destructive">*</span></Label>
                <Select value={produtoId} onValueChange={onProdutoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto cadastrado" /></SelectTrigger>
                  <SelectContent>
                    {(produtos.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O empréstimo movimenta o estoque, por isso o item precisa estar cadastrado.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2 col-span-2">
                  <Label>Nome do item</Label>
                  <Input value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} placeholder="Ex.: Cerveja X 600ml" />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade</Label>
                  <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg, cx..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="0" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Responsável (usuário logado)</Label>
                  <Input value={user?.nome ?? ""} readOnly disabled />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Local de estoque <span className="text-destructive">*</span></Label>
                  <Select value={localId} onValueChange={(value) => { setLocalId(value); setLoteId(TODOS_OS_LOTES); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                    <SelectContent>
                      {(locais.data ?? []).filter((l) => l.ativo).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Lote {tipo === "emprestamos" ? "(saldo somado no local)" : "(gerado automaticamente)"}</Label>
                  <Select
                    value={loteId}
                    onValueChange={setLoteId}
                    disabled={tipo !== "emprestamos" || !produtoId}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione como baixar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS_OS_LOTES}>
                        Todos os lotes · {saldoDisponivelLocal} disponível
                      </SelectItem>
                      {lotesDoLocal.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.validade
                              ? new Date(l.validade + "T00:00:00").toLocaleDateString("pt-BR")
                              : "sem validade"}{" "}
                            · saldo {l.saldo} · {l.locais_estoque?.nome ?? "local selecionado"}
                          </SelectItem>
                        ))}
                      {saldoSemLote > 0 && (
                        <SelectItem value={ESTOQUE_SEM_LOTE}>
                          Estoque sem lote · {saldoSemLote} disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {tipo === "emprestamos" && produtoId && localId && (
                    <p className="text-xs text-muted-foreground">
                      Disponível neste local: {saldoDisponivelLocal} {unidade}
                      {saldoSemLote > 0 ? ` · ${saldoSemLote} sem lote` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Origem</Label>
                  <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder={tipo === "emprestamos" ? "De onde saiu (ex: Estoque Principal)" : "De quem viemos pegar"} />
                </div>
                <div className="grid gap-2">
                  <Label>Destino</Label>
                  <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder={tipo === "emprestamos" ? "Para quem foi" : "Para onde foi (ex: Casa)"} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Data do empréstimo</Label>
                  <Input type="date" value={dataEmp} onChange={(e) => setDataEmp(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Previsão de devolução <span className="text-destructive">*</span>
                  </Label>
                  <Input type="date" required value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
                  {!previsao && (
                    <p className="text-xs text-muted-foreground">Campo obrigatório.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={criar.isPending || !previsao || !produtoId || !localId}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="emprestamos">Emprestamos</TabsTrigger>
          <TabsTrigger value="tomamos_emprestado">Tomamos emprestado</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Button variant={!arquivados ? "secondary" : "ghost"} size="sm" onClick={() => setArquivados(false)}>Ativos</Button>
        <Button variant={arquivados ? "secondary" : "ghost"} size="sm" onClick={() => setArquivados(true)}>Arquivados</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Prev. devol.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emp.isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!emp.isLoading && lista.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum empréstimo.</TableCell></TableRow>
            )}
            {lista.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Badge variant={e.tipo === "emprestamos" ? "outline" : "secondary"}>
                    {TIPO_LABEL[e.tipo]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{e.produto_nome}</div>
                  {e.responsavel && (
                    <div className="text-xs text-muted-foreground">Resp.: {e.responsavel}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.quantidade} {e.unidade_medida ?? ""}
                </TableCell>
                <TableCell className="text-sm">{e.origem ?? "—"}</TableCell>
                <TableCell className="text-sm">{e.destino ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {new Date(e.data_emprestimo).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm">
                  {e.previsao_devolucao
                    ? new Date(e.previsao_devolucao).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                  {e.data_devolucao && (
                    <div className="text-xs text-muted-foreground mt-1">
                      em {new Date(e.data_devolucao).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {e.status !== "devolvido" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          devolver.mutate({
                            id: e.id,
                            data: new Date().toISOString().slice(0, 10),
                            responsavel: user?.nome ?? null,
                          })
                        }
                        title="Marcar como devolvido"
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remover.mutate(e.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
