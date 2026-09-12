CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.registrar_avaria_pos_chegada_core(
  _data date,
  _produto_id uuid,
  _local_id uuid,
  _lote_id uuid,
  _tipo public.avaria_tipo,
  _quantidade numeric,
  _motivo text,
  _valor_estimado numeric,
  _observacao text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_usuario public.usuarios%ROWTYPE;
  v_produto public.produtos%ROWTYPE;
  v_lote public.lotes%ROWTYPE;
  v_lote_id uuid;
  v_saldo_lotes numeric;
  v_saldo_sem_lote numeric;
  v_avaria_id uuid;
BEGIN
  SELECT * INTO v_usuario
  FROM public.usuarios
  WHERE auth_user_id = auth.uid() AND ativo = true;

  IF v_usuario.id IS NULL OR v_usuario.cargo NOT IN ('mestre', 'lider', 'estoquista') THEN
    RAISE EXCEPTION 'Você não tem permissão para registrar esta avaria';
  END IF;
  IF _produto_id IS NULL THEN RAISE EXCEPTION 'Selecione o produto'; END IF;
  IF _local_id IS NULL THEN RAISE EXCEPTION 'Selecione o local de estoque'; END IF;
  IF COALESCE(_quantidade, 0) <= 0 THEN RAISE EXCEPTION 'Informe uma quantidade maior que zero'; END IF;

  SELECT * INTO v_produto
  FROM public.produtos
  WHERE id = _produto_id AND ativo = true
  FOR UPDATE;
  IF v_produto.id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado ou inativo'; END IF;

  PERFORM id FROM public.lotes WHERE produto_id = _produto_id FOR UPDATE;

  IF _lote_id IS NOT NULL THEN
    SELECT * INTO v_lote FROM public.lotes WHERE id = _lote_id FOR UPDATE;
    IF v_lote.id IS NULL OR v_lote.produto_id <> _produto_id THEN
      RAISE EXCEPTION 'O lote selecionado não pertence ao produto';
    END IF;
    IF v_lote.local_id <> _local_id THEN
      RAISE EXCEPTION 'O lote selecionado não pertence ao local informado';
    END IF;
    IF round(COALESCE(v_lote.saldo, 0), 6) < round(_quantidade, 6) THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_lote.saldo, _quantidade;
    END IF;
    v_lote_id := v_lote.id;
  ELSE
    SELECT COALESCE(sum(GREATEST(saldo, 0)), 0)
      INTO v_saldo_lotes FROM public.lotes WHERE produto_id = _produto_id;
    v_saldo_sem_lote := GREATEST(COALESCE(v_produto.estoque_atual, 0) - v_saldo_lotes, 0);
    IF round(v_saldo_sem_lote, 6) < round(_quantidade, 6) THEN
      RAISE EXCEPTION 'Saldo sem lote insuficiente. Disponível: %, solicitado: %', v_saldo_sem_lote, _quantidade;
    END IF;
    INSERT INTO public.lotes (
      produto_id, local_id, validade, custo_unitario,
      quantidade_inicial, saldo, fornecedor, observacao
    ) VALUES (
      _produto_id, _local_id, NULL, NULL,
      v_saldo_sem_lote, v_saldo_sem_lote, NULL,
      'LOTE PADRÃO CRIADO PARA REGULARIZAR ESTOQUE SEM LOTE'
    ) RETURNING id INTO v_lote_id;
  END IF;

  INSERT INTO public.avarias (
    data, produto_id, local_id, lote_id, momento, tipo, motivo,
    quantidade, valor_estimado, responsavel, observacao
  ) VALUES (
    COALESCE(_data, CURRENT_DATE), _produto_id, _local_id, v_lote_id,
    'depois_chegada', _tipo, NULLIF(trim(_motivo), ''),
    _quantidade, _valor_estimado, v_usuario.nome, NULLIF(trim(_observacao), '')
  ) RETURNING id INTO v_avaria_id;

  RETURN v_avaria_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.registrar_avaria_pos_chegada_core(date, uuid, uuid, uuid, public.avaria_tipo, numeric, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.registrar_avaria_pos_chegada_core(date, uuid, uuid, uuid, public.avaria_tipo, numeric, text, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_avaria_pos_chegada(
  _data date,
  _produto_id uuid,
  _local_id uuid,
  _lote_id uuid,
  _tipo public.avaria_tipo,
  _quantidade numeric,
  _motivo text,
  _valor_estimado numeric,
  _observacao text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.registrar_avaria_pos_chegada_core(
    _data, _produto_id, _local_id, _lote_id, _tipo,
    _quantidade, _motivo, _valor_estimado, _observacao
  );
$function$;

REVOKE ALL ON FUNCTION public.registrar_avaria_pos_chegada(date, uuid, uuid, uuid, public.avaria_tipo, numeric, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_avaria_pos_chegada(date, uuid, uuid, uuid, public.avaria_tipo, numeric, text, numeric, text) TO authenticated, service_role;