import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, ClipboardCheck } from "lucide-react";
import { useAuth, can } from "@/hooks/use-auth";
import {
  useProdutoSolicitacoes,
  useAprovarSolicitacaoProduto,
  useRecusarSolicitacaoProduto,
  SOLICITACAO_TIPO_LABEL,
  SOLICITACAO_STATUS_LABEL,
  diffCampos,
  type SolicitacaoStatus,
  type ProdutoSolicitacao,
} from "@/lib/produto-solicitacoes";
import { toast } from "sonner";

export const Route = createFileRoute("/aprovacoes")({
  component: AprovacoesPage,
  head: () => ({
    meta: [
      { title: "Aprovações Pendentes | GX Control" },
      {
        name: "description",
        content:
          "Aprove ou recuse inclusões, edições e exclusões de produtos solicitadas pela equipe de estoque.",
      },
      { property: "og:title", content: "Aprovações Pendentes | GX Control" },
      {
        property: "og:description",
        content: "Fluxo de aprovação de cadastro de produtos no GX Control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_VARIANT: Record<SolicitacaoStatus, "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  recusado: "destructive",
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function Proposta({ s }: { s: ProdutoSolicitacao }) {
  if (s.tipo === "exclusao") {
    return <span className="text-muted-foreground">Excluir produto{s.motivo ? ` — ${s.motivo}` : ""}</span>;
  }
  const campos = diffCampos(s.tipo === "inclusao" ? {} : s.dados_antes, s.dados_propostos);
  if (campos.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5 text-xs">
      {campos.map((c) => (
        <div key={c.campo}>
          <span className="text-muted-foreground">{c.campo}: </span>
          {s.tipo === "edicao" ? (
            <>
              <span className="line-through text-muted-foreground">{c.de}</span>{" "}
              <span className="font-medium">→ {c.para}</span>
            </>
          ) : (
            <span className="font-medium">{c.para}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AprovacoesPage() {
  const { role, displayName } = useAuth();
  const canApprove = can(role, "approveProduto");
  const { data: lista = [], isLoading } = useProdutoSolicitacoes();
  const aprovar = useAprovarSolicitacaoProduto();
  const recusar = useRecusarSolicitacaoProduto();
  const [tab, setTab] = useState<SolicitacaoStatus>("pendente");
  const [recusando, setRecusando] = useState<ProdutoSolicitacao | null>(null);
  const [motivo, setMotivo] = useState("");

  const filtradas = useMemo(() => lista.filter((s) => s.status === tab), [lista, tab]);
  const pendentes = lista.filter((s) => s.status === "pendente").length;

  if (!canApprove && role !== "lider") {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Você não tem acesso às aprovações de produtos.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" /> Aprovações Pendentes
        </h1>
        <p className="text-sm text-muted-foreground">
          Inclusões, edições e exclusões de produtos aguardando decisão do Mestre.
          {pendentes > 0 && ` (${pendentes} pendente${pendentes > 1 ? "s" : ""})`}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SolicitacaoStatus)}>
        <TabsList>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="recusado">Recusados</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Alteração proposta</TableHead>
              <TableHead>Solicitado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Badge variant="outline">{SOLICITACAO_TIPO_LABEL[s.tipo]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{s.produto_nome}</TableCell>
                <TableCell><Proposta s={s} /></TableCell>
                <TableCell>{s.solicitado_por ?? "—"}</TableCell>
                <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status]}>
                    {SOLICITACAO_STATUS_LABEL[s.status]}
                  </Badge>
                  {s.status !== "pendente" && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.decidido_por ?? "—"} · {fmtDate(s.decidido_em)}
                      {s.decisao_motivo ? ` · ${s.decisao_motivo}` : ""}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {s.status === "pendente" && canApprove && (
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!displayName) return toast.error("Usuário não identificado");
                          aprovar.mutate({ id: s.id, responsavel: displayName });
                        }}
                        disabled={aprovar.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRecusando(s);
                          setMotivo("");
                        }}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!recusando} onOpenChange={(o) => !o && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da recusa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecusando(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={recusar.isPending}
              onClick={async () => {
                if (!recusando) return;
                if (!motivo.trim()) return toast.error("Informe o motivo");
                await recusar.mutateAsync({
                  id: recusando.id,
                  responsavel: displayName,
                  motivo: motivo.trim(),
                });
                setRecusando(null);
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
