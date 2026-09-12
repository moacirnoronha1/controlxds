CREATE TABLE public.requisicao_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes(id) ON DELETE CASCADE,
  item_id uuid,
  acao text NOT NULL,
  produto_original_id uuid REFERENCES public.produtos(id),
  produto_novo_id uuid REFERENCES public.produtos(id),
  quantidade_original numeric,
  quantidade_nova numeric,
  observacao text NOT NULL,
  alterado_por text NOT NULL,
  cargo public.user_cargo NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.requisicao_alteracoes TO authenticated;
GRANT ALL ON public.requisicao_alteracoes TO service_role;
ALTER TABLE public.requisicao_alteracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisicao_alteracoes_app_user_select
ON public.requisicao_alteracoes FOR SELECT TO authenticated
USING (public.is_app_user());

CREATE INDEX requisicao_alteracoes_requisicao_created_idx
ON public.requisicao_alteracoes (requisicao_id, created_at DESC);

CREATE TABLE public.entrada_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  dados_antes jsonb NOT NULL,
  dados_depois jsonb NOT NULL,
  alterado_por text NOT NULL,
  cargo public.user_cargo NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.entrada_alteracoes TO authenticated;
GRANT ALL ON public.entrada_alteracoes TO service_role;
ALTER TABLE public.entrada_alteracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY entrada_alteracoes_app_user_select
ON public.entrada_alteracoes FOR SELECT TO authenticated
USING (public.is_app_user());

