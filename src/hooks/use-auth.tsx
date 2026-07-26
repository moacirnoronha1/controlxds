import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "mestre" | "estoquista" | "lider" | "requisitante";

export const ROLE_LABEL: Record<AppRole, string> = {
  mestre: "Mestre",
  estoquista: "Estoquista",
  lider: "Líder",
  requisitante: "Responsável pela Requisição",
};

export type SessionUser = {
  id: string;
  nome: string;
  username: string;
  cargo: AppRole;
  setor: string | null;
};

export type Action =
  | "createMovement"       // entradas, scan, ajustar inventário
  | "manageProducts"       // produtos, fechar inventário
  | "createRequisicao"
  | "liberateRequisicao"
  | "viewRelatorios"
  | "manageUsers"
  | "resetSystem"
  | "manageSettings"
  | "viewAvarias"          // ver aba de avarias
  | "createAvaria"         // registrar avaria
  | "manageAvarias";       // alterar status/checklist

const MATRIX: Record<AppRole, Action[]> = {
  mestre: [
    "createMovement", "manageProducts", "createRequisicao", "liberateRequisicao",
    "viewRelatorios", "manageUsers", "resetSystem", "manageSettings",
    "viewAvarias", "createAvaria", "manageAvarias",
  ],
  lider: [
    "createMovement", "manageProducts", "createRequisicao", "liberateRequisicao",
    "viewRelatorios",
    "viewAvarias", "createAvaria", "manageAvarias",
  ],
  estoquista: [
    "createMovement", "createRequisicao", "liberateRequisicao", "viewRelatorios",
    "viewAvarias", "createAvaria",
  ],
  requisitante: ["createRequisicao"],
};

export function can(role: AppRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(action) ?? false;
}

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  role: AppRole | null;
  displayName: string;
  signIn: (username: string, senha: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "gx:session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(async (username: string, senha: string) => {
    const { data, error } = await supabase.rpc("login_usuario" as never, {
      _username: username,
      _senha: senha,
    } as never);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? (data[0] as SessionUser | undefined) : undefined;
    if (!row || !row.id) throw new Error("Usuário ou senha inválidos, ou usuário inativo.");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
    setUser(row);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      role: user?.cargo ?? null,
      displayName: user?.nome ?? "",
      signIn,
      signOut,
    }),
    [user, loading, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
