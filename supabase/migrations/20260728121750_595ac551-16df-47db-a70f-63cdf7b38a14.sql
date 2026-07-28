-- 1. notas_fiscais: remove open policy, restrict anon
DROP POLICY IF EXISTS notas_fiscais_all ON public.notas_fiscais;

CREATE POLICY notas_fiscais_auth_all ON public.notas_fiscais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anon may only insert (import) and read the duplicate-check columns
CREATE POLICY notas_fiscais_anon_insert ON public.notas_fiscais
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY notas_fiscais_anon_select ON public.notas_fiscais
  FOR SELECT TO anon USING (true);

REVOKE ALL ON public.notas_fiscais FROM anon;
GRANT INSERT ON public.notas_fiscais TO anon;
GRANT SELECT (id, chave, numero) ON public.notas_fiscais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;

-- 2. user_roles: prevent self-granting roles
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "admins grant roles to others" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY "admins update roles of others" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY "admins delete roles of others" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());