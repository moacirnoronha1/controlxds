import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { FileCode2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useProdutos,
  useLocais,
  useCriarEntradaLote,
  type Produto,
  CATEGORIAS,
  UNIDADES,
} from "@/lib/estoque";
import { useAuth } from "@/hooks/use-auth";

type ItemXml = {
  codigo: string;
  ean: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  produto_id: string; // vinculado
  local_id: string;
  validade: string;
  criar_novo?: boolean;
};

type NotaXml = {
  chave: string;
  numero: string;
  fornecedor: string;
  cnpj: string;
  data_emissao: string;
  itens: ItemXml[];
};

function txt(el: Element | null | undefined, tag: string): string {
  if (!el) return "";
  const found = el.getElementsByTagName(tag)[0];
  return found?.textContent?.trim() ?? "";
}

function parseNfeXml(xml: string): NotaXml {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Arquivo XML inválido.");
  }
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("XML não parece uma NF-e (infNFe ausente).");

  const chaveAttr = infNFe.getAttribute("Id") ?? "";
  const chave = chaveAttr.replace(/^NFe/, "");

  const ide = infNFe.getElementsByTagName("ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0];

  const numero = txt(ide, "nNF");
  const dhEmi = txt(ide, "dhEmi") || txt(ide, "dEmi");
  const data_emissao = dhEmi ? dhEmi.slice(0, 10) : "";

  const fornecedor = txt(emit, "xNome") || txt(emit, "xFant");
  const cnpj = txt(emit, "CNPJ") || txt(emit, "CPF");

  const dets = Array.from(infNFe.getElementsByTagName("det"));
  const itens: ItemXml[] = dets.map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    const ean = txt(prod, "cEAN");
    return {
      codigo: txt(prod, "cProd"),
      ean: ean && ean.toUpperCase() !== "SEM GTIN" ? ean : "",
      descricao: txt(prod, "xProd"),
      quantidade: Number(txt(prod, "qCom") || "0") || 0,
      unidade: (txt(prod, "uCom") || "un").toLowerCase(),
      valor_unitario: Number(txt(prod, "vUnCom") || "0") || 0,
      valor_total: Number(txt(prod, "vProd") || "0") || 0,
      produto_id: "",
      local_id: "",
      validade: "",
    };
  });

  return { chave, numero, fornecedor, cnpj, data_emissao, itens };
}

function autoLink(itens: ItemXml[], produtos: Produto[], localPadrao: string): ItemXml[] {
  const byEan = new Map<string, Produto>();
  const byNome = new Map<string, Produto>();
  for (const p of produtos) {
    if (p.codigo_barras) byEan.set(p.codigo_barras, p);
    if (p.codigo_caixa) byEan.set(p.codigo_caixa, p);
    byNome.set(p.nome.trim().toLowerCase(), p);
  }
  return itens.map((it) => {
    let match: Produto | undefined;
    if (it.ean) match = byEan.get(it.ean);
    if (!match) match = byNome.get(it.descricao.trim().toLowerCase());
    return {
      ...it,
      produto_id: match?.id ?? "",
      local_id: match?.local_padrao_id ?? localPadrao ?? "",
    };
  });
}

