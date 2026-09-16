-- Correção das funções de empréstimo para lidar com saldo sem lote e regras transacionais seguras

-- 1. emprestimo_baixar: Suporta saldo sem lote e FEFO com fallback
CREATE OR REPLACE FUNCTION public.emprestimo_baixar(_produto_id uuid, _local_id uuid, _lote_id uuid, _quantidade numeric, _responsavel text, _observacao text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restante numeric := _quantidade;
  v_disp_lote numeric;
  v_disp_total numeric;
  v_consumir numeric;
  l RECORD;
BEGIN
  -- Bloqueia o produto para evitar condições de corrida no estoque global
  SELECT estoque_atual INTO v_disp_total FROM public.produtos WHERE id = _produto_id FOR UPDATE;
  
  IF v_disp_total IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF v_disp_total < _quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente no catálogo. Disponível: %, solicitado: %', v_disp_total, _quantidade;
  END IF;

  -- CASO 1: Seleção explícita de lote
  IF _lote_id IS NOT NULL THEN
    SELECT saldo INTO v_disp_lote FROM public.lotes WHERE id = _lote_id FOR UPDATE;
    IF v_disp_lote IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
    IF v_disp_lote < _quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote selecionado. Disponível: %, solicitado: %', v_disp_lote, _quantidade;
    END IF;

    UPDATE public.lotes SET saldo = saldo - _quantidade, updated_at = now() WHERE id = _lote_id;
    
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (_produto_id, 'emprestimo_saida', _quantidade, _observacao, NULLIF(_responsavel,''), _lote_id, 
            COALESCE(_local_id, (SELECT local_id FROM public.lotes WHERE id = _lote_id)));
    RETURN;
  END IF;

  -- CASO 2: Seleção automática (FEFO) ou local específico
  -- Primeiro consome dos lotes existentes no local (ou em qualquer local se _local_id for null)
  FOR l IN
    SELECT id, saldo, local_id FROM public.lotes
     WHERE produto_id = _produto_id AND saldo > 0 AND (_local_id IS NULL OR local_id = _local_id)
     ORDER BY validade NULLS LAST, created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;
    v_consumir := LEAST(l.saldo, v_restante);
    UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
    
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (_produto_id, 'emprestimo_saida', v_consumir, _observacao, NULLIF(_responsavel,''), l.id, l.local_id);
    
    v_restante := v_restante - v_consumir;
  END LOOP;

  -- Se ainda restar quantidade e houver estoque global (saldo sem lote), consome sem vincular a lote
  IF v_restante > 0 THEN
    -- Inserir movimentação sem lote_id. O trigger aplicar_movimentacao() reduzirá o estoque_atual do produto.
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (_produto_id, 'emprestimo_saida', v_restante, 
            _observacao || ' (Dedução de saldo sem lote)', 
            NULLIF(_responsavel,''), NULL, _local_id);
    v_restante := 0;
  END IF;
END;
$function$;

-- 2. emprestimo_entrar: Mantido (já cria lotes corretamente)
-- 3. registrar_emprestimo: Mantido (utiliza a nova lógica do emprestimo_baixar)

-- 4. devolver_emprestimo: Ajustado para ser resiliente se o lote original foi consumido
CREATE OR REPLACE FUNCTION public.devolver_emprestimo(_id uuid, _data date, _responsavel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e public.emprestimos%ROWTYPE;
  v_lote_disponivel numeric := 0;
BEGIN
  SELECT * INTO e FROM public.emprestimos WHERE id = _id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado'; END IF;
  IF e.status = 'devolvido' THEN RAISE EXCEPTION 'Empréstimo já devolvido'; END IF;

  IF e.produto_id IS NOT NULL THEN
    IF e.tipo = 'emprestamos' THEN
      -- Devolução de empréstimo concedido: o item volta para nós (entrada)
      PERFORM public.emprestimo_entrar(e.produto_id, e.local_id, e.quantidade, _responsavel,
        'Devolução de empréstimo concedido');
    ELSE
      -- Devolução de empréstimo recebido: o item sai de nós (saída)
      -- Tenta usar o lote original se ainda houver saldo, senão usa FEFO/Saldo sem lote
      IF e.lote_id IS NOT NULL THEN
        SELECT saldo INTO v_lote_disponivel FROM public.lotes WHERE id = e.lote_id FOR UPDATE;
      END IF;

      IF COALESCE(v_lote_disponivel, 0) >= e.quantidade THEN
        PERFORM public.emprestimo_baixar(e.produto_id, e.local_id, e.lote_id, e.quantidade, _responsavel,
          'Devolução de empréstimo recebido');
      ELSE
        PERFORM public.emprestimo_baixar(e.produto_id, e.local_id, NULL, e.quantidade, _responsavel,
          'Devolução de empréstimo recebido (Lote original insuficiente/indisponível)');
      END IF;
    END IF;
  END IF;

  UPDATE public.emprestimos
     SET status = 'devolvido', 
         data_devolucao = COALESCE(_data, CURRENT_DATE), 
         updated_at = now()
   WHERE id = _id;
END;
$function$;
