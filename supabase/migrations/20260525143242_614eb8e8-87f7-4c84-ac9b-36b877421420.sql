-- Open access on operational tables (dev mode, no auth)
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos','movimentacoes','inventarios','inventario_itens'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "dev open all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END$$;

-- Allow inventory functions without auth
CREATE OR REPLACE FUNCTION public.criar_inventario(_tipo inventario_tipo, _titulo text, _produto_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.inventarios (tipo, titulo, criado_por, status)
  VALUES (_tipo, _titulo, auth.uid(), 'em_conferencia')
  RETURNING id INTO v_id;

  IF _tipo = 'parcial' AND _produto_ids IS NOT NULL THEN
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual FROM public.produtos p
    WHERE p.ativo = true AND p.id = ANY(_produto_ids);
  ELSE
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual FROM public.produtos p WHERE p.ativo = true;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fechar_inventario(_inventario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status public.inventario_status;
  r RECORD;
BEGIN
  SELECT status INTO v_status FROM public.inventarios WHERE id = _inventario_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Inventário não encontrado'; END IF;
  IF v_status = 'fechado' THEN RAISE EXCEPTION 'Inventário já está fechado'; END IF;

  FOR r IN
    SELECT produto_id, diferenca FROM public.inventario_itens
    WHERE inventario_id = _inventario_id AND contagem_fisica IS NOT NULL AND diferenca <> 0
  LOOP
    IF r.diferenca > 0 THEN
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel)
      VALUES (r.produto_id, 'entrada', r.diferenca, 'Ajuste de inventário ' || _inventario_id::text, COALESCE(auth.uid()::text, 'sistema'));
    ELSE
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel)
      VALUES (r.produto_id, 'saida', abs(r.diferenca), 'Ajuste de inventário ' || _inventario_id::text, COALESCE(auth.uid()::text, 'sistema'));
    END IF;
  END LOOP;

  UPDATE public.inventarios
    SET status='fechado', fechado_por=auth.uid(), fechado_em=now()
    WHERE id = _inventario_id;
END;
$function$;