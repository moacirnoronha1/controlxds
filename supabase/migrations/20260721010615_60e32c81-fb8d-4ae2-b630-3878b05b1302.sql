
-- ============ ZERAR DADOS DE MOVIMENTAÇÃO ============
DELETE FROM public.inventario_itens;
DELETE FROM public.inventarios;
DELETE FROM public.movimentacoes;
UPDATE public.produtos SET estoque_atual = 0, estoque_inicial = 0;

-- ============ CATEGORIAS ============
UPDATE public.produtos SET categoria = 'Bebida não alcoólica' WHERE categoria = 'Bebidas';
UPDATE public.produtos SET categoria = 'Outros' WHERE categoria IN ('Frios', 'Cozinha');

-- ============ LOCAIS DE ESTOQUE ============
CREATE TABLE public.locais_estoque (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_estoque TO anon, authenticated;
GRANT ALL ON public.locais_estoque TO service_role;
ALTER TABLE public.locais_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.locais_estoque FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_locais_updated_at BEFORE UPDATE ON public.locais_estoque
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.locais_estoque (nome) VALUES
  ('Estoque Principal'),
  ('Estoque de Bebidas'),
  ('Escritório Xica'),
  ('Casa');

-- ============ PRODUTOS: local padrão ============
ALTER TABLE public.produtos
  ADD COLUMN local_padrao_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL;

-- default: Estoque Principal
UPDATE public.produtos
  SET local_padrao_id = (SELECT id FROM public.locais_estoque WHERE nome = 'Estoque Principal');

-- ============ LOTES ============
CREATE TABLE public.lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  validade date,
  custo_unitario numeric,
  quantidade_inicial numeric NOT NULL CHECK (quantidade_inicial > 0),
  saldo numeric NOT NULL CHECK (saldo >= 0),
  fornecedor text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lotes_produto ON public.lotes(produto_id);
CREATE INDEX idx_lotes_fefo ON public.lotes(produto_id, local_id, validade NULLS LAST) WHERE saldo > 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO anon, authenticated;
GRANT ALL ON public.lotes TO service_role;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.lotes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_lotes_updated_at BEFORE UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MOVIMENTACOES: rastreio de lote/local ============
ALTER TABLE public.movimentacoes
  ADD COLUMN lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL,
  ADD COLUMN local_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL;

-- ============ RPC: criar entrada como lote ============
CREATE OR REPLACE FUNCTION public.criar_entrada_lote(
  _produto_id uuid,
  _local_id uuid,
  _quantidade numeric,
  _validade date,
  _custo_unitario numeric,
  _fornecedor text,
  _observacao text,
  _responsavel text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id uuid;
BEGIN
  IF _quantidade IS NULL OR _quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF _local_id IS NULL THEN
    RAISE EXCEPTION 'Local de estoque é obrigatório';
  END IF;

  INSERT INTO public.lotes (produto_id, local_id, validade, custo_unitario, quantidade_inicial, saldo, fornecedor, observacao)
  VALUES (_produto_id, _local_id, _validade, _custo_unitario, _quantidade, _quantidade, NULLIF(_fornecedor, ''), NULLIF(_observacao, ''))
  RETURNING id INTO v_lote_id;

  INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, fornecedor, lote_id, local_id)
  VALUES (_produto_id, 'entrada', _quantidade, NULLIF(_observacao, ''), NULLIF(_responsavel, ''), NULLIF(_fornecedor, ''), v_lote_id, _local_id);

  RETURN v_lote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_entrada_lote(uuid,uuid,numeric,date,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_entrada_lote(uuid,uuid,numeric,date,numeric,text,text,text) TO anon, authenticated;

-- ============ RPC: saída FEFO ============
CREATE OR REPLACE FUNCTION public.registrar_saida_fefo(
  _produto_id uuid,
  _local_id uuid,
  _quantidade numeric,
  _responsavel text,
  _observacao text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante numeric := _quantidade;
  v_disponivel numeric;
  r RECORD;
  v_consumir numeric;
BEGIN
  IF _quantidade IS NULL OR _quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT COALESCE(SUM(saldo), 0) INTO v_disponivel
  FROM public.lotes
  WHERE produto_id = _produto_id
    AND (_local_id IS NULL OR local_id = _local_id)
    AND saldo > 0;

  IF v_disponivel < _quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %', v_disponivel, _quantidade;
  END IF;

  FOR r IN
    SELECT id, saldo FROM public.lotes
    WHERE produto_id = _produto_id
      AND (_local_id IS NULL OR local_id = _local_id)
      AND saldo > 0
    ORDER BY validade NULLS LAST, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;
    v_consumir := LEAST(r.saldo, v_restante);
    UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = r.id;
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (_produto_id, 'saida', v_consumir, NULLIF(_observacao, ''), NULLIF(_responsavel, ''), r.id, _local_id);
    v_restante := v_restante - v_consumir;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_saida_fefo(uuid,uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_saida_fefo(uuid,uuid,numeric,text,text) TO anon, authenticated;
