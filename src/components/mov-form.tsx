import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProdutos,
  useMovimentacoes,
  useLocais,
  useCriarEntradaLote,
  useRegistrarSaidaFefo,
  useLotes,
  useEditarEntradaLote,
  useEntradaAlteracoes,
  type Lote,
} from "@/lib/estoque";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAuth, can } from "@/hooks/use-auth";
import { Card as InfoCard } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { ImportXmlNfe } from "@/components/import-xml-nfe";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { History, Pencil } from "lucide-react";

type Props = { tipo: "entrada" | "saida" };

export function MovForm({ tipo }: Props) {
  const { role, user } = useAuth();
  const allowed = can(role, "createMovement");
  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();
  const entrada = useCriarEntradaLote();
  const saida = useRegistrarSaidaFefo();
  const pending = tipo === "entrada" ? entrada.isPending : saida.isPending;
  const movs = useMovimentacoes(tipo === "entrada" ? undefined : 15);
  const { data: todosLotes = [] } = useLotes();
  const editarEntrada = useEditarEntradaLote();
  const [loteEditando, setLoteEditando] = useState<Lote | null>(null);
  const alteracoesEntrada = useEntradaAlteracoes(loteEditando?.id);
  const [edicao, setEdicao] = useState({
    quantidade: "", validade: "", custo_unitario: "", fornecedor: "", observacao: "",
  });

  const [form, setForm] = useState({
    produto_id: "",
    quantidade: "",
    observacao: "",
    responsavel: user?.nome ?? "",
    fornecedor: "",
    local_id: "",
    validade: "",
    custo_unitario: "",
  });

  // Mantém o responsável sincronizado com o usuário logado
  useEffect(() => {
    if (user?.nome) setForm((f) => (f.responsavel ? f : { ...f, responsavel: user.nome }));
  }, [user?.nome]);


  // Ao trocar produto, se for entrada e o produto tiver local padrão, pré-seleciona
  useEffect(() => {
    if (!form.produto_id) return;
    const p = produtos.find((x) => x.id === form.produto_id);
    if (p?.local_padrao_id && !form.local_id) {
      setForm((f) => ({ ...f, local_id: p.local_padrao_id ?? "" }));
    }
  }, [form.produto_id, produtos]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: lotesProduto = [] } = useLotes(form.produto_id || undefined);
  const [avisoValidade, setAvisoValidade] = useState<string | null>(null);

  // Lote existente (com saldo) que vence DEPOIS do lote que está entrando
  const loteMaisNovoEmEstoque = (() => {
    if (tipo !== "entrada" || !form.produto_id || !form.validade) return null;
    const candidatos = lotesProduto
      .filter((l) => Number(l.saldo) > 0 && l.validade && l.validade > form.validade)
      .sort((a, b) => (a.validade! > b.validade! ? -1 : 1));
    return candidatos[0] ?? null;
  })();

  const qtd = Number(form.quantidade) || 0;
  const custoUn = Number(form.custo_unitario) || 0;
  const custoTotal = qtd * custoUn;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.nome) return;
    if (!form.produto_id || !form.quantidade) return;

    if (tipo === "entrada" && loteMaisNovoEmEstoque) {
      setAvisoValidade(loteMaisNovoEmEstoque.validade!);
      return;
    }
    await efetivar();
  }

  async function efetivar() {
    if (tipo === "entrada") {
      if (!form.local_id) return;
      await entrada.mutateAsync({
        produto_id: form.produto_id,
        local_id: form.local_id,
        quantidade: Number(form.quantidade),
        validade: form.validade || null,
        custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
        fornecedor: form.fornecedor || undefined,
        observacao: form.observacao || undefined,
        responsavel: form.responsavel || undefined,
      });
    } else {
      await saida.mutateAsync({
        produto_id: form.produto_id,
        local_id: form.local_id || null,
        quantidade: Number(form.quantidade),
        responsavel: form.responsavel || undefined,
        observacao: form.observacao || undefined,
      });
    }
    setForm({
      ...form,
      quantidade: "",
      observacao: "",
      validade: "",
      custo_unitario: "",
    });
  }

  const dataBR = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  const recentes = (movs.data ?? []).filter((m) => m.tipo === tipo).slice(0, 8);
  const entradas = (movs.data ?? []).filter((m) => m.tipo === "entrada");
  const title = tipo === "entrada" ? "Registrar entrada" : "Registrar saída";

  function abrirEdicao(lote: Lote) {
    setLoteEditando(lote);
    setEdicao({
      quantidade: String(lote.quantidade_inicial),
      validade: lote.validade ?? "",
      custo_unitario: lote.custo_unitario == null ? "" : String(lote.custo_unitario),
      fornecedor: lote.fornecedor ?? "",
      observacao: lote.observacao ?? "",
    });
  }

  async function salvarEdicao() {
    if (!loteEditando) return;
    await editarEntrada.mutateAsync({
      lote_id: loteEditando.id,
      quantidade: Number(edicao.quantidade),
      validade: edicao.validade || null,
      custo_unitario: edicao.custo_unitario ? Number(edicao.custo_unitario) : null,
      fornecedor: edicao.fornecedor,
      observacao: edicao.observacao,
    });
    setLoteEditando(null);
  }

  if (!allowed) {
    return (
      <InfoCard className="p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Seu papel ({role ?? "—"}) não permite lançar {tipo}s.
        </p>
      </InfoCard>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!loteEditando} onOpenChange={(open) => { if (!open && !editarEntrada.isPending) setLoteEditando(null); }}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar entrada</DialogTitle></DialogHeader>
          {loteEditando && (
            <div className="grid gap-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{loteEditando.produtos?.nome}</p>
                <p className="text-muted-foreground">{loteEditando.locais_estoque?.nome} · saldo atual {loteEditando.saldo} {loteEditando.produtos?.unidade_medida}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Quantidade da entrada</Label>
                  <Input type="number" min="0.000001" step="any" value={edicao.quantidade} onChange={(e) => setEdicao({ ...edicao, quantidade: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Custo unitário (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={edicao.custo_unitario} onChange={(e) => setEdicao({ ...edicao, custo_unitario: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Validade do lote</Label>
                <Input type="date" value={edicao.validade} onChange={(e) => setEdicao({ ...edicao, validade: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Fornecedor</Label>
                <Input value={edicao.fornecedor} onChange={(e) => setEdicao({ ...edicao, fornecedor: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={edicao.observacao} onChange={(e) => setEdicao({ ...edicao, observacao: e.target.value })} />
              </div>
              <div className="rounded-md border">
                <div className="px-3 py-2 border-b text-sm font-medium flex items-center gap-2"><History className="h-4 w-4" /> Histórico de edições</div>
                {(alteracoesEntrada.data ?? []).map((alteracao) => (
                  <div key={alteracao.id} className="p-3 border-b last:border-b-0 text-xs">
                    <p>{alteracao.alterado_por} · {new Date(alteracao.created_at).toLocaleString("pt-BR")}</p>
                    <p className="text-muted-foreground">Quantidade: {String(alteracao.dados_antes.quantidade ?? "—")} → {String(alteracao.dados_depois.quantidade ?? "—")} · Custo: {String(alteracao.dados_antes.custo_unitario ?? "—")} → {String(alteracao.dados_depois.custo_unitario ?? "—")}</p>
                  </div>
                ))}
                {(alteracoesEntrada.data ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhuma edição registrada.</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLoteEditando(null)} disabled={editarEntrada.isPending}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={editarEntrada.isPending || Number(edicao.quantidade) <= 0}>
              {editarEntrada.isPending ? "Salvando..." : "Salvar correção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!avisoValidade} onOpenChange={(v) => { if (!v) setAvisoValidade(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atenção com a validade</AlertDialogTitle>
            <AlertDialogDescription>
              Este lote que está entrando possui validade mais antiga do que outro lote já
              existente em estoque.
              {avisoValidade && (
                <>
                  {" "}Entrando: {dataBR(form.validade)} · Já em estoque: {dataBR(avisoValidade)}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { setAvisoValidade(null); await efetivar(); }}
            >
              Confirmar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {tipo === "entrada"
              ? "Cada entrada gera um lote com validade e custo próprios."
              : "A saída consome dos lotes disponíveis (validade mais próxima primeiro)."}
          </p>
        </div>
        {tipo === "entrada" && <ImportXmlNfe />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tipo === "entrada" ? "Nova entrada (lote)" : "Nova saída"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label>Produto</Label>
                <Select
                  value={form.produto_id}
                  onValueChange={(v) => setForm({ ...form, produto_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} ({p.estoque_atual} {p.unidade_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={form.quantidade}
                    onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Local {tipo === "entrada" ? "" : "(opcional)"}
                  </Label>
                  <Select
                    value={form.local_id}
                    onValueChange={(v) => setForm({ ...form, local_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tipo === "saida" ? "Todos os locais" : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {locais.filter((l) => l.ativo).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tipo === "entrada" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Validade do lote</Label>
                      <Input
                        type="date"
                        value={form.validade}
                        onChange={(e) => setForm({ ...form, validade: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Custo unitário (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.custo_unitario}
                        onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
                      />
                    </div>
                  </div>
                  {custoTotal > 0 && (
                    <p className="text-xs text-muted-foreground -mt-2">
                      Custo total do lote:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        R$ {custoTotal.toFixed(2)}
                      </span>
                    </p>
                  )}
                  <div className="grid gap-2">
                    <Label>Fornecedor</Label>
                    <Input
                      value={form.fornecedor}
                      onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label>Responsável (usuário logado)</Label>
                <Input value={form.responsavel} readOnly disabled />
              </div>

              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Registrando..." : `Registrar ${tipo}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tipo === "entrada" ? "Entradas cadastradas" : `Últimas ${tipo}s`}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  {tipo === "entrada" && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tipo === "entrada" ? entradas : recentes).map((m) => {
                  const lote = todosLotes.find((item) => item.id === m.lote_id);
                  return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.data_movimentacao).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{m.produtos?.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.locais_estoque?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.quantidade} {m.produtos?.unidade_medida}
                    </TableCell>
                    {tipo === "entrada" && (
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" aria-label="Editar entrada" disabled={!lote} onClick={() => lote && abrirEdicao(lote)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
                {(tipo === "entrada" ? entradas : recentes).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tipo === "entrada" ? 5 : 4} className="text-center text-muted-foreground py-6">
                      Sem registros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
