import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, RotateCcw, Building2, UserCog, Plus, Trash2, MapPin } from "lucide-react";
import {
  useSetores, useSaveSetor, useDeleteSetor,
  useResponsaveis, useSaveResponsavel, useDeleteResponsavel,
} from "@/lib/requisicoes";
import { useLocais, useSaveLocal, useDeleteLocal } from "@/lib/estoque";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigPage,
});

const PASS_KEY = "xica:reset_password";

function ConfigPage() {
  const qc = useQueryClient();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [senhaReset, setSenhaReset] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const senhaDefinida =
    typeof window !== "undefined" && !!localStorage.getItem(PASS_KEY);

  function salvarSenha() {
    if (novaSenha.length < 4) {
      toast.error("A senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      toast.error("As senhas não coincidem");
      return;
    }
    localStorage.setItem(PASS_KEY, novaSenha);
    setNovaSenha("");
    setConfirmaSenha("");
    toast.success("Senha de reset definida");
  }

  async function resetar() {
    const senhaSalva = localStorage.getItem(PASS_KEY);
    if (!senhaSalva) {
      toast.error("Defina uma senha de reset antes");
      return;
    }
    if (senhaReset !== senhaSalva) {
      toast.error("Senha incorreta");
      return;
    }
    setLoading(true);
    try {
      // Limpar avarias (referenciam lotes)
      const { error: eAv } = await supabase.from("avarias").delete().not("id", "is", null);
      if (eAv) throw eAv;

      // Limpar movimentações (referenciam lotes)
      const { error: e1 } = await supabase.from("movimentacoes").delete().not("id", "is", null);
      if (e1) throw e1;

      // Limpar lotes
      const { error: e1b } = await supabase.from("lotes").delete().not("id", "is", null);
      if (e1b) throw e1b;

      // Limpar notas fiscais importadas
      const { error: eNF } = await supabase.from("notas_fiscais").delete().not("id", "is", null);
      if (eNF) throw eNF;

      // Limpar itens de requisição e requisições
      const { error: eR1 } = await supabase.from("requisicao_itens").delete().not("id", "is", null);
      if (eR1) throw eR1;
      const { error: eR2 } = await supabase.from("requisicoes").delete().not("id", "is", null);
      if (eR2) throw eR2;

      // Limpar empréstimos
      const { error: eE } = await supabase.from("emprestimos").delete().not("id", "is", null);
      if (eE) throw eE;

      // Limpar itens de inventário e inventários
      const { error: e2 } = await supabase.from("inventario_itens").delete().not("id", "is", null);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("inventarios").delete().not("id", "is", null);
      if (e3) throw e3;

      // Zerar estoque dos produtos (produtos, categorias, locais e configurações são preservados)
      const { error: e4 } = await supabase
        .from("produtos")
        .update({ estoque_atual: 0, estoque_inicial: 0 })
        .not("id", "is", null);
      if (e4) throw e4;

      qc.invalidateQueries();
      toast.success("Sistema resetado com sucesso");
      setOpen(false);
      setSenhaReset("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Setores, responsáveis, senha de reset e manutenção do sistema.
        </p>
      </div>

      <LocaisCard />
      <SetoresCard />
      <ResponsaveisCard />



      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Senha de reset</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta senha será solicitada para confirmar o reset do sistema.{" "}
          {senhaDefinida ? (
            <span className="text-emerald-600 font-medium">
              Senha já definida.
            </span>
          ) : (
            <span className="text-amber-600 font-medium">
              Nenhuma senha definida.
            </span>
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••"
            />
          </div>
          <div className="space-y-1">
            <Label>Confirmar senha</Label>
            <Input
              type="password"
              value={confirmaSenha}
              onChange={(e) => setConfirmaSenha(e.target.value)}
              placeholder="••••"
            />
          </div>
        </div>
        <Button onClick={salvarSenha} size="sm">
          Salvar senha
        </Button>
      </Card>

      <Card className="p-5 space-y-4 border-destructive/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="font-semibold text-destructive">Resetar sistema</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Apaga <b>movimentações</b>, <b>lotes</b>, <b>requisições</b>, <b>empréstimos</b> e{" "}
          <b>inventários</b> e zera o <b>estoque atual</b> dos produtos.{" "}
          <b>Não</b> remove produtos, categorias, locais de estoque nem configurações.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!senhaDefinida}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Resetar sistema
        </Button>
        {!senhaDefinida && (
          <p className="text-xs text-amber-600">
            Defina a senha de reset acima para habilitar.
          </p>
        )}
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tem certeza que deseja resetar o sistema?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as movimentações e
              inventários serão apagados e o estoque será zerado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label>Digite a senha de reset</Label>
            <Input
              type="password"
              value={senhaReset}
              onChange={(e) => setSenhaReset(e.target.value)}
              placeholder="Senha"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                resetar();
              }}
              disabled={loading || !senhaReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Resetando..." : "Confirmar reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LocaisCard() {
  const { data: locais = [] } = useLocais();
  const save = useSaveLocal();
  const del = useDeleteLocal();
  const [nome, setNome] = useState("");
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Locais de estoque</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Onde o estoque fica fisicamente (ex: Estoque Principal, Estoque de Bebidas, Escritório Xica, Casa).
      </p>
      <div className="flex gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Depósito 2" />
        <Button size="sm" onClick={async () => {
          if (!nome.trim()) return;
          await save.mutateAsync({ nome: nome.trim() });
          setNome("");
        }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="space-y-1">
        {locais.length === 0 && <p className="text-xs text-muted-foreground">Nenhum local cadastrado.</p>}
        {locais.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              {l.nome}
              {!l.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => {
              if (confirm(`Remover ${l.nome}?`)) del.mutate(l.id);
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SetoresCard() {
  const { data: setores = [] } = useSetores();
  const save = useSaveSetor();
  const del = useDeleteSetor();
  const [nome, setNome] = useState("");
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Setores / destinos</h2>
      </div>
      <div className="flex gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cozinha" />
        <Button size="sm" onClick={async () => { if (!nome.trim()) return; await save.mutateAsync(nome.trim()); setNome(""); }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {setores.length === 0 && <p className="text-xs text-muted-foreground">Nenhum setor cadastrado.</p>}
        {setores.map((s) => (
          <div key={s.id} className="flex items-center gap-1 rounded-md border bg-muted/40 pl-3 pr-1 py-1 text-sm">
            {s.nome}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del.mutate(s.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResponsaveisCard() {
  const { data: list = [] } = useResponsaveis();
  const save = useSaveResponsavel();
  const del = useDeleteResponsavel();
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Responsáveis pela liberação</h2>
      </div>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (opcional)" />
        <Button size="sm" onClick={async () => {
          if (!nome.trim()) return;
          await save.mutateAsync({ nome: nome.trim(), cargo: cargo.trim() || undefined });
          setNome(""); setCargo("");
        }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="space-y-1">
        {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum responsável cadastrado.</p>}
        {list.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div>
              <div>{r.nome}</div>
              {r.cargo && <div className="text-xs text-muted-foreground">{r.cargo}</div>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
