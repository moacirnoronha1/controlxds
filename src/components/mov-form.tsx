import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProdutos,
  useRegistrarMovimentacao,
  useMovimentacoes,
} from "@/lib/estoque";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = { tipo: "entrada" | "saida" };

export function MovForm({ tipo }: Props) {
  const { data: produtos = [] } = useProdutos();
  const reg = useRegistrarMovimentacao();
  const movs = useMovimentacoes(15);

  const [form, setForm] = useState({
    produto_id: "",
    quantidade: "",
    observacao: "",
    responsavel: "",
    fornecedor: "",
    barco: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.produto_id || !form.quantidade) return;
    await reg.mutateAsync({
      tipo,
      produto_id: form.produto_id,
      quantidade: Number(form.quantidade),
      observacao: form.observacao || undefined,
      responsavel: form.responsavel || undefined,
      fornecedor: tipo === "entrada" ? form.fornecedor || undefined : undefined,
      barco: tipo === "entrada" ? form.barco || undefined : undefined,
    });
    setForm({ ...form, quantidade: "", observacao: "" });
  }

  const recentes = (movs.data ?? []).filter((m) => m.tipo === tipo).slice(0, 8);
  const title = tipo === "entrada" ? "Registrar entrada" : "Registrar saída";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {tipo === "entrada"
            ? "Adicione produtos ao estoque."
            : "Registre consumo e retiradas."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova movimentação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label>Produto</Label>
                <Select
                  value={form.produto_id}
                  onValueChange={(v) => setForm({ ...form, produto_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} ({p.estoque_atual} {p.unidade_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                  required
                />
              </div>
              {tipo === "entrada" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Fornecedor</Label>
                    <Input
                      value={form.fornecedor}
                      onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Barco</Label>
                    <Input
                      value={form.barco}
                      onChange={(e) => setForm({ ...form, barco: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Responsável</Label>
                <Input
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={reg.isPending}>
                {reg.isPending ? "Registrando..." : `Registrar ${tipo}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas {tipo}s</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentes.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.data_movimentacao).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{m.produtos?.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.quantidade} {m.produtos?.unidade_medida}
                    </TableCell>
                  </TableRow>
                ))}
                {recentes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      Sem registros.
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
