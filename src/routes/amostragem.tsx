import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dices, FileDown, FileSearch, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, can } from "@/hooks/use-auth";
import { useLocais, useLotes, useProdutos } from "@/lib/estoque";
import {
  ITENS_POR_RELATORIO, sortearProdutos, useAmostragemItens, useAmostragens,
  useCriarAmostragem, useExcluirAmostragem, useSalvarContagem,
  type Amostragem,
} from "@/lib/amostragem";
import { gerarAmostragemPDF } from "@/lib/amostragem-pdf";

export const Route = createFileRoute("/amostragem")({
  component: AmostragemPage,
  head: () => ({
    meta: [
      { title: "Amostragem Aleatória | GX Control" },
      { name: "description", content: "Relatório diário de conferência com 5 produtos sorteados aleatoriamente, sem alterar o estoque." },
      { property: "og:title", content: "Amostragem Aleatória | GX Control" },
      { property: "og:description", content: "Auditoria rápida de estoque por amostragem aleatória." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AmostragemPage() {
  const { role, displayName } = useAuth();
  const podeGerar = can(role, "createMovement");
  const podeExcluir = can(role, "manageProducts");

  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();
  const { data: lotes = [] } = useLotes();
  const { data: relatorios = [], isLoading } = useAmostragens();
  const criar = useCriarAmostragem();
  const excluir = useExcluirAmostragem();

  const [local, setLocal] = useState("todos");
  const [aberto, setAberto] = useState<Amostragem | null>(null);

  const saldoPorLocal = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lotes) {
      const k = `${l.produto_id}|${l.local_id}`;
      m.set(k, (m.get(k) ?? 0) + Number(l.saldo || 0));
    }
    return m;
  }, [lotes]);

  async function gerar() {
    const ativos = produtos.filter((p) => p.ativo);
    const candidatos =
      local === "todos"
        ? ativos
        : ativos.filter((p) => (saldoPorLocal.get(`${p.id}|${local}`) ?? 0) > 0);

    if (candidatos.length === 0) {
      toast.error("Nenhum produto disponível para sorteio neste local");
      return;
    }

    const sorteados = sortearProdutos(candidatos, ITENS_POR_RELATORIO);
    const localNome = local === "todos" ? null : locais.find((l) => l.id === local)?.nome ?? null;

    await criar.mutateAsync({
      data: format(new Date(), "yyyy-MM-dd"),
      responsavel: displayName,
      local_id: local === "todos" ? null : local,
      local_nome: localNome,
      itens: sorteados.map((p) => ({
        produto_id: p.id,
        categoria: p.categoria,
        estoque_sistema:
          local === "todos"
            ? Number(p.estoque_atual || 0)
            : saldoPorLocal.get(`${p.id}|${local}`) ?? 0,
      })),
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4 print:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Relatório de Amostragem Aleatória</h1>
          <p className="text-sm text-muted-foreground">
            Sorteio diário de {ITENS_POR_RELATORIO} produtos para conferência. Não altera o estoque.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={local} onValueChange={setLocal}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os locais</SelectItem>
              {locais.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          {podeGerar && (
            <Button onClick={gerar} disabled={criar.isPending}>
              <Dices className="h-4 w-4 mr-1" /> Sortear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto print:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Gerado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && relatorios.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum relatório gerado</TableCell></TableRow>
            )}
            {relatorios.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">
                  {format(new Date(r.data + "T00:00:00"), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>{r.responsavel || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.locais_estoque?.nome || "Todos"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(r.created_at), "dd/MM/yy HH:mm")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setAberto(r)}>
                      <FileSearch className="h-4 w-4" />
                    </Button>
                    {podeExcluir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir este relatório?")) excluir.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto">
          {aberto && <DetalheRelatorio rel={aberto} podeEditar={podeGerar} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalheRelatorio({ rel, podeEditar }: { rel: Amostragem; podeEditar: boolean }) {
  const { data: itens = [], isLoading } = useAmostragemItens(rel.id);
  const salvar = useSalvarContagem();

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Amostragem de {format(new Date(rel.data + "T00:00:00"), "dd/MM/yyyy")}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div><span className="text-muted-foreground">Responsável: </span>{rel.responsavel || "—"}</div>
        <div><span className="text-muted-foreground">Local: </span>{rel.locais_estoque?.nome || "Todos"}</div>
        <div><span className="text-muted-foreground">Itens: </span>{itens.length}</div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Estoque sistema</TableHead>
              <TableHead className="w-[130px]">Contagem física</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="w-[200px]">Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {itens.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.produtos?.nome ?? "—"}</TableCell>
                <TableCell className="text-sm">{it.categoria || "—"}</TableCell>
                <TableCell className="text-sm">{it.local_nome || "Todos"}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(it.estoque_sistema)} {it.produtos?.unidade_medida}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="any"
                    disabled={!podeEditar}
                    defaultValue={it.contagem_fisica ?? ""}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const val = raw === "" ? null : Number(raw);
                      if (val === (it.contagem_fisica ?? null)) return;
                      salvar.mutate({
                        id: it.id,
                        amostragem_id: rel.id,
                        contagem_fisica: val,
                        observacao: it.observacao,
                        estoque_sistema: Number(it.estoque_sistema),
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {it.diferenca === null || it.diferenca === undefined ? (
                    "—"
                  ) : (
                    <span
                      className={
                        Number(it.diferenca) === 0
                          ? "text-muted-foreground"
                          : Number(it.diferenca) > 0
                            ? "text-emerald-500"
                            : "text-destructive"
                      }
                    >
                      {Number(it.diferenca) > 0 ? "+" : ""}
                      {Number(it.diferenca)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Textarea
                    rows={1}
                    disabled={!podeEditar}
                    defaultValue={it.observacao ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim() || null;
                      if (val === (it.observacao ?? null)) return;
                      salvar.mutate({
                        id: it.id,
                        amostragem_id: rel.id,
                        contagem_fisica: it.contagem_fisica,
                        observacao: val,
                        estoque_sistema: Number(it.estoque_sistema),
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Relatório de auditoria: diferenças são apenas informativas e não geram ajuste de estoque.
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir
        </Button>
        <Button onClick={() => gerarAmostragemPDF(rel, itens)}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </DialogFooter>
    </>
  );
}
