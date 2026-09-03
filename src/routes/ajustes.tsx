import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, X, SlidersHorizontal, Search } from "lucide-react";
import { useAuth, can } from "@/hooks/use-auth";
import { useProdutos, useLocais, useLotes } from "@/lib/estoque";
import {
  useAjustes, useCriarAjuste, useAprovarAjuste, useRecusarAjuste,
  AJUSTE_TIPO_LABEL, AJUSTE_STATUS_LABEL,
  type AjusteTipo, type AjusteStatus,
} from "@/lib/ajustes";
import { toast } from "sonner";

export const Route = createFileRoute("/ajustes")({
  component: AjustesPage,
  head: () => ({
    meta: [
      { title: "Ajustes de Estoque | GX Control" },
      {
        name: "description",
        content:
          "Solicite ajustes de estoque e acompanhe aprovações, recusas e o histórico de saldo antes e depois.",
      },
      { property: "og:title", content: "Ajustes de Estoque | GX Control" },
      {
        property: "og:description",
        content: "Ajustes de estoque com aprovação de Mestre ou Líder no GX Control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_VARIANT: Record<AjusteStatus, "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  recusado: "destructive",
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function AjustesPage() {
  const { user, role } = useAuth();
  const podeCriar = can(role, "createAjuste");
  const podeAprovar = can(role, "approveAjuste");

  const ajustes = useAjustes();
  const produtos = useProdutos();
  const locais = useLocais();
  const criar = useCriarAjuste();
  const aprovar = useAprovarAjuste();
  const recusar = useRecusarAjuste();

  const [aba, setAba] = useState<AjusteStatus>("pendente");
  const [busca, setBusca] = useState("");

  const [open, setOpen] = useState(false);
  const [produtoId, setProdutoId] = useState("");
  const [localId, setLocalId] = useState("");
  const [loteId, setLoteId] = useState("");
  const tipo: AjusteTipo = "correcao";
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");

  const [recusaId, setRecusaId] = useState<string | null>(null);
  const [recusaMotivo, setRecusaMotivo] = useState("");

  const lotes = useLotes(produtoId || undefined);
  const lotesDisponiveis = (lotes.data ?? []).filter((l) => Number(l.saldo) > 0);

  const produtoSel = (produtos.data ?? []).find((p) => p.id === produtoId);
  const saldoSistema = Number(produtoSel?.estoque_atual ?? 0);
  const informado = Number(quantidade);
  const diferenca = Number.isFinite(informado) && quantidade !== "" ? informado - saldoSistema : null;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (ajustes.data ?? []).filter(
      (a) =>
        a.status === aba &&
        (!q || (a.produtos?.nome ?? "").toLowerCase().includes(q)),
    );
  }, [ajustes.data, aba, busca]);


  const pendentes = (ajustes.data ?? []).filter((a) => a.status === "pendente").length;

  function reset() {
    setProdutoId("");
    setLocalId("");
    setLoteId("");
    setQuantidade("");
    setMotivo("");
  }

  async function submit() {
    if (!user) return toast.error("Usuário não identificado");
    if (!produtoId) return toast.error("Selecione o produto");
    const qtd = Number(quantidade);
    if (quantidade === "" || !Number.isFinite(qtd) || qtd < 0)
      return toast.error("Informe o estoque atual contado");
    if (!motivo.trim()) return toast.error("Informe o motivo do ajuste");


    await criar.mutateAsync({
      produto_id: produtoId,
      local_id: localId || null,
      lote_id: loteId || null,
      tipo,
      quantidade: qtd,
      motivo: motivo.trim(),
      solicitado_por: user.nome,
    });
    reset();
    setOpen(false);
  }

  if (!podeCriar && !podeAprovar) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes de Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar os ajustes de estoque.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes de Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Todo ajuste fica pendente até a aprovação de um Mestre ou Líder.
          </p>
        </div>
        {podeCriar && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Solicitar ajuste
          </Button>
        )}
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as AjusteStatus)}>
        <TabsList>
          <TabsTrigger value="pendente">
            Pendentes{pendentes > 0 ? ` (${pendentes})` : ""}
          </TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="recusado">Recusados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>


      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Lote/Validade</TableHead>
              <TableHead className="text-right">Estoque informado</TableHead>
              <TableHead className="text-right">Diferença</TableHead>

              <TableHead>Motivo</TableHead>
              <TableHead>Solicitado por</TableHead>
              {aba !== "pendente" && (
                <>
                  <TableHead className="text-right">Saldo antes</TableHead>
                  <TableHead className="text-right">Saldo depois</TableHead>
                  <TableHead>Decidido por</TableHead>
                  <TableHead>Decidido em</TableHead>
                </>
              )}
              <TableHead>Status</TableHead>
              {aba === "pendente" && podeAprovar && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(a.created_at)}
                </TableCell>
                <TableCell>{a.produtos?.nome ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.locais_estoque?.nome ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {a.lotes?.validade
                    ? new Date(a.lotes.validade + "T00:00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.quantidade} {a.produtos?.unidade_medida ?? ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.saldo_antes != null
                    ? `${Number(a.saldo_depois ?? a.quantidade) - Number(a.saldo_antes) > 0 ? "+" : ""}${
                        Number(a.saldo_depois ?? a.quantidade) - Number(a.saldo_antes)
                      }`
                    : "—"}
                </TableCell>

                <TableCell className="text-muted-foreground text-xs max-w-[220px]">
                  {a.motivo ?? "—"}
                  {a.decisao_motivo ? (
                    <span className="block text-destructive">Recusa: {a.decisao_motivo}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{a.solicitado_por ?? "—"}</TableCell>
                {aba !== "pendente" && (
                  <>
                    <TableCell className="text-right tabular-nums">{a.saldo_antes ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.saldo_depois ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.decidido_por ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(a.decidido_em)}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status]}>{AJUSTE_STATUS_LABEL[a.status]}</Badge>
                </TableCell>
                {aba === "pendente" && podeAprovar && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={aprovar.isPending}
                      onClick={() => {
                        if (!user) return toast.error("Usuário não identificado");
                        aprovar.mutate({ id: a.id, responsavel: user.nome });
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        setRecusaId(a.id);
                        setRecusaMotivo("");
                      }}
                    >
                      <X className="h-4 w-4 mr-1" /> Recusar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                  Nenhum ajuste encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Solicitar ajuste */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar ajuste de estoque</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Produto</Label>
              <Select
                value={produtoId}
                onValueChange={(v) => {
                  setProdutoId(v);
                  setLoteId("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {(produtos.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {p.estoque_atual} {p.unidade_medida}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as AjusteTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="correcao">Correção (saldo final)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Local de estoque</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger><SelectValue placeholder="Local padrão do produto" /></SelectTrigger>
                <SelectContent>
                  {(locais.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipo !== "entrada" && (
              <div className="grid gap-1.5">
                <Label>Lote / validade (opcional)</Label>
                <Select value={loteId} onValueChange={setLoteId} disabled={!produtoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Automático (validade mais próxima)" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponiveis.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.validade
                          ? new Date(l.validade + "T00:00:00").toLocaleDateString("pt-BR")
                          : "Sem validade"}{" "}
                        — saldo {l.saldo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Motivo</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo do ajuste"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Solicitado por: <strong>{user?.nome ?? "—"}</strong>. O estoque só será alterado
              após aprovação de um Mestre ou Líder.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={criar.isPending}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recusar */}
      <Dialog open={!!recusaId} onOpenChange={(v) => { if (!v) setRecusaId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar ajuste</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Motivo da recusa</Label>
            <Textarea value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={recusar.isPending}
              onClick={async () => {
                if (!user) return toast.error("Usuário não identificado");
                if (!recusaMotivo.trim()) return toast.error("Informe o motivo da recusa");
                await recusar.mutateAsync({
                  id: recusaId!,
                  responsavel: user.nome,
                  motivo: recusaMotivo.trim(),
                });
                setRecusaId(null);
              }}
            >
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
