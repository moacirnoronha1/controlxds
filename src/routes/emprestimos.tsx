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
import { useProdutos } from "@/lib/estoque";
import {
  useEmprestimos, useCriarEmprestimo, useDevolverEmprestimo, useDeleteEmprestimo,
  type EmprestimoTipo, type EmprestimoStatus,
} from "@/lib/emprestimos";
import { useAuth } from "@/hooks/use-auth";


export const Route = createFileRoute("/emprestimos")({
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

function EmprestimosPage() {
  const emp = useEmprestimos();
  const produtos = useProdutos();
  const criar = useCriarEmprestimo();
  const devolver = useDevolverEmprestimo();
  const remover = useDeleteEmprestimo();

  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [tipo, setTipo] = useState<EmprestimoTipo>("emprestamos");
  const [produtoId, setProdutoId] = useState<string>("");
  const [produtoNome, setProdutoNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [dataEmp, setDataEmp] = useState(() => new Date().toISOString().slice(0, 10));
  const [previsao, setPrevisao] = useState("");
  const [observacao, setObservacao] = useState("");

  const lista = useMemo(() => {
    const rows = emp.data ?? [];
    if (filtro === "todos") return rows;
    return rows.filter((r) => r.tipo === filtro);
  }, [emp.data, filtro]);

  function reset() {
    setTipo("emprestamos");
    setProdutoId("");
    setProdutoNome("");
    setQuantidade("");
    setUnidade("");
    setOrigem("");
    setDestino("");
    setResponsavel("");
    setDataEmp(new Date().toISOString().slice(0, 10));
    setPrevisao("");
    setObservacao("");
  }

  async function salvar() {
    const q = Number(quantidade);
    if (!produtoNome.trim() || !q || q <= 0) return;
    await criar.mutateAsync({
      tipo,
      produto_id: produtoId || null,
      produto_nome: upper(produtoNome.trim()),
      quantidade: q,
      unidade_medida: unidade.trim() || null,
      origem: origem.trim() || null,
      destino: destino.trim() || null,
      responsavel: responsavel.trim() || null,
      data_emprestimo: dataEmp,
      previsao_devolucao: previsao || null,
      observacao: observacao.trim() || null,
    });
    setOpen(false);
    reset();
  }

  function onProdutoChange(id: string) {
    setProdutoId(id);
    const p = produtos.data?.find((x) => x.id === id);
    if (p) {
      setProdutoNome(p.nome);
      setUnidade(p.unidade_medida);
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
                <Label>Produto do catálogo (opcional)</Label>
                <Select value={produtoId} onValueChange={onProdutoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto cadastrado" /></SelectTrigger>
                  <SelectContent>
                    {(produtos.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ou digite abaixo se o item não está no catálogo.
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
                  <Label>Responsável</Label>
                  <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
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
                  <Label>Previsão de devolução</Label>
                  <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={criar.isPending}>Registrar</Button>
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
                          devolver.mutate({ id: e.id, data: new Date().toISOString().slice(0, 10) })
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
