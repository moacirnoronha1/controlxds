-- 1) Remove anon access from tables
REVOKE ALL ON public.avarias FROM anon;
REVOKE ALL ON public.locais_estoque FROM anon;
REVOKE ALL ON public.notas_fiscais FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- 2) Drop always-true anon insert policy
DROP POLICY IF EXISTS notas_fiscais_anon_insert ON public.notas_fiscais;

-- 3) Profiles: ensure updates cannot change ownership
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
CREATE POLICY "admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.nf_ja_importada(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.listar_usuarios(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.criar_usuario(text, text, text, text, user_cargo, text, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.atualizar_usuario(text, uuid, text, text, user_cargo, text, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.excluir_usuario(text, uuid) FROM anon, public;

-- login is now performed server-side with the service role only
REVOKE ALL ON FUNCTION public.login_usuario(text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO service_role;