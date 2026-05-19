import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProdutos } from "@/lib/estoque";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/alertas")({
  component: AlertasPage,
});

function AlertasPage() {
  const { data: produtos = [] } = useProdutos();
  const baixo = produtos.filter((p) => p.ativo && p.estoque_atual <= p.estoque_minimo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Alertas de estoque
        </h1>
        <p className="text-sm text-muted-foreground">
          Produtos que atingiram ou estão abaixo do estoque mínimo.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Estoque atual</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Repor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baixo.map((p) => {
              const repor = Math.max(0, p.estoque_minimo * 2 - p.estoque_atual);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive font-semibold">
                    {p.estoque_atual} {p.unidade_medida}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.estoque_minimo} {p.unidade_medida}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {repor} {p.unidade_medida}
                  </TableCell>
                </TableRow>
              );
            })}
            {baixo.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Tudo certo. Nenhum produto abaixo do mínimo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
