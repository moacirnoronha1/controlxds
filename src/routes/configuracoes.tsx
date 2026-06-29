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
import { AlertTriangle, KeyRound, RotateCcw, Building2, UserCog, Plus, Trash2 } from "lucide-react";
import {
  useSetores, useSaveSetor, useDeleteSetor,
  useResponsaveis, useSaveResponsavel, useDeleteResponsavel,
} from "@/lib/requisicoes";

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
      // Limpar movimentações
      const { error: e1 } = await supabase
        .from("movimentacoes")
        .delete()
        .not("id", "is", null);
      if (e1) throw e1;

      // Limpar itens de inventário e inventários
      const { error: e2 } = await supabase
        .from("inventario_itens")
        .delete()
        .not("id", "is", null);
      if (e2) throw e2;
      const { error: e3 } = await supabase
        .from("inventarios")
        .delete()
        .not("id", "is", null);
      if (e3) throw e3;

      // Zerar estoque dos produtos
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Senha de segurança e reset do sistema.
        </p>
      </div>

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
          Apaga <b>movimentações</b>, <b>inventários</b> e zera o{" "}
          <b>estoque atual</b> de todos os produtos. Produtos cadastrados e
          categorias <b>não</b> são removidos.
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
