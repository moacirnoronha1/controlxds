import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "estoquista" | "leitor";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  displayName: string | null;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [qc]);

  const user = session?.user ?? null;

  const { data: profileData } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("display_name,email").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      const allRoles = (roles ?? []).map((r) => r.role as AppRole);
      const priority: AppRole[] = ["admin", "estoquista", "leitor"];
      const role = priority.find((r) => allRoles.includes(r)) ?? "leitor";
      return {
        role,
        displayName: profile?.display_name ?? user!.email ?? null,
      };
    },
  });

  const value: AuthCtx = {
    session,
    user,
    loading,
    role: profileData?.role ?? null,
    displayName: profileData?.displayName ?? user?.email ?? null,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  estoquista: "Estoquista",
  leitor: "Leitor",
};

export function can(role: AppRole | null, action:
  | "manageProducts"
  | "updateStock"
  | "createMovement"
  | "deleteMovement"
  | "manageUsers"
  | "viewReports"
): boolean {
  if (!role) return false;
  switch (action) {
    case "manageProducts":
    case "manageUsers":
    case "deleteMovement":
      return role === "admin";
    case "updateStock":
    case "createMovement":
      return role === "admin" || role === "estoquista";
    case "viewReports":
      return true;
  }
}
