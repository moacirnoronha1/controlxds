ALTER TABLE public.emprestimos
  ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES public.locais_estoque(id),
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id);

ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_tipo_check;
ALTER TABLE public.movimentacoes ADD CONSTRAINT movimentacoes_tipo_check
  CHECK (tipo = ANY (ARRAY['entrada','saida','ajuste_entrada','ajuste_saida','emprestimo_entrada','emprestimo_saida']));

CREATE OR REPLACE FUNCTION public.aplicar_movimentacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  estoque_novo NUMERIC;
  v_positivo BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_positivo := NEW.tipo IN ('entrada','ajuste_entrada','emprestimo_entrada');
    IF v_positivo THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + NEW.quantidade, updated_at = now()
        WHERE id = NEW.produto_id;
    ELSE
      SELECT estoque_atual - NEW.quantidade INTO estoque_novo
        FROM public.produtos WHERE id = NEW.produto_id;
      IF estoque_novo < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %',
          estoque_novo + NEW.quantidade, NEW.quantidade;
      END IF;
      UPDATE public.produtos
        SET estoque_atual = estoque_novo, updated_at = now()
        WHERE id = NEW.produto_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.tipo IN ('entrada','ajuste_entrada','emprestimo_entrada') THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual - OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    ELSE
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Baixa quantidade dos lotes (lote específico ou FEFO no local) e registra movimentação
CREATE OR REPLACE FUNCTION public.emprestimo_baixar(_produto_id uuid, _local_id uuid, _lote_id uuid, _quantidade numeric, _responsavel text, _observacao text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restante numeric := _quantidade;
  v_disp numeric;
  v_consumir numeric;
  l RECORD;
BEGIN
  IF _lote_id IS NOT NULL THEN
    SELECT saldo INTO v_disp FROM public.lotes WHERE id = _lote_id FOR UPDATE;
    IF v_disp IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
    IF v_disp < _quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_disp, _quantidade;
    END IF;
    UPDATE public.lotes SET saldo = saldo - _quantidade, updated_at = now() WHERE id = _lote_id;
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (_produto_id, 'emprestimo_saida', _quantidade, _observacao, NULLIF(_responsavel,''), _lote_id,
            COALESCE(_local_id, (SELECT local_id FROM public.lotes WHERE id = _lote_id)));
    RETURN;
  END IF;

  SELECT COALESCE(SUM(saldo),0) INTO v_disp FROM public.lotes
   WHERE produto_id = _produto_id AND saldo > 0 AND (_local_id IS NULL OR local_id = _local_id);
  IF v_disp < _quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %', v_disp, _quantidade;
  END IF;

  FOR l IN
    SELECT id, saldo::numeric AS saldo, local_id FROM public.lotes
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
END;
$function$;

-- Cria lote e registra entrada por empréstimo/devolução
CREATE OR REPLACE FUNCTION public.emprestimo_entrar(_produto_id uuid, _local_id uuid, _quantidade numeric, _responsavel text, _observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_local uuid := _local_id; v_lote uuid;
BEGIN
  IF v_local IS NULL THEN
    SELECT local_padrao_id INTO v_local FROM public.produtos WHERE id = _produto_id;
  END IF;
  IF v_local IS NULL THEN
    SELECT id INTO v_local FROM public.locais_estoque WHERE ativo = true ORDER BY created_at LIMIT 1;
  END IF;
  IF v_local IS NULL THEN RAISE EXCEPTION 'Nenhum local de estoque disponível'; END IF;

  INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
  VALUES (_produto_id, v_local, _quantidade, _quantidade, _observacao)
  RETURNING id INTO v_lote;

  INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
  VALUES (_produto_id, 'emprestimo_entrada', _quantidade, _observacao, NULLIF(_responsavel,''), v_lote, v_local);

  RETURN v_lote;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_emprestimo(
  _tipo emprestimo_tipo, _produto_id uuid, _produto_nome text, _quantidade numeric,
  _unidade_medida text, _local_id uuid, _lote_id uuid, _origem text, _destino text,
  _responsavel text, _data_emprestimo date, _previsao_devolucao date, _observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_lote uuid := _lote_id; v_local uuid := _local_id;
BEGIN
  IF _quantidade IS NULL OR _quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _produto_id IS NULL THEN RAISE EXCEPTION 'Selecione o produto do catálogo'; END IF;
  IF NULLIF(btrim(COALESCE(_responsavel,'')),'') IS NULL THEN RAISE EXCEPTION 'Responsável obrigatório'; END IF;
  IF _previsao_devolucao IS NULL THEN RAISE EXCEPTION 'Previsão de devolução obrigatória'; END IF;
  IF v_local IS NULL AND v_lote IS NOT NULL THEN
    SELECT local_id INTO v_local FROM public.lotes WHERE id = v_lote;
  END IF;
  IF v_local IS NULL THEN RAISE EXCEPTION 'Local de estoque obrigatório'; END IF;

  IF _tipo = 'emprestamos' THEN
    PERFORM public.emprestimo_baixar(_produto_id, v_local, v_lote, _quantidade, _responsavel,
      'Empréstimo concedido' || COALESCE(' - ' || NULLIF(_destino,''), ''));
  ELSE
    v_lote := public.emprestimo_entrar(_produto_id, v_local, _quantidade, _responsavel,
      'Empréstimo recebido' || COALESCE(' - ' || NULLIF(_origem,''), ''));
  END IF;

  INSERT INTO public.emprestimos (
    tipo, produto_id, produto_nome, quantidade, unidade_medida, origem, destino,
    responsavel, data_emprestimo, previsao_devolucao, observacao, local_id, lote_id, status)
  VALUES (_tipo, _produto_id, _produto_nome, _quantidade, NULLIF(_unidade_medida,''),
          NULLIF(_origem,''), NULLIF(_destino,''), _responsavel, _data_emprestimo,
          _previsao_devolucao, NULLIF(_observacao,''), v_local, v_lote, 'pendente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.devolver_emprestimo(_id uuid, _data date, _responsavel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e public.emprestimos%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.emprestimos WHERE id = _id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado'; END IF;
  IF e.status = 'devolvido' THEN RAISE EXCEPTION 'Empréstimo já devolvido'; END IF;

  IF e.produto_id IS NOT NULL THEN
    IF e.tipo = 'emprestamos' THEN
      PERFORM public.emprestimo_entrar(e.produto_id, e.local_id, e.quantidade, _responsavel,
        'Devolução de empréstimo');
    ELSE
      PERFORM public.emprestimo_baixar(e.produto_id, e.local_id, e.lote_id, e.quantidade, _responsavel,
        'Devolução de empréstimo');
    END IF;
  END IF;

  UPDATE public.emprestimos
     SET status = 'devolvido', data_devolucao = COALESCE(_data, CURRENT_DATE), updated_at = now()
   WHERE id = _id;
END;
$function$;