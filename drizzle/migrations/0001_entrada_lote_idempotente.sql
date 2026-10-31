ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS chave_idempotencia uuid;
CREATE UNIQUE INDEX IF NOT EXISTS lotes_chave_idempotencia_unique
  ON public.lotes (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
COMMENT ON COLUMN public.lotes.chave_idempotencia IS 'Chave enviada pela tela de entrada para evitar lote duplicado ao tentar novamente.';

DROP FUNCTION IF EXISTS public.criar_entrada_lote(uuid, uuid, numeric, date, numeric, text, text, text);

CREATE FUNCTION public.criar_entrada_lote(
  _produto_id uuid, _local_id uuid, _quantidade numeric, _validade date,
  _custo_unitario numeric, _fornecedor text, _observacao text, _responsavel text,
  _chave_idempotencia uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lote_id uuid;
BEGIN
  IF _produto_id IS NULL THEN
    RAISE EXCEPTION 'Produto é obrigatório';
  END IF;
  IF _quantidade IS NULL OR _quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF _local_id IS NULL THEN
    RAISE EXCEPTION 'Local de estoque é obrigatório';
  END IF;
  IF _custo_unitario IS NOT NULL AND _custo_unitario < 0 THEN
    RAISE EXCEPTION 'Custo unitário inválido';
  END IF;

  IF _chave_idempotencia IS NOT NULL THEN
    -- Serializa tentativas repetidas da mesma entrada (clique duplo / nova tentativa)
    PERFORM pg_advisory_xact_lock(hashtextextended(_chave_idempotencia::text, 0));
    SELECT id INTO v_lote_id FROM public.lotes WHERE chave_idempotencia = _chave_idempotencia;
    IF v_lote_id IS NOT NULL THEN
      RETURN v_lote_id; -- já registrada: não duplica
    END IF;
  END IF;

  INSERT INTO public.lotes (produto_id, local_id, validade, custo_unitario, quantidade_inicial, saldo, fornecedor, observacao, chave_idempotencia)
  VALUES (_produto_id, _local_id, _validade, _custo_unitario, _quantidade, _quantidade, NULLIF(_fornecedor, ''), NULLIF(_observacao, ''), _chave_idempotencia)
  RETURNING id INTO v_lote_id;

  INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, fornecedor, lote_id, local_id)
  VALUES (_produto_id, 'entrada', _quantidade, NULLIF(_observacao, ''), NULLIF(_responsavel, ''), NULLIF(_fornecedor, ''), v_lote_id, _local_id);

  RETURN v_lote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_entrada_lote(uuid, uuid, numeric, date, numeric, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_entrada_lote(uuid, uuid, numeric, date, numeric, text, text, text, uuid) TO authenticated, service_role;