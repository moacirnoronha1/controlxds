import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, can } from "@/hooks/use-auth";
import { useProdutos, useLocais } from "@/lib/estoque";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ShieldAlert, Filter, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/avarias")({
  component: AvariasPage,
});

type Momento = "na_chegada" | "depois_chegada";
type Tipo = "vencido" | "quebrado" | "danificado" | "perda_operacional" | "divergencia_contagem" | "outro";
type Status = "pendente" | "em_analise" | "aprovado" | "recusado" | "descontado" | "resolvido";

type Avaria = {
  id: string;
  data: string;
  produto_id: string;
  local_id: string | null;
  momento: Momento;
  tipo: Tipo;
  motivo: string | null;
  quantidade: number;
  barco: string | null;
  manifesto: string | null;
  quantidade_recebida: number | null;
  quantidade_avariada: number | null;
  quantidade_aproveitada: number | null;
  valor_estimado: number | null;
  chk_registrada: boolean;
  chk_evidencia: boolean;
  chk_comunicado: boolean;
  chk_aguardando: boolean;
  chk_aprovado: boolean;
  chk_recusado: boolean;
  chk_descontado: boolean;
  chk_resolvido: boolean;
  responsavel: string | null;
  observacao: string | null;
  status: Status;
  created_at: string;
  produtos?: { nome: string; unidade_medida: string } | null;
  locais_estoque?: { nome: string } | null;
};

const TIPO_LABEL: Record<Tipo, string> = {
  vencido: "Vencido",
  quebrado: "Quebrado",
  danificado: "Danificado",
  perda_operacional: "Perda operacional",
  divergencia_contagem: "Divergência de contagem",
  outro: "Outro",
};

const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
  descontado: "Descontado",
  resolvido: "Resolvido",
};

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "secondary",
  em_analise: "default",
  aprovado: "default",
  recusado: "destructive",
  descontado: "outline",
  resolvido: "outline",
};

function AvariasPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Avaria | null>(null);

  const [fProduto, setFProduto] = useState("all");
  const [fLocal, setFLocal] = useState("all");
  const [fBarco, setFBarco] = useState("");
  const [fManifesto, setFManifesto] = useState("");
  const [fStatus, setFStatus] = useState<Status | "all">("all");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const podeVer = can(role, "viewAvarias");
  const podeCriar = can(role, "createAvaria");
  const podeGerenciar = can(role, "manageAvarias");

  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["avarias"],
    enabled: podeVer,
    queryFn: async (): Promise<Avaria[]> => {
      const { data, error } = await supabase
        .from("avarias" as never)
        .select("*, produtos(nome, unidade_medida), locais_estoque(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Avaria[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fProduto !== "all" && r.produto_id !== fProduto) return false;
      if (fLocal !== "all" && r.local_id !== fLocal) return false;
      if (fBarco && !(r.barco ?? "").toLowerCase().includes(fBarco.toLowerCase())) return false;
      if (fManifesto && !(r.manifesto ?? "").toLowerCase().includes(fManifesto.toLowerCase())) return false;
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (fDe && r.data < fDe) return false;
      if (fAte && r.data > fAte) return false;
      return true;
    });
  }, [rows, fProduto, fLocal, fBarco, fManifesto, fStatus, fDe, fAte]);

  const alertas = useMemo(() => {
    return {
      chegadaPendentes: rows.filter((r) => r.momento === "na_chegada" && r.status === "pendente").length,
      emAnalise: rows.filter((r) => r.status === "em_analise").length,
      aguardandoDesconto: rows.filter((r) => r.status === "aprovado").length,
      recusadas: rows.filter((r) => r.status === "recusado").length,
      depoisChegada: rows.filter((r) => r.momento === "depois_chegada").length,
    };
  }, [rows]);

  const relatorios = useMemo(() => {
    const total = filtered.length;
    const custoTotal = filtered.reduce((s, r) => s + (Number(r.valor_estimado) || 0), 0);
    const porProduto = new Map<string, number>();
    const porLocal = new Map<string, { nome: string; qtd: number; valor: number }>();
    const porBarco = new Map<string, { qtd: number; valor: number }>();
    let pendenteDesconto = 0;
    for (const r of filtered) {
      const nome = r.produtos?.nome ?? "—";
      porProduto.set(nome, (porProduto.get(nome) ?? 0) + 1);
      const lk = r.local_id ?? "sem";
      const ln = r.locais_estoque?.nome ?? "Sem local";
      const l = porLocal.get(lk) ?? { nome: ln, qtd: 0, valor: 0 };
      l.qtd += 1; l.valor += Number(r.valor_estimado) || 0;
      porLocal.set(lk, l);
      if (r.barco) {
        const b = porBarco.get(r.barco) ?? { qtd: 0, valor: 0 };
        b.qtd += 1; b.valor += Number(r.valor_estimado) || 0;
        porBarco.set(r.barco, b);
      }
      if (r.momento === "na_chegada" && (r.status === "aprovado" || r.status === "em_analise")) {
        pendenteDesconto += Number(r.valor_estimado) || 0;
      }
    }
    const topProdutos = [...porProduto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { total, custoTotal, topProdutos, porLocal: [...porLocal.values()], porBarco: [...porBarco.entries()], pendenteDesconto };
  }, [filtered]);

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; status: Status }) => {
      const { error } = await supabase.from("avarias" as never).update({ status: p.status } as never).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["avarias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateChecklist = useMutation({
    mutationFn: async (p: { id: string; field: keyof Avaria; value: boolean }) => {
      const { error } = await supabase.from("avarias" as never).update({ [p.field]: p.value } as never).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avarias"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!podeVer) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Seu cargo não tem acesso a esta área.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Avarias</h1>
          <p className="text-sm text-muted-foreground">
            Registre produtos vencidos, quebrados, danificados ou perdidos, separando chegada e pós-chegada.
          </p>
        </div>
        {podeCriar && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova avaria
          </Button>
        )}
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <AlertaCard label="Chegada — pendentes" value={alertas.chegadaPendentes} tone="warn" />
        <AlertaCard label="Em análise" value={alertas.emAnalise} tone="info" />
        <AlertaCard label="Aguardando desconto" value={alertas.aguardandoDesconto} tone="info" />
        <AlertaCard label="Recusadas" value={alertas.recusadas} tone="danger" />
        <AlertaCard label="Depois da chegada" value={alertas.depoisChegada} tone="muted" />
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="relatorio">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" /> Filtros
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Produto</Label>
                <Select value={fProduto} onValueChange={setFProduto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Local</Label>
                <Select value={fLocal} onValueChange={setFLocal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as Status | "all")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Barco/Transportadora</Label>
                <Input value={fBarco} onChange={(e) => setFBarco(e.target.value)} placeholder="Buscar..." />
              </div>
              <div className="space-y-1">
                <Label>Manifesto</Label>
                <Input value={fManifesto} onChange={(e) => setFManifesto(e.target.value)} placeholder="Nº manifesto" />
              </div>
              <div className="space-y-1">
                <Label>De</Label>
                <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Até</Label>
                <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Momento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Barco / Manifesto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">—</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma avaria encontrada.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const qtd = r.momento === "na_chegada" ? Number(r.quantidade_avariada ?? 0) : Number(r.quantidade ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.data}</TableCell>
                      <TableCell className="font-medium">{r.produtos?.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.locais_estoque?.nome ?? "—"}</TableCell>
                      <TableCell>
                        {r.momento === "na_chegada"
                          ? <Badge variant="outline">Na chegada</Badge>
                          : <Badge variant="secondary">Pós-chegada</Badge>}
                      </TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {qtd} {r.produtos?.unidade_medida ?? ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.barco ? <div>{r.barco}</div> : <span className="text-muted-foreground">—</span>}
                        {r.manifesto && <div className="text-muted-foreground">#{r.manifesto}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setViewing(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="relatorio" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <StatCard label="Total no período" value={String(relatorios.total)} />
            <StatCard label="Custo estimado" value={formatBRL(relatorios.custoTotal)} />
            <StatCard label="Pendente de desconto" value={formatBRL(relatorios.pendenteDesconto)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Produtos com mais avarias</div>
              <ul className="text-sm space-y-1">
                {relatorios.topProdutos.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
                {relatorios.topProdutos.map(([nome, qtd]) => (
                  <li key={nome} className="flex justify-between">
                    <span className="truncate mr-2">{nome}</span>
                    <span className="tabular-nums text-muted-foreground">{qtd}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Por local de estoque</div>
              <ul className="text-sm space-y-1">
                {relatorios.porLocal.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
                {relatorios.porLocal.map((l) => (
                  <li key={l.nome} className="flex justify-between">
                    <span className="truncate mr-2">{l.nome}</span>
                    <span className="tabular-nums text-muted-foreground">{l.qtd} · {formatBRL(l.valor)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Por barco/transportadora</div>
              <ul className="text-sm space-y-1">
                {relatorios.porBarco.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
                {relatorios.porBarco.map(([nome, v]) => (
                  <li key={nome} className="flex justify-between">
                    <span className="truncate mr-2">{nome}</span>
                    <span className="tabular-nums text-muted-foreground">{v.qtd} · {formatBRL(v.valor)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {creating && (
        <NovaAvariaDialog
          open={creating}
          onClose={() => setCreating(false)}
          defaultResponsavel={user?.nome ?? ""}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["avarias"] });
            qc.invalidateQueries({ queryKey: ["produtos"] });
            qc.invalidateQueries({ queryKey: ["movimentacoes"] });
            qc.invalidateQueries({ queryKey: ["lotes"] });
          }}
        />
      )}

      {viewing && (
        <DetalheDialog
          avaria={viewing}
          onClose={() => setViewing(null)}
          podeGerenciar={podeGerenciar}
          onStatus={(s) => updateStatus.mutate({ id: viewing.id, status: s })}
          onCheck={(field, value) => updateChecklist.mutate({ id: viewing.id, field, value })}
        />
      )}
    </div>
  );
}

function AlertaCard({ label, value, tone }: { label: string; value: number; tone: "warn" | "info" | "danger" | "muted" }) {
  const cls =
    tone === "warn" ? "text-amber-500" :
    tone === "danger" ? "text-destructive" :
    tone === "info" ? "text-primary" : "text-muted-foreground";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NovaAvariaDialog({
  open, onClose, onSaved, defaultResponsavel,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultResponsavel: string;
}) {
  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();

  const [momento, setMomento] = useState<Momento>("na_chegada");
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [produtoId, setProdutoId] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const [tipo, setTipo] = useState<Tipo>("quebrado");
  const [motivo, setMotivo] = useState("");
  const [quantidade, setQuantidade] = useState<string>("");
  const [barco, setBarco] = useState("");
  const [manifesto, setManifesto] = useState("");
  const [qtdRecebida, setQtdRecebida] = useState<string>("");
  const [qtdAvariada, setQtdAvariada] = useState<string>("");
  const [qtdAproveitada, setQtdAproveitada] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState(defaultResponsavel);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!produtoId) { toast.error("Selecione o produto"); return; }
    if (momento === "na_chegada") {
      const rec = Number(qtdRecebida), avr = Number(qtdAvariada);
      if (!(rec > 0)) { toast.error("Informe a quantidade recebida"); return; }
      if (!(avr > 0)) { toast.error("Informe a quantidade avariada"); return; }
      if (avr > rec) { toast.error("Avariada não pode ser maior que recebida"); return; }
    } else {
      const q = Number(quantidade);
      if (!(q > 0)) { toast.error("Informe a quantidade"); return; }
    }
    setBusy(true);
    try {
      const payload = {
        data,
        produto_id: produtoId,
        local_id: localId || null,
        momento,
        tipo,
        motivo: motivo || null,
        quantidade: momento === "depois_chegada" ? Number(quantidade) : Number(qtdAvariada) || 0,
        barco: momento === "na_chegada" ? (barco || null) : null,
        manifesto: momento === "na_chegada" ? (manifesto || null) : null,
        quantidade_recebida: momento === "na_chegada" ? Number(qtdRecebida) : null,
        quantidade_avariada: momento === "na_chegada" ? Number(qtdAvariada) : null,
        quantidade_aproveitada: momento === "na_chegada" ? (qtdAproveitada ? Number(qtdAproveitada) : 0) : null,
        valor_estimado: valor ? Number(valor) : null,
        responsavel: responsavel || null,
        observacao: observacao || null,
      };
      const { error } = await supabase.from("avarias" as never).insert(payload as never);
      if (error) throw error;
      toast.success(
        momento === "na_chegada"
          ? "Avaria na chegada registrada (pendência aberta com o barco)"
          : "Avaria registrada e estoque baixado (FEFO)"
      );
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova avaria</DialogTitle>
          <DialogDescription>
            {momento === "na_chegada"
              ? "Na chegada: não dá baixa no estoque; abre pendência com o barco/transportadora."
              : "Depois da chegada: baixa automática no estoque (FEFO)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Momento da avaria</Label>
              <Select value={momento} onValueChange={(v) => setMomento(v as Momento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="na_chegada">Na chegada</SelectItem>
                  <SelectItem value="depois_chegada">Depois da chegada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Produto</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Local de estoque {momento === "depois_chegada" && <span className="text-xs text-muted-foreground">(opcional)</span>}</Label>
              <Select value={localId || "none"} onValueChange={(v) => setLocalId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem local —</SelectItem>
                  {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de avaria</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável interno</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
          </div>

          {momento === "na_chegada" ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Barco / Transportadora</Label>
                  <Input value={barco} onChange={(e) => setBarco(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Nº do manifesto</Label>
                  <Input value={manifesto} onChange={(e) => setManifesto(e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Recebida</Label>
                  <Input type="number" inputMode="decimal" value={qtdRecebida} onChange={(e) => setQtdRecebida(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Avariada</Label>
                  <Input type="number" inputMode="decimal" value={qtdAvariada} onChange={(e) => setQtdAvariada(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Aproveitada</Label>
                  <Input type="number" inputMode="decimal" value={qtdAproveitada} onChange={(e) => setQtdAproveitada(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Valor estimado da avaria (R$)</Label>
                <Input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: registre a entrada normal em <b>Entradas</b> com a quantidade aproveitada. Esta avaria fica como pendência com o barco.
              </p>
            </>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input type="number" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Valor estimado (R$)</Label>
                <Input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: caixa amassada, embalagem violada..." />
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHECKLIST_FIELDS: { field: keyof Avaria; label: string }[] = [
  { field: "chk_registrada", label: "Avaria registrada" },
  { field: "chk_evidencia", label: "Foto/evidência anexada" },
  { field: "chk_comunicado", label: "Comunicado enviado ao barco/transportadora" },
  { field: "chk_aguardando", label: "Aguardando análise" },
  { field: "chk_aprovado", label: "Aprovado pelo barco/transportadora" },
  { field: "chk_recusado", label: "Recusado pelo barco/transportadora" },
  { field: "chk_descontado", label: "Descontado no próximo manifesto" },
  { field: "chk_resolvido", label: "Resolvido" },
];

function DetalheDialog({
  avaria, onClose, podeGerenciar, onStatus, onCheck,
}: {
  avaria: Avaria;
  onClose: () => void;
  podeGerenciar: boolean;
  onStatus: (s: Status) => void;
  onCheck: (field: keyof Avaria, value: boolean) => void;
}) {
  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{avaria.produtos?.nome ?? "Avaria"}</DialogTitle>
          <DialogDescription>
            {avaria.data} · {TIPO_LABEL[avaria.tipo]} ·{" "}
            {avaria.momento === "na_chegada" ? "Na chegada" : "Depois da chegada"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <Info label="Local" value={avaria.locais_estoque?.nome ?? "—"} />
            <Info label="Responsável" value={avaria.responsavel ?? "—"} />
            {avaria.momento === "na_chegada" ? (
              <>
                <Info label="Barco/Transp." value={avaria.barco ?? "—"} />
                <Info label="Manifesto" value={avaria.manifesto ?? "—"} />
                <Info label="Recebida" value={String(avaria.quantidade_recebida ?? 0)} />
                <Info label="Avariada" value={String(avaria.quantidade_avariada ?? 0)} />
                <Info label="Aproveitada" value={String(avaria.quantidade_aproveitada ?? 0)} />
              </>
            ) : (
              <Info label="Quantidade" value={String(avaria.quantidade)} />
            )}
            <Info label="Valor estimado" value={avaria.valor_estimado != null ? formatBRL(Number(avaria.valor_estimado)) : "—"} />
            <Info label="Motivo" value={avaria.motivo ?? "—"} />
          </div>
          {avaria.observacao && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Observação</div>
              <div className="rounded-md border border-border p-2 whitespace-pre-wrap">{avaria.observacao}</div>
            </div>
          )}

          <div>
            <div className="text-xs text-muted-foreground mb-2">Status</div>
            {podeGerenciar ? (
              <Select value={avaria.status} onValueChange={(v) => onStatus(v as Status)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={STATUS_VARIANT[avaria.status]}>{STATUS_LABEL[avaria.status]}</Badge>
            )}
          </div>

          {avaria.momento === "na_chegada" && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Tratativa com o barco/transportadora</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {CHECKLIST_FIELDS.map((c) => (
                  <label key={String(c.field)} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                    <Checkbox
                      checked={Boolean(avaria[c.field])}
                      disabled={!podeGerenciar}
                      onCheckedChange={(v) => onCheck(c.field, Boolean(v))}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
