import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useMovimentacoes } from "@/lib/estoque";
import { Search } from "lucide-react";

export const Route = createFileRoute("/movimentacoes")({
  component: MovsPage,
});

function MovsPage() {
  const { data: movs = [] } = useMovimentacoes();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("all");

  const filtered = useMemo(
    () =>
      movs.filter(
        (m) =>
          (tipo === "all" || m.tipo === tipo) &&
          (m.produtos?.nome ?? "").toLowerCase().includes(q.toLowerCase()),
      ),
    [movs, q, tipo],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimentações</h1>
        <p className="text-sm text-muted-foreground">Histórico completo de entradas e saídas.</p>
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
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(m.data_movimentacao).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge variant={m.tipo === "entrada" ? "default" : "secondary"}>
                    {m.tipo}
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
    </div>
  );
}
