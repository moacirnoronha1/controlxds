-- 1) produtos
DROP POLICY IF EXISTS "dev open all" ON public.produtos;
REVOKE ALL ON public.produtos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
CREATE POLICY "produtos_auth_all" ON public.produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) movimentacoes
DROP POLICY IF EXISTS "dev open all" ON public.movimentacoes;
REVOKE ALL ON public.movimentacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;
CREATE POLICY "movimentacoes_auth_all" ON public.movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) inventarios
DROP POLICY IF EXISTS "dev open all" ON public.inventarios;
REVOKE ALL ON public.inventarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventarios TO authenticated;
GRANT ALL ON public.inventarios TO service_role;
CREATE POLICY "inventarios_auth_all" ON public.inventarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) inventario_itens
DROP POLICY IF EXISTS "dev open all" ON public.inventario_itens;
REVOKE ALL ON public.inventario_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventario_itens TO authenticated;
GRANT ALL ON public.inventario_itens TO service_role;
CREATE POLICY "inventario_itens_auth_all" ON public.inventario_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) notas_fiscais: remover leitura anônima de todas as colunas
DROP POLICY IF EXISTS notas_fiscais_anon_select ON public.notas_fiscais;
REVOKE SELECT ON public.notas_fiscais FROM anon;

CREATE OR REPLACE FUNCTION public.nf_ja_importada(_chave text)
RETURNS TABLE(existe boolean, numero text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT true, nf.numero FROM public.notas_fiscais nf WHERE nf.chave = _chave LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.nf_ja_importada(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nf_ja_importada(text) TO anon, authenticated, service_role;