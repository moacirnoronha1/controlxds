CREATE OR REPLACE FUNCTION public.auditoria_estoque()
RETURNS TABLE(produto_id uuid, nome text, categoria text, unidade text, estoque_produto numeric, soma_lotes numeric, diferenca_lotes numeric,
  inventario_id uuid, inventario_titulo text, inventario_fechado_em timestamptz, saldo_inventario numeric,
  entradas_pos numeric, saidas_pos numeric, saldo_esperado numeric, diferenca_inexplicada numeric, qtd_mov_pos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ult AS (
    SELECT DISTINCT ON (ii.produto_id) ii.produto_id, i.id inv_id, i.titulo, i.fechado_em,
      COALESCE(ii.contagem_fisica, ii.estoque_sistema) saldo
    FROM inventario_itens ii JOIN inventarios i ON i.id = ii.inventario_id
    WHERE i.status = 'fechado' AND i.fechado_em IS NOT NULL
    ORDER BY ii.produto_id, i.fechado_em DESC
  ), lt AS (
    SELECT l.produto_id, SUM(l.saldo) s FROM lotes l WHERE l.saldo > 0 GROUP BY l.produto_id
  ), mv AS (
    SELECT m.produto_id,
      SUM(CASE WHEN m.tipo IN ('entrada','ajuste_entrada','emprestimo_entrada') THEN m.quantidade ELSE 0 END) ent,
      SUM(CASE WHEN m.tipo IN ('entrada','ajuste_entrada','emprestimo_entrada') THEN 0 ELSE m.quantidade END) sai,
      COUNT(*)::int n
    FROM movimentacoes m JOIN ult u ON u.produto_id = m.produto_id
    WHERE m.created_at > u.fechado_em AND m.observacao NOT ILIKE 'Ajuste de Invent%'
    GROUP BY m.produto_id
  )
  SELECT p.id, p.nome, p.categoria, p.unidade_medida, p.estoque_atual, COALESCE(lt.s,0),
    round(p.estoque_atual - COALESCE(lt.s,0), 6),
    u.inv_id, u.titulo, u.fechado_em, u.saldo,
    COALESCE(mv.ent,0), COALESCE(mv.sai,0),
    CASE WHEN u.inv_id IS NULL THEN NULL ELSE round(u.saldo + COALESCE(mv.ent,0) - COALESCE(mv.sai,0), 6) END,
    CASE WHEN u.inv_id IS NULL THEN NULL ELSE round(p.estoque_atual - (u.saldo + COALESCE(mv.ent,0) - COALESCE(mv.sai,0)), 6) END,
    COALESCE(mv.n,0)
  FROM produtos p
  LEFT JOIN lt ON lt.produto_id = p.id
  LEFT JOIN ult u ON u.produto_id = p.id
  LEFT JOIN mv ON mv.produto_id = p.id
  WHERE p.ativo = true AND public.is_app_user();
$$;
REVOKE ALL ON FUNCTION public.auditoria_estoque() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_estoque() TO authenticated, service_role;

-- Snapshot consistente na abertura: bloqueia produtos durante a captura
CREATE OR REPLACE FUNCTION public.criar_inventario(_tipo inventario_tipo, _titulo text, _produto_ids uuid[] DEFAULT NULL, _categoria text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_cat TEXT := NULLIF(btrim(COALESCE(_categoria, '')), '');
BEGIN
  PERFORM 1 FROM public.produtos p WHERE p.ativo = true
    AND (v_cat IS NULL OR upper(p.categoria) = upper(v_cat))
    AND (_tipo <> 'parcial' OR _produto_ids IS NULL OR p.id = ANY(_produto_ids))
    FOR SHARE;

  INSERT INTO public.inventarios (tipo, titulo, criado_por, status, categoria)
  VALUES (_tipo, _titulo, auth.uid(), 'em_conferencia', v_cat)
  RETURNING id INTO v_id;

  INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
  SELECT v_id, p.id, COALESCE(p.estoque_atual, 0) FROM public.produtos p
  WHERE p.ativo = true
    AND (v_cat IS NULL OR upper(p.categoria) = upper(v_cat))
    AND (_tipo <> 'parcial' OR _produto_ids IS NULL OR p.id = ANY(_produto_ids));

  RETURN v_id;
END;
$$;