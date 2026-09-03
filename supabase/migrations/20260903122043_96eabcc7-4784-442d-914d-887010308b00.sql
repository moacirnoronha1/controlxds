CREATE OR REPLACE FUNCTION public.aprovar_ajuste(_ajuste_id uuid, _responsavel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a public.ajustes_estoque%ROWTYPE;
  v_saldo_antes numeric;
  v_local uuid;
  v_lote_id uuid;
  v_dif numeric;
  v_qtd numeric;
  v_lote_saldo numeric;
  v_restante numeric;
  v_consumir numeric;
  v_obs text;
  l RECORD;
BEGIN
  SELECT * INTO a FROM public.ajustes_estoque WHERE id = _ajuste_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF a.status <> 'pendente' THEN RAISE EXCEPTION 'Ajuste já foi decidido'; END IF;
  IF a.quantidade IS NULL OR a.quantidade < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT COALESCE(estoque_atual, 0), COALESCE(a.local_id, local_padrao_id)
    INTO v_saldo_antes, v_local
    FROM public.produtos WHERE id = a.produto_id FOR UPDATE;

  IF v_local IS NULL THEN
    SELECT local_id INTO v_local FROM public.lotes
      WHERE produto_id = a.produto_id AND saldo > 0
      ORDER BY validade NULLS LAST, created_at LIMIT 1;
  END IF;
  IF v_local IS NULL THEN
    SELECT id INTO v_local FROM public.locais_estoque WHERE ativo = true ORDER BY created_at LIMIT 1;
  END IF;

  -- O valor informado é SEMPRE o estoque atual correto (contagem).
  v_dif := a.quantidade - v_saldo_antes;
  v_obs := 'Ajuste de Estoque' || COALESCE(' - ' || NULLIF(a.motivo,''), '');

  IF v_dif > 0 THEN
    IF v_local IS NULL THEN
      RAISE EXCEPTION 'Nenhum local de estoque disponível para o ajuste';
    END IF;
    INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
    VALUES (a.produto_id, v_local, v_dif, v_dif, 'Ajuste de Estoque ' || a.id::text)
    RETURNING id INTO v_lote_id;

    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (a.produto_id, 'ajuste_entrada', v_dif, v_obs, NULLIF(_responsavel,''), v_lote_id, v_local);

  ELSIF v_dif < 0 THEN
    v_qtd := -v_dif;

    IF a.lote_id IS NOT NULL THEN
      SELECT saldo, local_id INTO v_lote_saldo, v_local
        FROM public.lotes WHERE id = a.lote_id FOR UPDATE;
      IF v_lote_saldo IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
      v_consumir := LEAST(COALESCE(v_lote_saldo,0), v_qtd);
      IF v_consumir > 0 THEN
        UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = a.lote_id;
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
        VALUES (a.produto_id, 'ajuste_saida', v_consumir, v_obs, NULLIF(_responsavel,''), a.lote_id, v_local);
      END IF;
      v_restante := v_qtd - v_consumir;
    ELSE
      v_restante := v_qtd;
      FOR l IN
        SELECT id, saldo::numeric AS saldo, local_id FROM public.lotes
         WHERE produto_id = a.produto_id AND saldo > 0
           AND (a.local_id IS NULL OR local_id = a.local_id)
         ORDER BY validade NULLS LAST, created_at
         FOR UPDATE
      LOOP
        EXIT WHEN v_restante <= 0;
        v_consumir := LEAST(l.saldo, v_restante);
        UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
        VALUES (a.produto_id, 'ajuste_saida', v_consumir, v_obs, NULLIF(_responsavel,''), l.id, l.local_id);
        v_restante := v_restante - v_consumir;
      END LOOP;
    END IF;

    IF v_restante > 0 THEN
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
      VALUES (a.produto_id, 'ajuste_saida', v_restante, v_obs || ' (sem lote)', NULLIF(_responsavel,''), v_local);
    END IF;
  END IF;

  -- Garante que o estoque final seja exatamente o valor informado
  UPDATE public.produtos SET estoque_atual = a.quantidade, updated_at = now()
   WHERE id = a.produto_id;

  UPDATE public.ajustes_estoque
     SET status = 'aprovado',
         tipo = 'correcao',
         decidido_por = NULLIF(_responsavel,''),
         decidido_em = now(),
         saldo_antes = v_saldo_antes,
         saldo_depois = a.quantidade
   WHERE id = a.id;
END;
$function$;