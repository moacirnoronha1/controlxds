import { useRef, useState } from "react";
import { upper } from "@/lib/utils";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { CATEGORIAS, UNIDADES } from "@/lib/estoque";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Linha = {
  nome: string;
  categoria: string;
  unidade_medida: string;
  estoque_inicial: number;
  estoque_minimo: number;
  _erro?: string;
};

const ALIASES: Record<string, keyof Linha> = {
  nome: "nome",
  produto: "nome",
  descricao: "nome",
  descrição: "nome",
  item: "nome",
  categoria: "categoria",
  cat: "categoria",
  grupo: "categoria",
  unidade: "unidade_medida",
  un: "unidade_medida",
  und: "unidade_medida",
  unid: "unidade_medida",
  "unidade de medida": "unidade_medida",
  unidade_medida: "unidade_medida",
  medida: "unidade_medida",
  estoque: "estoque_inicial",
  "estoque inicial": "estoque_inicial",
  estoque_inicial: "estoque_inicial",
  inicial: "estoque_inicial",
  quantidade: "estoque_inicial",
  qtd: "estoque_inicial",
  "estoque minimo": "estoque_minimo",
  "estoque mínimo": "estoque_minimo",
  estoque_minimo: "estoque_minimo",
  minimo: "estoque_minimo",
  mínimo: "estoque_minimo",
  min: "estoque_minimo",
};

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchCategoria(v: string) {
  const n = norm(v);
  return CATEGORIAS.find((c) => norm(c) === n) ?? null;
}
function matchUnidade(v: string) {
  const n = norm(v).replace(/\./g, "");
  return UNIDADES.find((u) => norm(u) === n) ?? null;
}

function cellValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if (o.result != null) return String(o.result);
  }
  return String(v);
}

async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new Error("Formato .xls não suportado. Salve como .xlsx no Excel (Arquivo → Salvar como → Pasta de Trabalho do Excel .xlsx).");
  }
  if (!name.endsWith(".xlsx")) {
    throw new Error("Use um arquivo .xlsx.");
  }
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new Error("Arquivo inválido ou corrompido. Reabra no Excel e salve novamente como .xlsx.");
  }
  const ws = wb.worksheets?.[0];
  if (!ws) throw new Error("Planilha vazia ou sem abas legíveis.");
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellValue(cell.value).trim();
  });
  const rows: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col - 1];
      if (key) obj[key] = cellValue(cell.value);
    });
    rows.push(obj);
  });
  return rows;
}

function parseRows(rows: Record<string, unknown>[]): Linha[] {
  return rows.map((r) => {
    const obj: Partial<Linha> = {};
    for (const [k, v] of Object.entries(r)) {
      const key = ALIASES[norm(k)];
      if (key) (obj as Record<string, unknown>)[key] = v;
    }
    const nome = String(obj.nome ?? "").trim();
    const catRaw = String(obj.categoria ?? "Secos").trim();
    const unRaw = String(obj.unidade_medida ?? "un").trim();
    const cat = matchCategoria(catRaw) ?? "Secos";
    const un = matchUnidade(unRaw) ?? "un";
    const inicial = Number(obj.estoque_inicial ?? 0) || 0;
    const minimo = Number(obj.estoque_minimo ?? 0) || 0;
    const erros: string[] = [];
    if (!nome) erros.push("nome vazio");
    if (catRaw && !matchCategoria(catRaw)) erros.push(`categoria "${catRaw}" → Secos`);
    if (unRaw && !matchUnidade(unRaw)) erros.push(`unidade "${unRaw}" → un`);
    return {
      nome,
      categoria: cat,
      unidade_medida: un,
      estoque_inicial: inicial,
      estoque_minimo: minimo,
      _erro: erros.length ? erros.join(", ") : undefined,
    };
  });
}

export function ImportProdutos() {
  const [open, setOpen] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function reset() {
    setLinhas([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      const rows = await readSheet(file);
      const parsed = parseRows(rows).filter((l) => l.nome);
      setLinhas(parsed);
      if (!parsed.length) toast.error("Nenhuma linha válida encontrada");
    } catch (e) {
      toast.error("Erro ao ler arquivo: " + (e as Error).message);
    }
  }

  async function baixarModelo() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Produtos");
    ws.columns = [
      { header: "nome", key: "nome", width: 30 },
      { header: "categoria", key: "categoria", width: 15 },
      { header: "unidade", key: "unidade", width: 12 },
      { header: "estoque_inicial", key: "estoque_inicial", width: 16 },
      { header: "estoque_minimo", key: "estoque_minimo", width: 16 },
    ];
    ws.addRows([
      { nome: "Arroz 5kg", categoria: "Secos", unidade: "pct", estoque_inicial: 10, estoque_minimo: 3 },
      { nome: "Coca-Cola 2L", categoria: "Bebidas", unidade: "un", estoque_inicial: 24, estoque_minimo: 6 },
      { nome: "Detergente", categoria: "Limpeza", unidade: "un", estoque_inicial: 5, estoque_minimo: 2 },
    ]);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos-xica.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importar() {
    const validas = linhas.filter((l) => l.nome);
    if (!validas.length) return;
    setImporting(true);
    try {
      const payload = validas.map((l) => ({
        nome: upper(l.nome),
        categoria: upper(l.categoria),
        unidade_medida: l.unidade_medida,
        estoque_inicial: l.estoque_inicial,
        estoque_atual: l.estoque_inicial,
        estoque_minimo: l.estoque_minimo,
      }));
      const { error } = await supabase.from("produtos").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} produto(s) importado(s)`);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const comErros = linhas.filter((l) => l._erro).length;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" /> Importar Excel
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar produtos via Excel</DialogTitle>
            <DialogDescription>
              Colunas aceitas: <code>nome</code>, <code>categoria</code>, <code>unidade</code>,{" "}
              <code>estoque_inicial</code>, <code>estoque_minimo</code>. Acentos e variações são
              reconhecidos.
            </DialogDescription>
          </DialogHeader>

          {!linhas.length && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Selecionar arquivo .xlsx
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={baixarModelo}>
                <Download className="h-4 w-4 mr-1" /> Baixar modelo
              </Button>
            </div>
          )}

          {linhas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">{fileName}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" /> {linhas.length} linhas
                  </span>
                  {comErros > 0 && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <AlertCircle className="h-4 w-4" /> {comErros} avisos
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-[400px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead className="text-right">Inicial</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead>Aviso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{l.categoria}</Badge>
                        </TableCell>
                        <TableCell>{l.unidade_medida}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.estoque_inicial}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.estoque_minimo}
                        </TableCell>
                        <TableCell className="text-xs text-amber-500">{l._erro ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {linhas.length > 0 && (
              <Button variant="ghost" onClick={reset}>
                Trocar arquivo
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={!linhas.length || importing}>
              {importing ? "Importando..." : `Importar ${linhas.length || ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
