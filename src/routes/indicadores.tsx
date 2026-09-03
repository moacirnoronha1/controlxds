import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth, can } from "@/hooks/use-auth";
import { useProdutos, useMovimentacoes, useLotes, useLocais, CATEGORIAS } from "@/lib/estoque";
import { calcularMinimos } from "@/lib/estoque-minimo";
import { useRequisicoes, useSetores, useResponsaveis } from "@/lib/requisicoes";
import { useEmprestimos } from "@/lib/emprestimos";
import { useInventarios, useInventarioItens } from "@/lib/inventario";
import {
  AlertTriangle,
  Package,
  ClipboardList,
  CalendarClock,
  ShieldAlert,
  Repeat,
  DollarSign,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/indicadores")({
  component: IndicadoresPage,
  head: () => ({
    meta: [
      { title: "Indicadores do Estoque | GX Control" },
      {
        name: "description",
        content:
          "Painel gerencial com indicadores de estoque: reposição, requisições, validade, avarias, empréstimos e valor em estoque.",
      },
      { property: "og:title", content: "Indicadores do Estoque | GX Control" },
      {
        property: "og:description",
        content:
          "Indicadores gerenciais de estoque do GX Control: alertas, consumo, avarias e valores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const DAY = 86400000;
const PERIODOS = [
  { v: "7", label: "Últimos 7 dias" },
  { v: "15", label: "Últimos 15 dias" },
  { v: "30", label: "Últimos 30 dias" },
  { v: "90", label: "Últimos 90 dias" },
  { v: "all", label: "Todo o período" },
];

const ALL = "__all__";
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type AvariaRow = {
  id: string;
  data: string;
  produto_id: string;
  local_id: string | null;
  quantidade: number;
  barco: string | null;
  responsavel: string | null;
  status: string;
  valor_estimado: number | null;
  produtos?: { nome: string; unidade_medida: string } | null;
};

function useAvariasIndicadores() {
  return useQuery({
    queryKey: ["avarias", "indicadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avarias")
        .select("id, data, produto_id, local_id, quantidade, barco, responsavel, status, valor_estimado, produtos(nome, unidade_medida)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AvariaRow[];
    },
  });
}

/** Consumo real = saída gerada por requisição liberada. */
function isConsumo(obs: string | null, tipo: string) {
  if (tipo !== "saida") return false;
  return (obs ?? "").toUpperCase().includes("REQUISI");
}

function IndicadoresPage() {
  const { role } = useAuth();
  const podeVer = can(role, "viewIndicadores");
  const podeFinanceiro = can(role, "viewIndicadoresFinanceiros");

  const [periodo, setPeriodo] = useState("30");
  const [categoria, setCategoria] = useState(ALL);
  const [local, setLocal] = useState(ALL);
  const [responsavel, setResponsavel] = useState(ALL);
  const [setor, setSetor] = useState(ALL);

  const { data: produtos = [] } = useProdutos();
  const { data: movs = [] } = useMovimentacoes();
  const { data: lotes = [] } = useLotes();
  const { data: locais = [] } = useLocais();
  const { data: requisicoes = [] } = useRequisicoes();
  const { data: emprestimos = [] } = useEmprestimos();
  const { data: avarias = [] } = useAvariasIndicadores();
  const { data: setores = [] } = useSetores();
  const { data: responsaveis = [] } = useResponsaveis();
  const { data: inventarios = [] } = useInventarios();

  const ultimoFechado = useMemo(
    () => inventarios.find((i) => i.status === "fechado"),
    [inventarios],
  );
  const { data: itensInv = [] } = useInventarioItens(ultimoFechado?.id);

  const desde = useMemo(
    () => (periodo === "all" ? 0 : Date.now() - Number(periodo) * DAY),
    [periodo],
  );

  const produtoById = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  const produtosFiltrados = useMemo(
    () =>
      produtos.filter(
        (p) =>
          p.ativo &&
          (categoria === ALL || p.categoria === categoria) &&
          (local === ALL || p.local_padrao_id === local),
      ),
    [produtos, categoria, local],
  );

  const movsFiltradas = useMemo(
    () =>
      movs.filter((m) => {
        if (new Date(m.data_movimentacao).getTime() < desde) return false;
        const p = produtoById.get(m.produto_id);
        if (categoria !== ALL && p?.categoria !== categoria) return false;
        if (local !== ALL && m.local_id !== local) return false;
        if (responsavel !== ALL && (m.responsavel ?? "") !== responsavel) return false;
        return true;
      }),
    [movs, desde, categoria, local, responsavel, produtoById],
  );

  const minimos = useMemo(() => calcularMinimos(produtos, movs), [produtos, movs]);

  const estoqueBaixo = useMemo(
    () => produtosFiltrados.filter((p) => minimos.get(p.id)?.baixo),
    [produtosFiltrados, minimos],
  );

  const reposicaoUrgente = useMemo(
    () =>
      produtosFiltrados.filter(
        (p) => Number(p.estoque_atual) <= (minimos.get(p.id)?.minimoEfetivo ?? 0) / 2,
      ),
    [produtosFiltrados, minimos],
  );

  const reqsFiltradas = useMemo(
    () =>
      requisicoes.filter((r) => {
        if (new Date(r.data).getTime() < desde) return false;
        if (setor !== ALL && r.setor !== setor) return false;
        if (
          responsavel !== ALL &&
          r.requisitante !== responsavel &&
          (r.responsavel_liberacao ?? "") !== responsavel
        )
          return false;
        return true;
      }),
    [requisicoes, desde, setor, responsavel],
  );

  const hojeStr = new Date().toDateString();
  const reqPendentes = reqsFiltradas.filter((r) => r.status === "pendente").length;
  const reqLiberadasHoje = reqsFiltradas.filter(
    (r) => r.status === "liberada" && r.liberada_em && new Date(r.liberada_em).toDateString() === hojeStr,
  ).length;
  const reqExtras = reqsFiltradas.filter((r) => r.extra).length;

  const lotesFiltrados = useMemo(
    () =>
      lotes.filter((l) => {
        if (Number(l.saldo) <= 0) return false;
        const p = produtoById.get(l.produto_id);
        if (categoria !== ALL && p?.categoria !== categoria) return false;
        if (local !== ALL && l.local_id !== local) return false;
        return true;
      }),
    [lotes, categoria, local, produtoById],
  );

  const hoje = new Date();
  const em30 = new Date(hoje.getTime() + 30 * DAY);

  const vencidos = lotesFiltrados.filter(
    (l) => l.validade && new Date(l.validade) < hoje,
  );
  const proximosVenc = lotesFiltrados.filter(
    (l) => l.validade && new Date(l.validade) >= hoje && new Date(l.validade) <= em30,
  );

  const valorEstoque = lotesFiltrados.reduce(
    (a, l) => a + Number(l.saldo) * Number(l.custo_unitario ?? 0),
    0,
  );
  const valorRisco = [...vencidos, ...proximosVenc].reduce(
    (a, l) => a + Number(l.saldo) * Number(l.custo_unitario ?? 0),
    0,
  );

  const avariasFiltradas = useMemo(
    () =>
      avarias.filter((a) => {
        if (new Date(a.data).getTime() < desde) return false;
        const p = produtoById.get(a.produto_id);
        if (categoria !== ALL && p?.categoria !== categoria) return false;
        if (local !== ALL && a.local_id !== local) return false;
        if (responsavel !== ALL && (a.responsavel ?? "") !== responsavel) return false;
        return true;
      }),
    [avarias, desde, categoria, local, responsavel, produtoById],
  );

  const avariasPendentes = avariasFiltradas.filter(
    (a) => a.status === "pendente" || a.status === "em_analise",
  ).length;

  const avariasPorBarco = useMemo(() => {
    const map = new Map<string, number>();
    avariasFiltradas.forEach((a) => {
      const k = a.barco?.trim() || "SEM BARCO";
      map.set(k, (map.get(k) ?? 0) + Number(a.quantidade));
    });
    return Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [avariasFiltradas]);

  const empFiltrados = useMemo(
    () =>
      emprestimos.filter((e) => {
        if (new Date(e.data_emprestimo).getTime() < desde) return false;
        if (responsavel !== ALL && (e.responsavel ?? "") !== responsavel) return false;
        const p = e.produto_id ? produtoById.get(e.produto_id) : null;
        if (categoria !== ALL && p?.categoria !== categoria) return false;
        return true;
      }),
    [emprestimos, desde, responsavel, categoria, produtoById],
  );
  const empPendentes = empFiltrados.filter((e) => e.status === "pendente").length;
  const empAtrasados = empFiltrados.filter((e) => e.status === "atrasado").length;

  const divergenciaInv = useMemo(() => {
    const itens = itensInv.filter(
      (i) =>
        i.contagem_fisica !== null &&
        (categoria === ALL || i.produtos?.categoria === categoria),
    );
    const total = itens.reduce(
      (a, i) => a + Math.abs(Number(i.contagem_fisica ?? 0) - Number(i.estoque_sistema)),
      0,
    );
    return { total, itens: itens.length };
  }, [itensInv, categoria]);

  // Ranking de consumo (somente requisições liberadas)
  const rankingConsumo = useMemo(() => {
    const map = new Map<string, number>();
    movsFiltradas.forEach((m) => {
      if (!isConsumo(m.observacao, m.tipo)) return;
      const nome = m.produtos?.nome ?? "—";
      map.set(nome, (map.get(nome) ?? 0) + Number(m.quantidade));
    });
    return Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [movsFiltradas]);

  // Série diária: entradas vs consumo
  const serie = useMemo(() => {
    const dias = periodo === "all" ? 30 : Number(periodo);
    const base = new Map<string, { dia: string; entrada: number; consumo: number }>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY);
      const k = d.toISOString().slice(0, 10);
      base.set(k, { dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), entrada: 0, consumo: 0 });
    }
    movsFiltradas.forEach((m) => {
      const k = new Date(m.data_movimentacao).toISOString().slice(0, 10);
      const row = base.get(k);
      if (!row) return;
      if (m.tipo === "entrada") row.entrada += Number(m.quantidade);
      else if (isConsumo(m.observacao, m.tipo)) row.consumo += Number(m.quantidade);
    });
    return Array.from(base.values());
  }, [movsFiltradas, periodo]);

  const alertas = useMemo(() => {
    const rows: { tipo: string; descricao: string; nivel: "alta" | "media" }[] = [];
    reposicaoUrgente.slice(0, 8).forEach((p) =>
      rows.push({
        tipo: "Reposição urgente",
        descricao: `${p.nome} — saldo ${p.estoque_atual} ${p.unidade_medida}`,
        nivel: "alta",
      }),
    );
    vencidos.slice(0, 8).forEach((l) =>
      rows.push({
        tipo: "Lote vencido",
        descricao: `${l.produtos?.nome ?? "—"} — venceu em ${new Date(l.validade!).toLocaleDateString("pt-BR")}`,
        nivel: "alta",
      }),
    );
    proximosVenc.slice(0, 8).forEach((l) =>
      rows.push({
        tipo: "Vence em breve",
        descricao: `${l.produtos?.nome ?? "—"} — ${new Date(l.validade!).toLocaleDateString("pt-BR")}`,
        nivel: "media",
      }),
    );
    if (empAtrasados > 0)
      rows.push({ tipo: "Empréstimos", descricao: `${empAtrasados} empréstimo(s) atrasado(s)`, nivel: "alta" });
    if (avariasPendentes > 0)
      rows.push({ tipo: "Avarias", descricao: `${avariasPendentes} avaria(s) aguardando tratativa`, nivel: "media" });
    return rows;
  }, [reposicaoUrgente, vencidos, proximosVenc, empAtrasados, avariasPendentes]);

  if (!podeVer) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Você não tem acesso aos indicadores.
      </div>
    );
  }

  const cards = [
    { label: "Estoque baixo", value: estoqueBaixo.length, icon: AlertTriangle, color: "text-warning" },
    { label: "Reposição urgente", value: reposicaoUrgente.length, icon: TrendingDown, color: "text-destructive" },
    { label: "Requisições pendentes", value: reqPendentes, icon: ClipboardList, color: "text-primary" },
    { label: "Liberadas hoje", value: reqLiberadasHoje, icon: ClipboardList, color: "text-success" },
    { label: "Requisições extras", value: reqExtras, icon: ClipboardList, color: "text-warning" },
    { label: "Próximos do vencimento", value: proximosVenc.length, icon: CalendarClock, color: "text-warning" },
    { label: "Lotes vencidos", value: vencidos.length, icon: CalendarClock, color: "text-destructive" },
    { label: "Avarias pendentes", value: avariasPendentes, icon: ShieldAlert, color: "text-destructive" },
    { label: "Empréstimos pendentes", value: empPendentes, icon: Repeat, color: "text-primary" },
    { label: "Empréstimos atrasados", value: empAtrasados, icon: Repeat, color: "text-destructive" },
    {
      label: "Divergência último inventário",
      value: divergenciaInv.total,
      icon: Package,
      color: "text-muted-foreground",
    },
    ...(podeFinanceiro
      ? [
          { label: "Valor total em estoque", value: brl(valorEstoque), icon: DollarSign, color: "text-success" },
          { label: "Valor em risco (validade)", value: brl(valorRisco), icon: DollarSign, color: "text-destructive" },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Indicadores</h1>
        <p className="text-sm text-muted-foreground">
          Painel gerencial do estoque. Consumo considera apenas requisições liberadas.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Filtro label="Período" value={periodo} onChange={setPeriodo}
              options={PERIODOS.map((p) => ({ v: p.v, label: p.label }))} />
            <Filtro label="Categoria" value={categoria} onChange={setCategoria}
              options={[{ v: ALL, label: "Todas" }, ...CATEGORIAS.map((c) => ({ v: c, label: c }))]} />
            <Filtro label="Local de estoque" value={local} onChange={setLocal}
              options={[{ v: ALL, label: "Todos" }, ...locais.map((l) => ({ v: l.id, label: l.nome }))]} />
            <Filtro label="Responsável" value={responsavel} onChange={setResponsavel}
              options={[{ v: ALL, label: "Todos" }, ...responsaveis.map((r) => ({ v: r.nome, label: r.nome }))]} />
            <Filtro label="Setor" value={setor} onChange={setSetor}
              options={[{ v: ALL, label: "Todos" }, ...setores.map((s) => ({ v: s.nome, label: s.nome }))]} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground leading-tight">
                  {c.label}
                </span>
                <c.icon className={`h-4 w-4 shrink-0 ${c.color}`} />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas x Consumo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="entrada" stroke="var(--primary)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="consumo" stroke="var(--destructive)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avarias por barco / transportadora</CardTitle>
          </CardHeader>
          <CardContent>
            {avariasPorBarco.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma avaria no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={avariasPorBarco}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="qtd" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de consumo (requisições liberadas)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Consumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingConsumo.map((r, i) => (
                  <TableRow key={r.nome}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{r.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.qtd}</TableCell>
                  </TableRow>
                ))}
                {rankingConsumo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Sem consumo no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas importantes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Nível</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((a, i) => (
                  <TableRow key={`${a.tipo}-${i}`}>
                    <TableCell className="whitespace-nowrap">{a.tipo}</TableCell>
                    <TableCell className="text-muted-foreground">{a.descricao}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={a.nivel === "alta" ? "destructive" : "secondary"}>
                        {a.nivel === "alta" ? "Alta" : "Média"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {alertas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum alerta no momento.
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

function Filtro({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
