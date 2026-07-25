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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, XCircle, Printer } from "lucide-react";
import {
  useRequisicao, useResponsaveis, useLiberarRequisicao, useCancelarRequisicao,
} from "@/lib/requisicoes";
import { gerarRequisicaoPDF } from "@/lib/requisicao-pdf";
import { useAuth, can } from "@/hooks/use-auth";

export const Route = createFileRoute("/requisicoes_/$id")({
  component: RequisicaoDetalhe,
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
  const [respSelecionado, setRespSelecionado] = useState("");
  const [liberacoes, setLiberacoes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (q.data?.itens) {
      const init: Record<string, string> = {};
      for (const it of q.data.itens) {
        init[it.id] = String(it.quantidade_liberada ?? it.quantidade_solicitada);
      }
      setLiberacoes(init);
    }
  }, [q.data?.requisicao?.id]);

  if (q.isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!q.data?.requisicao) return <p className="text-muted-foreground">Requisição não encontrada.</p>;

  const { requisicao: r, itens } = q.data;
  const podeAgir = r.status === "pendente" && podeLiberar;

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
        <Badge variant={STATUS_VARIANT[r.status]} className="capitalize text-sm">{r.status}</Badge>
      </div>

      <Card className="p-5 grid sm:grid-cols-2 gap-4">
        <div><Label className="text-xs">Requisitante</Label><p className="text-sm">{r.requisitante}</p></div>
        <div><Label className="text-xs">Setor</Label><p className="text-sm">{r.setor}</p></div>
        <div><Label className="text-xs">Responsável liberação</Label><p className="text-sm">{r.responsavel_liberacao ?? "—"}</p></div>
        <div><Label className="text-xs">Liberada em</Label><p className="text-sm">{r.liberada_em ? new Date(r.liberada_em).toLocaleString("pt-BR") : "—"}</p></div>
        {r.observacao && (
          <div className="sm:col-span-2"><Label className="text-xs">Observação</Label><p className="text-sm">{r.observacao}</p></div>
        )}
      </Card>

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
            {itens.map((it, i) => (
              <TableRow key={it.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">{it.codigo || it.produtos?.codigo_barras || "—"}</TableCell>
                <TableCell>{it.produtos?.nome}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {it.quantidade_solicitada} {it.produtos?.unidade_medida}
                </TableCell>
                <TableCell className="text-right">
                  {podeAgir ? (
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
    </div>
  );
}
