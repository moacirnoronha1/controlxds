
-- 1) emprestimos: policy currently targets 'public' role. Restrict to authenticated.
DROP POLICY IF EXISTS emprestimos_all ON public.emprestimos;
CREATE POLICY "emprestimos_auth_all" ON public.emprestimos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.emprestimos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emprestimos TO authenticated;

-- 2) lotes / locais_estoque / setores / responsaveis: remove anon access
DROP POLICY IF EXISTS "dev open all" ON public.lotes;
CREATE POLICY "lotes_auth_all" ON public.lotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.lotes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated;

DROP POLICY IF EXISTS "dev open all" ON public.locais_estoque;
CREATE POLICY "locais_auth_all" ON public.locais_estoque
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.locais_estoque FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_estoque TO authenticated;

DROP POLICY IF EXISTS "dev open all" ON public.setores;
CREATE POLICY "setores_auth_all" ON public.setores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.setores FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;

DROP POLICY IF EXISTS "dev open all" ON public.responsaveis;
CREATE POLICY "responsaveis_auth_all" ON public.responsaveis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.responsaveis FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;

-- 3) requisicoes / requisicao_itens: remove anon access
DROP POLICY IF EXISTS "dev open all" ON public.requisicoes;
CREATE POLICY "requisicoes_auth_all" ON public.requisicoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.requisicoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes TO authenticated;

DROP POLICY IF EXISTS "dev open all" ON public.requisicao_itens;
CREATE POLICY "requisicao_itens_auth_all" ON public.requisicao_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.requisicao_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_itens TO authenticated;

-- 4) SECURITY DEFINER functions: revoke EXECUTE from anon (keep login_usuario public for sign-in)
REVOKE EXECUTE ON FUNCTION public.criar_usuario(text, text, text, user_cargo, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_usuario(uuid, text, text, user_cargo, text, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_inventario(inventario_tipo, text, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fechar_inventario(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_requisicao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_entrada_lote(uuid, uuid, numeric, date, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_saida_fefo(uuid, uuid, numeric, text, text) FROM anon;
