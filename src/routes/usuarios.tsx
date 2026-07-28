import { createFileRoute } from "@tanstack/react-router";
import { upper } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABEL, type AppRole } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  component: UsuariosPage,
});

type UsuarioRow = {
  id: string;
  nome: string;
  username: string;
  cargo: AppRole;
  setor: string | null;
  ativo: boolean;
};

const ROLE_OPTIONS: AppRole[] = ["mestre", "estoquista", "lider", "requisitante"];

function UsuariosPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<UsuarioRow | null>(null);

  const token = user?.token ?? "";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["usuarios", token],
    enabled: role === "mestre" && !!token,
    queryFn: async (): Promise<UsuarioRow[]> => {
      const { data, error } = await supabase.rpc("listar_usuarios" as never, { _token: token } as never);
      if (error) throw error;
      return (data ?? []) as unknown as UsuarioRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("excluir_usuario" as never, { _token: token, _id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "mestre") {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Apenas o Mestre pode gerenciar usuários.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre pessoas e defina o cargo, o setor e o status.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo usuário
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell><RoleBadge role={u.cargo} /></TableCell>
                <TableCell className="text-muted-foreground">{u.setor ?? "—"}</TableCell>
                <TableCell>
                  {u.ativo
                    ? <Badge variant="secondary">Ativo</Badge>
                    : <Badge variant="outline">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={u.id === user?.id}
                    onClick={() => setToDelete(u)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <UserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />
      <UserDialog
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {toDelete?.nome} não poderá mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserDialog({
  open, initial, onClose, onSaved,
}: {
  open: boolean;
  initial?: UsuarioRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const token = user?.token ?? "";
  const isEdit = !!initial;
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState<AppRole>(initial?.cargo ?? "requisitante");
  const [setor, setSetor] = useState(initial?.setor ?? "");
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [busy, setBusy] = useState(false);

  // Reset form when dialog re-opens
  useMemo(() => {
    if (open) {
      setNome(initial?.nome ?? "");
      setUsername(initial?.username ?? "");
      setSenha("");
      setCargo(initial?.cargo ?? "requisitante");
      setSetor(initial?.setor ?? "");
      setAtivo(initial?.ativo ?? true);
    }
  }, [open, initial]);

  async function save() {
    if (!nome.trim() || !username.trim()) {
      toast.error("Nome e usuário são obrigatórios");
      return;
    }
    if (!isEdit && senha.length < 3) {
      toast.error("Defina uma senha (mínimo 3 caracteres)");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const { error } = await supabase.rpc("atualizar_usuario" as never, {
          _token: token,
          _id: initial.id,
          _nome: upper(nome.trim()),
          _username: username.trim().toUpperCase(),
          _cargo: cargo,
          _setor: setor.trim(),
          _ativo: ativo,
          _senha: senha || null,
        } as never);
        if (error) throw error;
        toast.success("Usuário atualizado");
      } else {
        const { error } = await supabase.rpc("criar_usuario" as never, {
          _token: token,
          _nome: upper(nome.trim()),
          _username: username.trim().toUpperCase(),
          _senha: senha,
          _cargo: cargo,
          _setor: setor.trim(),
          _ativo: ativo,
        } as never);
        if (error) throw error;
        toast.success("Usuário criado");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados. Deixe a senha em branco para não alterá-la." : "Preencha os dados do novo usuário."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Usuário</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                autoCapitalize="characters"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Senha {isEdit && <span className="text-muted-foreground text-xs">(opcional)</span>}</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={isEdit ? "Deixe em branco para manter" : "••••"} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cargo / Permissão</Label>
              <Select value={cargo} onValueChange={(v) => setCargo(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: Cozinha" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo" />
            <Label htmlFor="ativo" className="cursor-pointer">Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoleBadge({ role }: { role: AppRole }) {
  const variant =
    role === "mestre" ? "default" :
    role === "estoquista" ? "secondary" : "outline";
  return <Badge variant={variant}>{ROLE_LABEL[role]}</Badge>;
}
