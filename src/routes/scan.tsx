import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine, Barcode, CheckCircle2, ShieldAlert, XCircle, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { findProdutoByCodigo, useRegistrarMovimentacao, type ScanMatch } from "@/lib/estoque";
import { useAuth, can } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
});

type Tipo = "entrada" | "saida";

function ScanPage() {
  const { role, displayName } = useAuth();
  const allowed = can(role, "createMovement");
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [codigo, setCodigo] = useState("");
  const [match, setMatch] = useState<ScanMatch | null>(null);
  const [qtdLida, setQtdLida] = useState<string>("1");
  const [buscando, setBuscando] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [autoBip, setAutoBip] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const registrar = useRegistrarMovimentacao();

  const produto = match?.produto ?? null;
  const multiplicador = match?.multiplicador ?? 1;
  const isCaixa = match?.tipo_codigo === "caixa";
  const totalUnidades = (Number(qtdLida) || 0) * multiplicador;

  useEffect(() => {
    inputRef.current?.focus();
  }, [tipo, match]);

  async function buscar(code: string) {
    const c = code.trim();
    if (!c) return;
    setBuscando(true);
    setNaoEncontrado(false);
    try {
      const m = await findProdutoByCodigo(c);
      if (m) {
        if (autoBip) {
          const qtd = m.multiplicador;
          const isCx = m.tipo_codigo === "caixa";
          try {
            await registrar.mutateAsync({
              produto_id: m.produto.id,
              tipo,
              quantidade: qtd,
              responsavel: displayName ?? undefined,
              observacao: isCx
                ? `Bip caixa: 1× ${m.multiplicador} = ${qtd} ${m.produto.unidade_medida}`
                : `Bip unidade: ${qtd} ${m.produto.unidade_medida}`,
            });
            toast.success(`${tipo === "entrada" ? "+" : "−"}${qtd} ${m.produto.unidade_medida} · ${m.produto.nome}`);
          } catch {
            // toast handled by mutation
          }
          reset();
        } else {
          setMatch(m);
          setQtdLida("1");
        }
      } else {
        setMatch(null);
        setNaoEncontrado(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar");
    } finally {
      setBuscando(false);
    }
  }

  function reset() {
    setCodigo("");
    setMatch(null);
    setNaoEncontrado(false);
    setQtdLida("1");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function confirmar() {
    if (!match) return;
    const n = Number(qtdLida);
    if (!n || n <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    const quantidadeFinal = n * multiplicador;
    try {
      await registrar.mutateAsync({
        produto_id: match.produto.id,
        tipo,
        quantidade: quantidadeFinal,
        responsavel: displayName ?? undefined,
        observacao: isCaixa
          ? `Leitura caixa ${n}× ${multiplicador} = ${quantidadeFinal} ${match.produto.unidade_medida}`
          : `Leitura unidade (${quantidadeFinal} ${match.produto.unidade_medida})`,
      });
      reset();
    } catch {
      // toast handled by mutation
    }
  }

  if (!allowed) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Apenas administradores e estoquistas podem registrar movimentações.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Barcode className="h-6 w-6" /> Leitura rápida
        </h1>
        <p className="text-sm text-muted-foreground">
          Escaneie o código de barras para registrar entrada ou saída.
        </p>
      </div>

      <Tabs value={tipo} onValueChange={(v) => { setTipo(v as Tipo); reset(); }}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="entrada" className="data-[state=active]:bg-success/15 data-[state=active]:text-success">
            <ArrowDownToLine className="h-4 w-4 mr-2" /> Entrada
          </TabsTrigger>
          <TabsTrigger value="saida" className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive">
            <ArrowUpFromLine className="h-4 w-4 mr-2" /> Saída
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium leading-tight">Bip automático</p>
            <p className="text-xs text-muted-foreground">
              Unidade = 1 · Caixa = multiplicador
            </p>
          </div>
        </div>
        <Switch checked={autoBip} onCheckedChange={setAutoBip} />
      </div>


      <Card className="p-4 space-y-4">
        <div className="grid gap-2">
          <Label>Código de barras</Label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscar(codigo);
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Digite ou escaneie com leitor USB..."
              className="font-mono"
            />
            <Button type="submit" disabled={buscando || !codigo.trim()}>
              Buscar
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Leitores USB/Bluetooth funcionam como teclado — basta deixar este campo focado.
          </p>
        </div>

        <BarcodeScanner
          onDetected={(c) => {
            setCodigo(c);
            buscar(c);
          }}
        />
      </Card>

      {naoEncontrado && (
        <Card className="p-4 border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Produto não encontrado</p>
            <p className="text-muted-foreground">
              Cadastre o código de barras desse produto na tela de Produtos.
            </p>
          </div>
        </Card>
      )}

      {produto && (
        <Card className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Produto identificado
              </div>
              <h2 className="font-semibold text-lg leading-tight mt-1">{produto.nome}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <Badge variant="outline">{produto.categoria}</Badge>
                {isCaixa ? (
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                    Caixa = {multiplicador} {produto.unidade_medida}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unidade</Badge>
                )}
                <span className="text-muted-foreground font-mono">{codigo}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Estoque atual</p>
              <p className="text-xl font-semibold tabular-nums">
                {produto.estoque_atual}
                <span className="text-sm text-muted-foreground ml-1">{produto.unidade_medida}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>
              {isCaixa
                ? `Quantidade de caixas (${tipo === "entrada" ? "entrar" : "sair"})`
                : `Quantidade (${tipo === "entrada" ? "entrar" : "sair"})`}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={qtdLida}
              onChange={(e) => setQtdLida(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
              className="text-lg font-semibold"
            />
            {isCaixa && (
              <p className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground tabular-nums">{totalUnidades}</span>{" "}
                {produto.unidade_medida} ({qtdLida || 0} × {multiplicador})
              </p>
            )}
          </div>


          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={reset}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={confirmar}
              disabled={registrar.isPending}
              variant={tipo === "saida" ? "destructive" : "default"}
            >
              {tipo === "entrada" ? (
                <><ArrowDownToLine className="h-4 w-4 mr-2" /> Confirmar entrada</>
              ) : (
                <><ArrowUpFromLine className="h-4 w-4 mr-2" /> Confirmar saída</>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
