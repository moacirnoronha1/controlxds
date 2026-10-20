import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useDecidirValidade, useValidadeSolicitacoes, type ValidadeSolicitacao } from "@/lib/validade-solicitacoes";

const dt = (v: string | null) => (v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR") : "Sem validade");
const STATUS = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado" } as const;

export function ValidadeAprovacoes({ status, canApprove }: { status: "pendente" | "aprovado" | "recusado"; canApprove: boolean }) {
  const { data = [], isLoading } = useValidadeSolicitacoes();
  const decidir = useDecidirValidade();
  const [recusando, setRecusando] = useState<ValidadeSolicitacao | null>(null);
  const [motivo, setMotivo] = useState("");
  const lista = data.filter((s) => s.status === status);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <CalendarClock className="h-5 w-5" /> Alterações de validade
      </h2>
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Local / saldo</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Solicitado por</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && lista.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma solicitação.</TableCell></TableRow>}
            {lista.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.produtos?.nome ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.lotes?.locais_estoque?.nome ?? "—"} · {s.lotes?.saldo ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  <span className="line-through text-muted-foreground">{dt(s.validade_antiga)}</span>{" "}
                  <span className="font-medium">→ {dt(s.validade_nova)}</span>
                </TableCell>
                <TableCell className="text-sm">{s.motivo}</TableCell>
                <TableCell className="text-sm">{s.solicitado_por}<div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</div></TableCell>
                <TableCell>
                  <Badge variant={s.status === "recusado" ? "destructive" : s.status === "aprovado" ? "default" : "secondary"}>{STATUS[s.status]}</Badge>
                  {s.status !== "pendente" && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.decidido_por} · {s.decidido_em ? new Date(s.decidido_em).toLocaleString("pt-BR") : ""}
                      {s.decisao_motivo ? ` · ${s.decisao_motivo}` : ""}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {s.status === "pendente" && canApprove && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: s.id, aprovar: true })}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRecusando(s); setMotivo(""); }}>
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
          <DialogHeader><DialogTitle>Recusar alteração de validade</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo da recusa" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecusando(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={decidir.isPending} onClick={async () => {
              if (!recusando) return;
              if (!motivo.trim()) return toast.error("Informe o motivo");
              await decidir.mutateAsync({ id: recusando.id, aprovar: false, motivo: motivo.trim() });
              setRecusando(null);
            }}>Recusar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
