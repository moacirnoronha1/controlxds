import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useMovimentacoes, labelMovTipo, isAjusteInventario, isEmprestimo } from "@/lib/estoque";
import { Search } from "lucide-react";

export const Route = createFileRoute("/movimentacoes")({
  component: MovsPage,
});

function MovsPage() {
  const { data: movs = [] } = useMovimentacoes(1500);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("all");

  const filtered = useMemo(
    () =>
      movs.filter(
        (m) =>
          (tipo === "all" ||
            (tipo === "ajuste"
              ? isAjusteInventario(m.tipo)
              : tipo === "emprestimo"
                ? isEmprestimo(m.tipo)
                : m.tipo === tipo)) &&
          (m.produtos?.nome ?? "").toLowerCase().includes(q.toLowerCase()),
      ),
    [movs, q, tipo],
  );
  const POR_PAGINA = 50;
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [q, tipo]);
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtered.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimentações</h1>
        <p className="text-sm text-muted-foreground">Últimas 1.500 entradas e saídas. Use os filtros para localizar registros.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
            <SelectItem value="ajuste">Ajustes de Inventário</SelectItem>
            <SelectItem value="emprestimo">Empréstimos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Fornecedor/Barco</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(m.data_movimentacao).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge variant={isAjusteInventario(m.tipo) || isEmprestimo(m.tipo) ? "outline" : m.tipo === "entrada" ? "default" : "secondary"}>
                    {labelMovTipo(m.tipo, m.observacao)}
                  </Badge>
                </TableCell>
                <TableCell>{m.produtos?.nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.quantidade} {m.produtos?.unidade_medida}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.responsavel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[m.fornecedor, m.barco].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                  {m.observacao ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma movimentação encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{filtered.length} registros · Página {paginaAtual} de {totalPaginas}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}
