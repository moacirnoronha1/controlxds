import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !senha) return;
    setBusy(true);
    try {
      await signIn(username.trim(), senha);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-semibold">
            GX
          </div>
          <h1 className="text-lg font-semibold">GX Control</h1>
          <p className="text-xs text-muted-foreground">Entre para acessar o sistema</p>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label>Usuário</Label>
            <Input
              autoFocus
              autoCapitalize="characters"
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
              placeholder="MOACIR"
            />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            <LogIn className="h-4 w-4 mr-2" />
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
