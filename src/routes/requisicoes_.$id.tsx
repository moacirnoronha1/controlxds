import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, XCircle, Printer, Pencil, Plus, Trash2, History } from "lucide-react";
import {
  useRequisicao, useResponsaveis, useLiberarRequisicao, useCancelarRequisicao,
  useEditarItensRequisicao,
} from "@/lib/requisicoes";
import { useProdutos } from "@/lib/estoque";
import { gerarRequisicaoPDF } from "@/lib/requisicao-pdf";
import { useAuth, can } from "@/hooks/use-auth";

export const Route = createFileRoute("/requisicoes_/$id")({
  component: RequisicaoDetalhe,
  head: () => ({
    meta: [
      { title: "Análise de Requisição | GX Control" },
      { name: "description", content: "Analise, ajuste e libere itens de uma requisição do GX Control." },
      { property: "og:title", content: "Análise de Requisição | GX Control" },
      { property: "og:description", content: "Análise e liberação de requisições de estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pendente: "secondary", liberada: "default", cancelada: "destructive",
};

function RequisicaoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const podeLiberar = can(role, "liberateRequisicao");
  const q = useRequisicao(id);
  const responsaveis = useResponsaveis();
  const liberar = useLiberarRequisicao();
  const cancelar = useCancelarRequisicao();
  const editar = useEditarItensRequisicao();
  const produtos = useProdutos();
  const [respSelecionado, setRespSelecionado] = useState("");
  const [liberacoes, setLiberacoes] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState(false);
  const [observacaoAlteracao, setObservacaoAlteracao] = useState("");
  const [itensEditados, setItensEditados] = useState<Array<{ id?: string; produto_id: string; quantidade: string }>>([]);

  useEffect(() => {
    if (q.data?.itens) {
      const init: Record<string, string> = {};
      for (const it of q.data.itens) {
        init[it.id] = String(it.quantidade_liberada ?? it.quantidade_solicitada);
      }
      setLiberacoes(init);
    }
  }, [q.data?.requisicao?.id]);

  useEffect(() => {
    if (!editando && q.data?.itens) {
      setItensEditados(q.data.itens.map((item) => ({
        id: item.id,
        produto_id: item.produto_id,
        quantidade: String(item.quantidade_solicitada),
      })));
    }
  }, [q.data?.itens, editando]);

  if (q.isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!q.data?.requisicao) return <p className="text-muted-foreground">Requisição não encontrada.</p>;

  const { requisicao: r, itens } = q.data;
  const podeAgir = r.status === "pendente" && podeLiberar;
  const selecionados = new Set(itensEditados.map((item) => item.produto_id).filter(Boolean));

  async function salvarAlteracoes() {
    const validos = itensEditados.filter((item) => item.produto_id && Number(item.quantidade) > 0);
    if (validos.length === 0) return;
    if (new Set(validos.map((item) => item.produto_id)).size !== validos.length) return;
    await editar.mutateAsync({
      requisicao_id: r.id,
      observacao: observacaoAlteracao,
      itens: validos.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        produto_id: item.produto_id,
        quantidade: Number(item.quantidade),
      })),
    });
    setEditando(false);
    setObservacaoAlteracao("");
  }

  function payloadLiberacoes(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const it of itens) {
      const raw = liberacoes[it.id];
      const n = Number(raw);
      out[it.id] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return out;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/requisicoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Requisição #{String(r.numero).padStart(5, "0")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(r.data).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[r.status]} className="capitalize text-sm">{r.status}</Badge>
          {r.extra && <Badge variant="outline" className="text-sm">Extra / fora do horário</Badge>}
        </div>
      </div>

      <Card className="p-5 grid sm:grid-cols-2 gap-4">
        <div><Label className="text-xs">Requisitante</Label><p className="text-sm">{r.requisitante}</p></div>
        <div><Label className="text-xs">Setor</Label><p className="text-sm">{r.setor}</p></div>
        <div><Label className="text-xs">Requisição extra / fora do horário</Label><p className="text-sm">{r.extra ? "Sim" : "Não"}</p></div>
        <div><Label className="text-xs">Responsável liberação</Label><p className="text-sm">{r.responsavel_liberacao ?? "—"}</p></div>
        <div><Label className="text-xs">Liberada em</Label><p className="text-sm">{r.liberada_em ? new Date(r.liberada_em).toLocaleString("pt-BR") : "—"}</p></div>
        {r.observacao && (
          <div className="sm:col-span-2"><Label className="text-xs">Observação</Label><p className="text-sm">{r.observacao}</p></div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Itens da requisição</h2>
        {podeAgir && !editando && (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Ajustar itens
          </Button>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Solicitado</TableHead>
              <TableHead className="text-right w-40">Liberar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(editando ? itensEditados : itens).map((it, i) => (
              <TableRow key={it.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">
                  {editando ? (produtos.data ?? []).find((p) => p.id === it.produto_id)?.codigo_barras ?? "—" : it.codigo || it.produtos?.codigo_barras || "—"}
                </TableCell>
                <TableCell>
                  {editando ? (
                    <Select
                      value={it.produto_id}
                      onValueChange={(produto_id) => setItensEditados((atuais) => atuais.map((x, index) => index === i ? { ...x, produto_id } : x))}
                    >
                      <SelectTrigger className="min-w-52"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {(produtos.data ?? []).filter((p) => p.ativo).map((p) => (
                          <SelectItem key={p.id} value={p.id} disabled={p.id !== it.produto_id && selecionados.has(p.id)}>
                            {p.nome} ({p.estoque_atual} {p.unidade_medida})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : it.produtos?.nome}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {editando ? (
                    <Input
                      type="number" min="0.000001" step="any"
                      className="w-28 ml-auto text-right"
                      value={it.quantidade}
                      onChange={(event) => setItensEditados((atuais) => atuais.map((x, index) => index === i ? { ...x, quantidade: event.target.value } : x))}
                    />
                  ) : `${it.quantidade_solicitada} ${it.produtos?.unidade_medida ?? ""}`}
                </TableCell>
                <TableCell className="text-right">
                  {editando ? (
                    <Button
                      type="button" variant="ghost" size="icon" aria-label="Excluir item"
                      disabled={itensEditados.length === 1}
                      onClick={() => setItensEditados((atuais) => atuais.filter((_, index) => index !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : podeAgir ? (
                    <Input
                      type="number" min="0" step="any"
                      className="w-28 ml-auto text-right"
                      value={liberacoes[it.id] ?? ""}
                      onChange={(e) =>
                        setLiberacoes((s) => ({ ...s, [it.id]: e.target.value }))
                      }
                    />
                  ) : (
                    <span className="tabular-nums">
                      {it.quantidade_liberada ?? 0} {it.produtos?.unidade_medida}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editando && (
        <Card className="p-4 space-y-4">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setItensEditados((atuais) => [...atuais, { produto_id: "", quantidade: "" }])}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar produto
          </Button>
          <div className="grid gap-2">
            <Label>Observação da alteração</Label>
            <Textarea
              value={observacaoAlteracao}
              onChange={(event) => setObservacaoAlteracao(event.target.value)}
              placeholder="Explique o motivo da correção"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditando(false)} disabled={editar.isPending}>Cancelar</Button>
            <Button
              onClick={salvarAlteracoes}
              disabled={editar.isPending || !observacaoAlteracao.trim() || itensEditados.some((item) => !item.produto_id || Number(item.quantidade) <= 0) || selecionados.size !== itensEditados.length}
            >
              {editar.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <Button variant="outline" onClick={() => gerarRequisicaoPDF(r, itens)}>
          <Printer className="h-4 w-4 mr-1" /> Gerar PDF
        </Button>

        {podeAgir && (
          <>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Responsável pela liberação</Label>
              <Select value={respSelecionado} onValueChange={setRespSelecionado}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(responsaveis.data ?? []).filter((x) => x.ativo).map((x) => (
                    <SelectItem key={x.id} value={x.nome}>
                      {x.nome}{x.cargo ? ` — ${x.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!respSelecionado || liberar.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Liberar e baixar estoque
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar liberação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O sistema baixará somente a quantidade liberada de cada item, priorizando os lotes com validade mais próxima (FEFO).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      liberar.mutate({
                        id: r.id,
                        responsavel: respSelecionado,
                        liberacoes: payloadLiberacoes(),
                      })
                    }
                  >
                    Liberar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" /> Cancelar requisição
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar esta requisição?</AlertDialogTitle>
                  <AlertDialogDescription>Não baixa estoque. A requisição fica marcada como cancelada.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => { await cancelar.mutateAsync(r.id); navigate({ to: "/requisicoes" }); }}
                  >
                    Cancelar requisição
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Histórico de alterações</h2>
        <Card className="divide-y">
          {(q.data.historico ?? []).map((alteracao) => (
            <div key={alteracao.id} className="p-4 text-sm space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium capitalize">{alteracao.acao}</span>
                <span className="text-xs text-muted-foreground">{new Date(alteracao.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p>
                {alteracao.produto_original?.nome ?? "—"}
                {alteracao.acao === "substituicao" ? ` → ${alteracao.produto_novo?.nome ?? "—"}` : ""}
                {alteracao.acao === "inclusao" ? alteracao.produto_novo?.nome ?? "—" : ""}
                {alteracao.quantidade_original != null || alteracao.quantidade_nova != null
                  ? ` · ${alteracao.quantidade_original ?? "—"} → ${alteracao.quantidade_nova ?? "—"}`
                  : ""}
              </p>
              <p className="text-muted-foreground">{alteracao.observacao}</p>
              <p className="text-xs text-muted-foreground">{alteracao.alterado_por} · {alteracao.cargo}</p>
            </div>
          ))}
          {(q.data.historico ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
        </Card>
      </section>
    </div>
  );
}
