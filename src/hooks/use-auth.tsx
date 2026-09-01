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
import { loginComSessao } from "@/lib/app-login.functions";

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
  token?: string;
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
  | "manageAvarias"        // alterar status/checklist
  | "createAjuste"         // solicitar ajuste de estoque
  | "approveAjuste";       // aprovar/recusar ajuste de estoque

const MATRIX: Record<AppRole, Action[]> = {
  mestre: [
    "createMovement", "manageProducts", "createRequisicao", "liberateRequisicao",
    "viewRelatorios", "manageUsers", "resetSystem", "manageSettings",
    "viewAvarias", "createAvaria", "manageAvarias",
    "createAjuste", "approveAjuste",
  ],
  lider: [
    "createMovement", "manageProducts", "createRequisicao", "liberateRequisicao",
    "viewRelatorios",
    "viewAvarias", "createAvaria", "manageAvarias",
    "createAjuste", "approveAjuste",
  ],
  estoquista: [
    "createMovement", "createRequisicao", "liberateRequisicao", "viewRelatorios",
    "viewAvarias", "createAvaria",
    "createAjuste",
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
    let cancelled = false;

    (async () => {
      let stored: SessionUser | null = null;
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (raw) stored = JSON.parse(raw) as SessionUser;
      } catch {
        /* ignore */
      }

      if (stored) {
        // A sessão do backend pode ter expirado: sem ela o app consulta como
        // visitante e o banco bloqueia tudo (produtos "somem"). Nesse caso,
        // limpamos a sessão local e pedimos login novamente.
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          stored = null;
        }
      }

      if (!cancelled) {
        setUser(stored);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);


  const signIn = useCallback(async (username: string, senha: string) => {
    const res = await loginComSessao({ data: { username, senha } });
    const row = res.user as SessionUser;
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    });
    if (sessErr) throw new Error(sessErr.message);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
    setUser(row);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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
