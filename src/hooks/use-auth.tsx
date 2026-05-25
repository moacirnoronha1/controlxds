// Auth temporariamente desativada. Hook stub: todos têm acesso de admin.
import { createContext, useContext, type ReactNode } from "react";

export type AppRole = "admin" | "estoquista" | "leitor";

type AuthCtx = {
  session: { user: { id: string } } | null;
  user: { id: string } | null;
  loading: boolean;
  role: AppRole;
  displayName: string;
  signOut: () => Promise<void>;
};

const FAKE: AuthCtx = {
  session: { user: { id: "dev" } },
  user: { id: "dev" },
  loading: false,
  role: "admin",
  displayName: "Dev",
  signOut: async () => {},
};

const Ctx = createContext<AuthCtx>(FAKE);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={FAKE}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  estoquista: "Estoquista",
  leitor: "Leitor",
};

export function can(_role: AppRole | null, _action: string): boolean {
  return true;
}
