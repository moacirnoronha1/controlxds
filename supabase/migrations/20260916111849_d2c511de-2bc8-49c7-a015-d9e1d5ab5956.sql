CREATE OR REPLACE FUNCTION public.emprestimo_baixar(
  _produto_id uuid,
  _local_id uuid,
  _lote_id uuid,
  _quantidade numeric,
  _responsavel text,
  _observacao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restante numeric := round(_quantidade, 6);
  v_disp_lotes_local numeric := 0;
  v_saldo_produto numeric := 0;
  v_saldo_todos_lotes numeric := 0;
  v_saldo_sem_lote numeric := 0;
  v_disponivel numeric := 0;
  v_consumir numeric;
  v_lote_regularizacao uuid;
  v_lote_produto uuid;
  v_lote_local uuid;
  l record;
BEGIN
  IF _produto_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o produto do catálogo';
  END IF;
  IF _local_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o local de estoque';
  END IF;
  IF _quantidade IS NULL OR round(_quantidade, 6) <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT estoque_atual
    INTO v_saldo_produto
    FROM public.produtos
   WHERE id = _produto_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF _lote_id IS NOT NULL THEN
    SELECT produto_id, local_id, saldo
      INTO v_lote_produto, v_lote_local, v_disponivel
      FROM public.lotes
     WHERE id = _lote_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lote não encontrado';
    END IF;
    IF v_lote_produto <> _produto_id OR v_lote_local <> _local_id THEN
      RAISE EXCEPTION 'O lote selecionado não pertence ao produto e local informados';
    END IF;
    IF round(v_restante, 6) > round(GREATEST(v_disponivel, 0), 6) THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_disponivel, _quantidade;
    END IF;

    UPDATE public.lotes
       SET saldo = saldo - v_restante, updated_at = now()
     WHERE id = _lote_id;

    INSERT INTO public.movimentacoes
      (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES
      (_produto_id, 'emprestimo_saida', v_restante, _observacao,
       NULLIF(_responsavel, ''), _lote_id, _local_id);
    RETURN;
  END IF;

  SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0)
    INTO v_saldo_todos_lotes
    FROM public.lotes
   WHERE produto_id = _produto_id;

  SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0)
    INTO v_disp_lotes_local
    FROM public.lotes
   WHERE produto_id = _produto_id
     AND local_id = _local_id
     AND saldo > 0;

  v_saldo_sem_lote := GREATEST(0, round(v_saldo_produto - v_saldo_todos_lotes, 6));
  v_disponivel := round(v_disp_lotes_local + v_saldo_sem_lote, 6);

  IF round(v_restante, 6) > v_disponivel THEN
    RAISE EXCEPTION 'Estoque insuficiente no local. Disponível: %, solicitado: %', v_disponivel, _quantidade;
  END IF;

  FOR l IN
    SELECT id, saldo::numeric AS saldo
      FROM public.lotes
     WHERE produto_id = _produto_id
       AND local_id = _local_id
       AND saldo > 0
     ORDER BY validade NULLS LAST, created_at, id
     FOR UPDATE
  LOOP
    EXIT WHEN round(v_restante, 6) <= 0;
    v_consumir := LEAST(l.saldo, v_restante);

    UPDATE public.lotes
       SET saldo = saldo - v_consumir, updated_at = now()
     WHERE id = l.id;

    INSERT INTO public.movimentacoes
      (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES
      (_produto_id, 'emprestimo_saida', v_consumir, _observacao,
       NULLIF(_responsavel, ''), l.id, _local_id);

    v_restante := round(v_restante - v_consumir, 6);
  END LOOP;

  IF v_restante > 0 THEN
    IF round(v_restante, 6) > round(v_saldo_sem_lote, 6) THEN
      RAISE EXCEPTION 'Saldo sem lote insuficiente. Disponível: %, solicitado: %', v_saldo_sem_lote, v_restante;
    END IF;

    INSERT INTO public.lotes
      (produto_id, local_id, quantidade_inicial, saldo, observacao)
    VALUES
      (_produto_id, _local_id, v_saldo_sem_lote, v_saldo_sem_lote,
       'Lote padrão criado para regularizar estoque sem lote')
    RETURNING id INTO v_lote_regularizacao;

    UPDATE public.lotes
       SET saldo = saldo - v_restante, updated_at = now()
     WHERE id = v_lote_regularizacao;

    INSERT INTO public.movimentacoes
      (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES
      (_produto_id, 'emprestimo_saida', v_restante,
       _observacao || ' (estoque sem lote regularizado)',
       NULLIF(_responsavel, ''), v_lote_regularizacao, _local_id);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.emprestimo_baixar(uuid, uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emprestimo_baixar(uuid, uuid, uuid, numeric, text, text) TO authenticated, service_role;