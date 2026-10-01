import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, BadgeDollarSign, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { calcularIndicadores, fmtMoeda, fmtVariacao, type EntradaCusto } from "@/lib/custos";
import { useLotes, useMovimentacoes, useProdutos, type Produto } from "@/lib/estoque";

export const Route = createFileRoute("/precos")({
  component: CentralPrecosPage,
  head: () => ({
    meta: [
      { title: "Central de Preços de Insumos | GX Control" },
      { name: "description", content: "Histórico e comparação dos preços de entrada dos insumos." },
      { property: "og:title", content: "Central de Preços de Insumos | GX Control" },
      { property: "og:description", content: "Histórico e comparação dos preços de entrada dos insumos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type EntradaDetalhada = EntradaCusto & {
  produto: Produto;
  unidade: string;
  responsavel: string | null;
  observacao: string | null;
};

function CentralPrecosPage() {
  const { data: produtos = [] } = useProdutos();
  const { data: lotes = [], isLoading } = useLotes();
  const { data: movimentacoes = [] } = useMovimentacoes(5000);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [fornecedor, setFornecedor] = useState("all");
  const [produtoId, setProdutoId] = useState("all");
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);

  const entradas = useMemo(() => {
    const produtoPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    const movimentoPorLote = new Map(
      movimentacoes
        .filter((movimento) => movimento.tipo === "entrada" && movimento.lote_id)
        .map((movimento) => [movimento.lote_id as string, movimento]),
    );

    return lotes.flatMap<EntradaDetalhada>((lote) => {
      const produto = produtoPorId.get(lote.produto_id);
      if (!produto || lote.custo_unitario == null || Number(lote.custo_unitario) <= 0) return [];
      const movimento = movimentoPorLote.get(lote.id);
      const quantidade = Number(lote.quantidade_inicial) || 0;
      const custoUnitario = Number(lote.custo_unitario);
      return [{
        lote_id: lote.id,
        produto_id: lote.produto_id,
        produto,
        data: movimento?.data_movimentacao ?? lote.created_at,
        fornecedor: lote.fornecedor,
        validade: lote.validade,
        local: lote.locais_estoque?.nome ?? null,
        quantidade,
        unidade: produto.unidade_medida,
        custoUnitario,
        custoTotal: quantidade * custoUnitario,
        responsavel: movimento?.responsavel ?? null,
        observacao: lote.observacao ?? movimento?.observacao ?? null,
      }];
    }).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [lotes, movimentacoes, produtos]);

  const fornecedores = useMemo(
    () => Array.from(new Set(entradas.map((entrada) => entrada.fornecedor).filter((item): item is string => !!item))).sort(),
    [entradas],
  );

  const entradasFiltradas = useMemo(() => entradas.filter((entrada) => {
    const data = entrada.data.slice(0, 10);
    if (de && data < de) return false;
    if (ate && data > ate) return false;
    if (fornecedor !== "all" && entrada.fornecedor !== fornecedor) return false;
    if (produtoId !== "all" && entrada.produto_id !== produtoId) return false;
    return true;
  }), [ate, de, entradas, fornecedor, produtoId]);

  const resumos = useMemo(() => {
    const porProduto = new Map<string, EntradaDetalhada[]>();
    for (const entrada of entradasFiltradas) {
      const lista = porProduto.get(entrada.produto_id) ?? [];
      lista.push(entrada);
      porProduto.set(entrada.produto_id, lista);
    }
    return Array.from(porProduto.values())
      .map((lista) => ({ produto: lista[0].produto, entradas: lista, indicadores: calcularIndicadores(lista) }))
      .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR"));
  }, [entradasFiltradas]);

  const entradasProdutoAberto = produtoAberto
    ? entradasFiltradas.filter((entrada) => entrada.produto_id === produtoAberto.id)
    : [];
  const historicoAberto = [...entradasProdutoAberto].reverse();
  const resumoAberto = produtoAberto ? calcularIndicadores(entradasProdutoAberto) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BadgeDollarSign className="h-6 w-6 text-primary" />
          Central de Preços de Insumos
        </h1>
        <p className="text-sm text-muted-foreground">Preços registrados nas entradas e lotes de estoque.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-1">
          <Label htmlFor="precos-de" className="text-xs">De</Label>
          <Input id="precos-de" type="date" value={de} onChange={(event) => setDe(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="precos-ate" className="text-xs">Até</Label>
          <Input id="precos-ate" type="date" value={ate} onChange={(event) => setAte(event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={fornecedor} onValueChange={setFornecedor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {fornecedores.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Produto</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos.map((produto) => <SelectItem key={produto.id} value={produto.id}>{produto.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Último preço</TableHead>
                <TableHead className="text-right">Preço anterior</TableHead>
                <TableHead className="text-right">Média ponderada</TableHead>
                <TableHead className="text-right">Menor</TableHead>
                <TableHead className="text-right">Maior</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && resumos.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma entrada com preço encontrada.</TableCell></TableRow>}
              {resumos.map(({ produto, entradas: registros, indicadores }) => (
                <TableRow key={produto.id}>
                  <TableCell>
                    <Button variant="link" className="h-auto p-0 font-medium" onClick={() => setProdutoAberto(produto)}>
                      {produto.nome}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(indicadores.ultimo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(indicadores.anterior)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(indicadores.medioPonderado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(indicadores.menor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoeda(indicadores.maior)}</TableCell>
                  <TableCell className="text-right">
                    <span className={indicadores.alerta ? "inline-flex items-center gap-1 font-semibold text-destructive" : "tabular-nums"}>
                      {indicadores.alerta && <AlertTriangle className="h-4 w-4" />}
                      {fmtVariacao(indicadores.variacao)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{registros.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!produtoAberto} onOpenChange={(open) => { if (!open) setProdutoAberto(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Histórico — {produtoAberto?.nome}</DialogTitle>
          </DialogHeader>
          {resumoAberto && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Indicador label="Último preço" value={fmtMoeda(resumoAberto.ultimo)} />
              <Indicador label="Preço anterior" value={fmtMoeda(resumoAberto.anterior)} />
              <Indicador label="Média ponderada" value={fmtMoeda(resumoAberto.medioPonderado)} />
              <Indicador label="Menor preço" value={fmtMoeda(resumoAberto.menor)} />
              <Indicador label="Maior preço" value={fmtMoeda(resumoAberto.maior)} />
              <Indicador label="Variação" value={fmtVariacao(resumoAberto.variacao)} alerta={resumoAberto.alerta} />
            </div>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data da entrada</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Custo unitário</TableHead>
                  <TableHead>Validade / lote</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoAberto.map((entrada) => (
                  <TableRow key={entrada.lote_id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(entrada.data).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{entrada.fornecedor ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{entrada.quantidade.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{entrada.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoeda(entrada.custoUnitario)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{entrada.validade ? new Date(`${entrada.validade}T00:00:00`).toLocaleDateString("pt-BR") : "Sem validade"}</div>
                      <div className="text-muted-foreground">Lote {entrada.lote_id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell>{entrada.local ?? "—"}</TableCell>
                    <TableCell>{entrada.responsavel ?? "—"}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal text-xs text-muted-foreground">{entrada.observacao ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Os filtros da central também são aplicados a este histórico.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Indicador({ label, value, alerta = false }: { label: string; value: string; alerta?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={alerta ? "mt-1 flex items-center gap-1 font-semibold text-destructive" : "mt-1 font-semibold tabular-nums"}>
        {alerta && <AlertTriangle className="h-4 w-4" />}{value}
      </div>
      {alerta && <Badge variant="destructive" className="mt-2">Acima de 20%</Badge>}
    </div>
  );
}