ALTER TABLE public.inventarios ADD COLUMN IF NOT EXISTS categoria text;

CREATE OR REPLACE FUNCTION public.criar_inventario(_tipo inventario_tipo, _titulo text, _produto_ids uuid[] DEFAULT NULL::uuid[], _categoria text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_cat TEXT := NULLIF(btrim(COALESCE(_categoria, '')), '');
BEGIN
  INSERT INTO public.inventarios (tipo, titulo, criado_por, status, categoria)
  VALUES (_tipo, _titulo, auth.uid(), 'em_conferencia', v_cat)
  RETURNING id INTO v_id;

  IF _tipo = 'parcial' AND _produto_ids IS NOT NULL THEN
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual FROM public.produtos p
    WHERE p.ativo = true AND p.id = ANY(_produto_ids)
      AND (v_cat IS NULL OR upper(p.categoria) = upper(v_cat));
  ELSE
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual FROM public.produtos p
    WHERE p.ativo = true
      AND (v_cat IS NULL OR upper(p.categoria) = upper(v_cat));
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_inventario(inventario_tipo, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_inventario(inventario_tipo, text, uuid[], text) TO authenticated;