CREATE INDEX entrada_alteracoes_lote_created_idx
ON public.entrada_alteracoes (lote_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.editar_itens_requisicao(
  _requisicao_id uuid,
  _itens jsonb,
  _observacao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status public.requisicao_status;
  v_usuario record;
  v_item record;
  v_novo record;
  v_produto_original uuid;
  v_quantidade_original numeric;
  v_codigo text;
BEGIN
  SELECT u.nome, u.cargo INTO v_usuario
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario IS NULL OR v_usuario.cargo NOT IN ('mestre', 'lider', 'estoquista') THEN
    RAISE EXCEPTION 'Seu perfil não permite alterar itens da requisição';
  END IF;
  IF NULLIF(trim(_observacao), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a observação da alteração';
  END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'A requisição deve ter ao menos um item';
  END IF;

  SELECT status INTO v_status
  FROM public.requisicoes
  WHERE id = _requisicao_id
  FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente requisições pendentes podem ser alteradas';
  END IF;

  CREATE TEMP TABLE tmp_requisicao_itens (
    item_id uuid,
    produto_id uuid NOT NULL,
    quantidade numeric NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_requisicao_itens (item_id, produto_id, quantidade)
  SELECT
    CASE WHEN NULLIF(x->>'id', '') IS NULL THEN NULL ELSE (x->>'id')::uuid END,
    (x->>'produto_id')::uuid,
    round((x->>'quantidade')::numeric, 6)
  FROM jsonb_array_elements(_itens) x;

  IF EXISTS (SELECT 1 FROM tmp_requisicao_itens WHERE quantidade <= 0) THEN
    RAISE EXCEPTION 'Todas as quantidades devem ser maiores que zero';
  END IF;
  IF EXISTS (SELECT produto_id FROM tmp_requisicao_itens GROUP BY produto_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'O mesmo produto não pode aparecer duas vezes na requisição';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tmp_requisicao_itens t
    LEFT JOIN public.produtos p ON p.id = t.produto_id AND p.ativo = true
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Um dos produtos selecionados não está disponível';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tmp_requisicao_itens t
    WHERE t.item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.requisicao_itens ri
        WHERE ri.id = t.item_id AND ri.requisicao_id = _requisicao_id
      )
  ) THEN
    RAISE EXCEPTION 'Um dos itens não pertence a esta requisição';
  END IF;

  FOR v_item IN
    SELECT ri.* FROM public.requisicao_itens ri
    WHERE ri.requisicao_id = _requisicao_id
    FOR UPDATE
  LOOP
    SELECT * INTO v_novo FROM tmp_requisicao_itens WHERE item_id = v_item.id;
    IF NOT FOUND THEN
      INSERT INTO public.requisicao_alteracoes (
        requisicao_id, item_id, acao, produto_original_id,
        quantidade_original, observacao, alterado_por, cargo
      ) VALUES (
        _requisicao_id, v_item.id, 'exclusao', v_item.produto_id,
        v_item.quantidade_solicitada, trim(_observacao), v_usuario.nome, v_usuario.cargo
      );
      DELETE FROM public.requisicao_itens WHERE id = v_item.id;
    ELSE
      IF v_novo.produto_id <> v_item.produto_id THEN
        INSERT INTO public.requisicao_alteracoes (
          requisicao_id, item_id, acao, produto_original_id, produto_novo_id,
          quantidade_original, quantidade_nova, observacao, alterado_por, cargo
        ) VALUES (
          _requisicao_id, v_item.id, 'substituicao', v_item.produto_id, v_novo.produto_id,
          v_item.quantidade_solicitada, v_novo.quantidade, trim(_observacao), v_usuario.nome, v_usuario.cargo
        );
      ELSIF round(v_novo.quantidade, 6) <> round(v_item.quantidade_solicitada, 6) THEN
        INSERT INTO public.requisicao_alteracoes (
          requisicao_id, item_id, acao, produto_original_id, produto_novo_id,
          quantidade_original, quantidade_nova, observacao, alterado_por, cargo
        ) VALUES (
          _requisicao_id, v_item.id, 'quantidade', v_item.produto_id, v_novo.produto_id,
          v_item.quantidade_solicitada, v_novo.quantidade, trim(_observacao), v_usuario.nome, v_usuario.cargo
        );
      END IF;
      SELECT codigo_barras INTO v_codigo FROM public.produtos WHERE id = v_novo.produto_id;
      UPDATE public.requisicao_itens
      SET produto_id = v_novo.produto_id,
          codigo = v_codigo,
          quantidade_solicitada = v_novo.quantidade,
          quantidade_liberada = NULL
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  FOR v_novo IN SELECT * FROM tmp_requisicao_itens WHERE item_id IS NULL
  LOOP
    SELECT codigo_barras INTO v_codigo FROM public.produtos WHERE id = v_novo.produto_id;
    INSERT INTO public.requisicao_itens (
      requisicao_id, produto_id, codigo, quantidade_solicitada
    ) VALUES (
      _requisicao_id, v_novo.produto_id, v_codigo, v_novo.quantidade
    ) RETURNING id INTO v_produto_original;

    INSERT INTO public.requisicao_alteracoes (
      requisicao_id, item_id, acao, produto_novo_id,
      quantidade_nova, observacao, alterado_por, cargo
    ) VALUES (
      _requisicao_id, v_produto_original, 'inclusao', v_novo.produto_id,
      v_novo.quantidade, trim(_observacao), v_usuario.nome, v_usuario.cargo
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_itens_requisicao(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_itens_requisicao(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_itens_requisicao(uuid, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.editar_entrada_lote(
  _lote_id uuid,
  _quantidade numeric,
  _validade date,
  _custo_unitario numeric,
  _fornecedor text,
  _observacao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usuario record;
  v_lote public.lotes%ROWTYPE;
  v_delta numeric;
  v_consumido numeric;
  v_movimento_id uuid;
BEGIN
  SELECT u.nome, u.cargo INTO v_usuario
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario IS NULL OR v_usuario.cargo NOT IN ('mestre', 'lider', 'estoquista') THEN
    RAISE EXCEPTION 'Seu perfil não permite editar entradas';
  END IF;
  IF _quantidade IS NULL OR _quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero';
  END IF;
  IF _custo_unitario IS NOT NULL AND _custo_unitario < 0 THEN
    RAISE EXCEPTION 'O custo unitário não pode ser negativo';
  END IF;

  SELECT * INTO v_lote FROM public.lotes WHERE id = _lote_id FOR UPDATE;
  IF v_lote.id IS NULL THEN RAISE EXCEPTION 'Entrada não encontrada'; END IF;

  SELECT id INTO v_movimento_id
  FROM public.movimentacoes
  WHERE lote_id = _lote_id AND tipo = 'entrada'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  IF v_movimento_id IS NULL THEN
    RAISE EXCEPTION 'Movimento original da entrada não encontrado';
  END IF;

  v_consumido := v_lote.quantidade_inicial - v_lote.saldo;
  IF round(_quantidade, 6) < round(v_consumido, 6) THEN
    RAISE EXCEPTION 'A nova quantidade não pode ser menor que o total já utilizado (%)', v_consumido;
  END IF;

  v_delta := round(_quantidade - v_lote.quantidade_inicial, 6);

  INSERT INTO public.entrada_alteracoes (
    lote_id, dados_antes, dados_depois, alterado_por, cargo
  ) VALUES (
    _lote_id,
    jsonb_build_object(
      'quantidade', v_lote.quantidade_inicial,
      'validade', v_lote.validade,
      'custo_unitario', v_lote.custo_unitario,
      'fornecedor', v_lote.fornecedor,
      'observacao', v_lote.observacao
    ),
    jsonb_build_object(
      'quantidade', _quantidade,
      'validade', _validade,
      'custo_unitario', _custo_unitario,
      'fornecedor', NULLIF(trim(_fornecedor), ''),
      'observacao', NULLIF(trim(_observacao), '')
    ),
    v_usuario.nome,
    v_usuario.cargo
  );

  UPDATE public.lotes
  SET quantidade_inicial = _quantidade,
      saldo = saldo + v_delta,
      validade = _validade,
      custo_unitario = _custo_unitario,
      fornecedor = NULLIF(trim(_fornecedor), ''),
      observacao = NULLIF(trim(_observacao), ''),
      updated_at = now()
  WHERE id = _lote_id;

  UPDATE public.movimentacoes
  SET quantidade = _quantidade,
      fornecedor = NULLIF(trim(_fornecedor), ''),
      observacao = NULLIF(trim(_observacao), '')
  WHERE id = v_movimento_id;

  IF v_delta > 0 THEN
    UPDATE public.produtos
    SET estoque_atual = estoque_atual + v_delta, updated_at = now()
    WHERE id = v_lote.produto_id;
  ELSIF v_delta < 0 THEN
    UPDATE public.produtos
    SET estoque_atual = estoque_atual + v_delta, updated_at = now()
    WHERE id = v_lote.produto_id AND estoque_atual + v_delta >= 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'A correção deixaria o estoque do produto negativo'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_entrada_lote(uuid, numeric, date, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_entrada_lote(uuid, numeric, date, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_entrada_lote(uuid, numeric, date, numeric, text, text) TO service_role;