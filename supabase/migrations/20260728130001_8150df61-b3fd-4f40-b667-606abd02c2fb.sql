CREATE OR REPLACE FUNCTION public.is_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_user() TO authenticated, service_role;

DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'produtos','movimentacoes','lotes','locais_estoque','setores','responsaveis',
    'requisicoes','requisicao_itens','avarias','notas_fiscais','emprestimos',
    'inventarios','inventario_itens'
  ] LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname LIKE '%_auth_all'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_app_user()) WITH CHECK (public.is_app_user())',
      t || '_app_user_all', t
    );
  END LOOP;
END $$;