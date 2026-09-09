CREATE OR REPLACE FUNCTION public.liberar_requisicao(_requisicao_id uuid, _responsavel text, _liberacoes jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status public.requisicao_status;
  v_numero integer;
  r RECORD;
  v_qtd numeric;
  v_lotes numeric;
  v_produto numeric;
  v_disp numeric;
  v_restante numeric;
  v_consumir numeric;
  l RECORD;
BEGIN
  SELECT status, numero INTO v_status, v_numero
    FROM public.requisicoes WHERE id = _requisicao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Esta requisição já foi % e não pode ser liberada novamente', v_status; END IF;

  IF _liberacoes IS NOT NULL THEN
    UPDATE public.requisicao_itens ri
      SET quantidade_liberada = GREATEST(0, COALESCE((_liberacoes ->> ri.id::text)::numeric, ri.quantidade_solicitada))
      WHERE ri.requisicao_id = _requisicao_id;
  ELSE
    UPDATE public.requisicao_itens
      SET quantidade_liberada = GREATEST(0, COALESCE(quantidade_liberada, quantidade_solicitada))
      WHERE requisicao_id = _requisicao_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.requisicao_itens
    WHERE requisicao_id = _requisicao_id AND COALESCE(quantidade_liberada, 0) > 0
  ) THEN
    RAISE EXCEPTION 'Nenhum item com quantidade liberada maior que zero';
  END IF;

  -- 1) valida disponibilidade (produto + lotes), sem reduzir o saldo do produto
  FOR r IN
    SELECT ri.produto_id, SUM(COALESCE(ri.quantidade_liberada, 0))::numeric AS qtd, p.nome
      FROM public.requisicao_itens ri
      JOIN public.produtos p ON p.id = ri.produto_id
     WHERE ri.requisicao_id = _requisicao_id
     GROUP BY ri.produto_id, p.nome
  LOOP
    CONTINUE WHEN r.qtd <= 0;

    SELECT COALESCE(estoque_atual, 0)::numeric INTO v_produto
      FROM public.produtos WHERE id = r.produto_id FOR UPDATE;

    SELECT COALESCE(SUM(saldo), 0)::numeric INTO v_lotes
      FROM public.lotes WHERE produto_id = r.produto_id AND saldo > 0;

    v_disp := GREATEST(v_produto, v_lotes);

    -- lotes acima do saldo do produto: o saldo do produto é corrigido para cima
    IF v_lotes > v_produto THEN
      UPDATE public.produtos SET estoque_atual = v_lotes, updated_at = now() WHERE id = r.produto_id;
    END IF;

    -- permite liberar exatamente o disponível; tolerância p/ arredondamento
    IF round(r.qtd, 6) > round(v_disp, 6) THEN
      RAISE EXCEPTION 'Estoque insuficiente para %. Disponível: %, liberado: %', r.nome, v_disp, r.qtd;
    END IF;
  END LOOP;

  -- 2) baixa FEFO por produto, podendo usar vários lotes
  FOR r IN
    SELECT produto_id, SUM(COALESCE(quantidade_liberada, 0))::numeric AS qtd
      FROM public.requisicao_itens
     WHERE requisicao_id = _requisicao_id
     GROUP BY produto_id
  LOOP
    v_qtd := r.qtd;
    CONTINUE WHEN v_qtd <= 0;
    v_restante := v_qtd;

    FOR l IN
      SELECT id, saldo::numeric AS saldo, local_id FROM public.lotes
       WHERE produto_id = r.produto_id AND saldo > 0
       ORDER BY validade NULLS LAST, created_at
       FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;
      v_consumir := LEAST(l.saldo, v_restante);
      UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (r.produto_id, 'saida', v_consumir,
              'Requisição Liberada #' || v_numero, NULLIF(_responsavel,''), l.id, l.local_id);
      v_restante := v_restante - v_consumir;
    END LOOP;

    -- lotes não cobriram tudo: baixa o restante do saldo do produto
    IF round(v_restante, 6) > 0 THEN
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
      VALUES (r.produto_id, 'saida', v_restante,
              'Requisição Liberada #' || v_numero || ' (sem lote)', NULLIF(_responsavel,''),
              (SELECT local_padrao_id FROM public.produtos WHERE id = r.produto_id));
    END IF;
  END LOOP;

  UPDATE public.requisicoes
     SET status='liberada', liberada_em=now(), responsavel_liberacao=_responsavel
   WHERE id=_requisicao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) TO authenticated;