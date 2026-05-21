import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABEL, type AppRole } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  component: UsuariosPage,
});

type Row = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: AppRole;
};

function UsuariosPage() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    enabled: role === "admin",
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email").order("created_at"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleMap = new Map<string, AppRole>();
      const priority: AppRole[] = ["admin", "estoquista", "leitor"];
      for (const r of roles ?? []) {
        const cur = roleMap.get(r.user_id);
        const nr = r.role as AppRole;
        if (!cur || priority.indexOf(nr) < priority.indexOf(cur)) roleMap.set(r.user_id, nr);
      }
      return (profiles ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        role: roleMap.get(p.id) ?? "leitor",
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "admin") {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Defina o papel de cada usuário. Novos cadastros entram como <b>Leitor</b>.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel atual</TableHead>
              <TableHead className="w-[200px]">Alterar papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.display_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v) => setRole.mutate({ userId: u.id, newRole: v as AppRole })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="estoquista">Estoquista</SelectItem>
                      <SelectItem value="leitor">Leitor</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Permissões por papel</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <PermBox title="Administrador" items={["Tudo: produtos, usuários, estoque, relatórios"]} />
          <PermBox title="Estoquista" items={["Lançar entradas e saídas", "Atualizar estoque", "Ver produtos e relatórios"]} />
          <PermBox title="Leitor" items={["Visualizar produtos", "Consultar estoque e relatórios", "Não pode editar nada"]} />
        </div>
      </Card>
    </div>
  );
}

function PermBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="font-medium mb-2">{title}</div>
      <ul className="space-y-1 text-muted-foreground list-disc list-inside">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}

export function RoleBadge({ role }: { role: AppRole }) {
  const variant =
    role === "admin" ? "default" :
    role === "estoquista" ? "secondary" : "outline";
  return <Badge variant={variant}>{ROLE_LABEL[role]}</Badge>;
}
