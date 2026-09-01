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
  v_lotes_total numeric;
  v_disp numeric;
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

  IF a.tipo = 'entrada' THEN
    v_dif := a.quantidade;
  ELSIF a.tipo = 'saida' THEN
    v_dif := -a.quantidade;
  ELSE
    v_dif := a.quantidade - v_saldo_antes;
  END IF;

  IF v_dif > 0 THEN
    IF v_local IS NULL THEN
      RAISE EXCEPTION 'Nenhum local de estoque disponível para o ajuste';
    END IF;
    INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
    VALUES (a.produto_id, v_local, v_dif, v_dif, 'Ajuste de estoque ' || a.id::text)
    RETURNING id INTO v_lote_id;

    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (a.produto_id, 'entrada', v_dif,
            'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
            NULLIF(_responsavel,''), v_lote_id, v_local);

  ELSIF v_dif < 0 THEN
    v_qtd := -v_dif;

    SELECT COALESCE(SUM(saldo), 0) INTO v_lotes_total
      FROM public.lotes WHERE produto_id = a.produto_id AND saldo > 0;
    v_disp := GREATEST(v_lotes_total, v_saldo_antes);
    IF v_disp < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %', v_disp, v_qtd;
    END IF;

    IF a.lote_id IS NOT NULL THEN
      SELECT saldo, local_id INTO v_lote_saldo, v_local
        FROM public.lotes WHERE id = a.lote_id FOR UPDATE;
      IF v_lote_saldo IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
      IF v_lote_saldo < v_qtd THEN
        RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_lote_saldo, v_qtd;
      END IF;
      UPDATE public.lotes SET saldo = saldo - v_qtd, updated_at = now() WHERE id = a.lote_id;
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (a.produto_id, 'saida', v_qtd,
              'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
              NULLIF(_responsavel,''), a.lote_id, v_local);
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
        VALUES (a.produto_id, 'saida', v_consumir,
                'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
                NULLIF(_responsavel,''), l.id, l.local_id);
        v_restante := v_restante - v_consumir;
      END LOOP;

      IF v_restante > 0 THEN
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
        VALUES (a.produto_id, 'saida', v_restante,
                'Ajuste aprovado (sem lote)' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
                NULLIF(_responsavel,''), v_local);
      END IF;
    END IF;
  END IF;

  UPDATE public.ajustes_estoque
     SET status = 'aprovado',
         decidido_por = NULLIF(_responsavel,''),
         decidido_em = now(),
         saldo_antes = v_saldo_antes,
         saldo_depois = (SELECT COALESCE(estoque_atual,0) FROM public.produtos WHERE id = a.produto_id)
   WHERE id = a.id;
END;
$function$;