export function ImportXmlNfe() {
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState<NotaXml | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: produtos = [] } = useProdutos();
  const { data: locais = [] } = useLocais();
  const entrada = useCriarEntradaLote();

  const locaisAtivos = useMemo(() => locais.filter((l) => l.ativo), [locais]);
  const localPadrao = locaisAtivos[0]?.id ?? "";

  function reset() {
    setNota(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setLoading(true);
    try {
      const xml = await file.text();
      const parsed = parseNfeXml(xml);
      if (!parsed.chave) throw new Error("Chave da NF-e não encontrada.");
      const { data: exist } = await supabase
        .from("notas_fiscais")
        .select("id, numero")
        .eq("chave", parsed.chave)
        .maybeSingle();
      if (exist) {
        throw new Error(`Nota já importada anteriormente (nº ${exist.numero ?? "?"}).`);
      }
      parsed.itens = autoLink(parsed.itens, produtos, localPadrao);
      setNota(parsed);
      if (!parsed.itens.length) toast.warning("Nota sem itens.");
    } catch (e) {
      toast.error((e as Error).message);
      reset();
    } finally {
      setLoading(false);
    }
  }

  function updateItem(idx: number, patch: Partial<ItemXml>) {
    if (!nota) return;
    const itens = nota.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setNota({ ...nota, itens });
  }

  async function criarProdutoRapido(idx: number) {
    if (!nota) return;
    const it = nota.itens[idx];
    const unidade = UNIDADES.find((u) => u.toLowerCase() === it.unidade) ?? "un";
    try {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: it.descricao.slice(0, 120),
          categoria: CATEGORIAS[4] as string, // "Secos"
          unidade_medida: unidade,
          codigo_barras: it.ean || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      updateItem(idx, { produto_id: data.id });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto cadastrado e vinculado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pendentes = nota?.itens.filter((it) => !it.produto_id).length ?? 0;
  const semLocal = nota?.itens.filter((it) => it.produto_id && !it.local_id).length ?? 0;

  async function confirmar() {
    if (!nota) return;
    if (pendentes > 0) return toast.error("Vincule ou cadastre todos os produtos.");
    if (semLocal > 0) return toast.error("Escolha o local de estoque de todos os itens.");
    setLoading(true);
    try {
      // grava a nota primeiro (unique chave impede corrida)
      const { error: notaErr } = await supabase.from("notas_fiscais").insert({
        chave: nota.chave,
        numero: nota.numero,
        fornecedor: nota.fornecedor,
        cnpj: nota.cnpj,
        data_emissao: nota.data_emissao || null,
        responsavel: user?.nome ?? null,
      });
      if (notaErr) throw notaErr;

      for (const it of nota.itens) {
        await entrada.mutateAsync({
          produto_id: it.produto_id,
          local_id: it.local_id,
          quantidade: it.quantidade,
          validade: it.validade || null,
          custo_unitario: it.valor_unitario || null,
          fornecedor: nota.fornecedor || undefined,
          observacao: `NF-e ${nota.numero} — ${it.descricao}`,
          responsavel: user?.nome ?? undefined,
        });
      }
      toast.success(`Nota ${nota.numero} importada — ${nota.itens.length} lote(s) criados`);
      setOpen(false);
      reset();
    } catch (e) {
      toast.error("Falha na importação: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileCode2 className="h-4 w-4 mr-1" /> Importar XML da Nota
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importar XML da NF-e</DialogTitle>
            <DialogDescription>
              Envie o XML da nota. O sistema lê os itens, vincula aos produtos existentes e cria os
              lotes após sua confirmação.
            </DialogDescription>
          </DialogHeader>

          {!nota && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileCode2 className="h-10 w-10 mx-auto text-muted-foreground" />
              <Button onClick={() => fileRef.current?.click()} disabled={loading}>
                <Upload className="h-4 w-4 mr-1" />
                {loading ? "Lendo..." : "Selecionar arquivo .xml"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <p className="text-xs text-muted-foreground">
                A mesma nota não pode ser importada duas vezes (verificação pela chave da NF-e).
              </p>
            </div>
          )}

          {nota && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Fornecedor</div>
                  <div className="font-medium truncate">{nota.fornecedor || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">CNPJ</div>
                  <div className="font-medium">{nota.cnpj || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Nº da nota</div>
                  <div className="font-medium">{nota.numero || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Emissão</div>
                  <div className="font-medium">
                    {nota.data_emissao
                      ? new Date(nota.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <div className="text-xs text-muted-foreground">Chave NF-e</div>
                  <div className="font-mono text-xs break-all">{nota.chave}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-4 w-4" /> {nota.itens.length - pendentes} vinculados
                </span>
                {pendentes > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-4 w-4" /> {pendentes} pendentes
                  </span>
                )}
              </div>

              <div className="max-h-[440px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Produto na nota</TableHead>
                      <TableHead>Vincular a</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo un.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nota.itens.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium text-sm truncate">{it.descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            cód {it.codigo}
                            {it.ean ? ` · EAN ${it.ean}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="flex gap-1">
                            <Select
                              value={it.produto_id}
                              onValueChange={(v) => updateItem(i, { produto_id: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {produtos.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!it.produto_id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => criarProdutoRapido(i)}
                              >
                                Novo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {it.quantidade} {it.unidade}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          R$ {it.valor_unitario.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          R$ {it.valor_total.toFixed(2)}
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <Select
                            value={it.local_id}
                            onValueChange={(v) => updateItem(i, { local_id: v })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Local" />
                            </SelectTrigger>
                            <SelectContent>
                              {locaisAtivos.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-8 w-[140px]"
                            value={it.validade}
                            onChange={(e) => updateItem(i, { validade: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          {it.produto_id ? (
                            <Badge variant="secondary">vinculado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                              pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {nota && (
              <Button variant="ghost" onClick={reset}>
                Trocar arquivo
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={!nota || loading || pendentes > 0 || semLocal > 0}
            >
              {loading ? "Importando..." : `Confirmar entrada${nota ? ` (${nota.itens.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
