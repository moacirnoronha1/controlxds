
-- Enum de status e tipo
CREATE TYPE public.inventario_status AS ENUM ('aberto', 'em_conferencia', 'fechado');
CREATE TYPE public.inventario_tipo AS ENUM ('rapido', 'parcial', 'completo');

-- Tabela de inventários
CREATE TABLE public.inventarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referencia DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  tipo public.inventario_tipo NOT NULL DEFAULT 'completo',
  status public.inventario_status NOT NULL DEFAULT 'aberto',
  titulo TEXT,
  observacao TEXT,
  criado_por UUID,
  fechado_por UUID,
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventarios_referencia ON public.inventarios(referencia DESC);
CREATE INDEX idx_inventarios_status ON public.inventarios(status);

-- Itens do inventário
CREATE TABLE public.inventario_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventario_id UUID NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  estoque_sistema NUMERIC NOT NULL DEFAULT 0,
  contagem_fisica NUMERIC,
  diferenca NUMERIC GENERATED ALWAYS AS (COALESCE(contagem_fisica, 0) - estoque_sistema) STORED,
  observacao TEXT,
  contado_por UUID,
  contado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(inventario_id, produto_id)
);

CREATE INDEX idx_inventario_itens_inv ON public.inventario_itens(inventario_id);

-- Triggers de updated_at
CREATE TRIGGER trg_inventarios_updated
  BEFORE UPDATE ON public.inventarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_inventario_itens_updated
  BEFORE UPDATE ON public.inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_itens ENABLE ROW LEVEL SECURITY;

-- Inventarios policies
CREATE POLICY "auth read inventarios" ON public.inventarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin/estoquista create inventarios" ON public.inventarios
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'estoquista'));

CREATE POLICY "update inventarios when not fechado" ON public.inventarios
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'estoquista'))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR (
      has_role(auth.uid(), 'estoquista') AND status <> 'fechado'
    )
  );

CREATE POLICY "admin delete inventarios" ON public.inventarios
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Itens policies
CREATE POLICY "auth read inv itens" ON public.inventario_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin/estoquista insert inv itens" ON public.inventario_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'estoquista'))
    AND EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = inventario_id AND i.status <> 'fechado')
  );

CREATE POLICY "admin/estoquista update inv itens" ON public.inventario_itens
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'estoquista'))
    AND EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = inventario_id AND i.status <> 'fechado')
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'estoquista'))
    AND EXISTS (SELECT 1 FROM public.inventarios i WHERE i.id = inventario_id AND i.status <> 'fechado')
  );

CREATE POLICY "admin delete inv itens" ON public.inventario_itens
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Função para fechar inventário e gerar ajustes automáticos
CREATE OR REPLACE FUNCTION public.fechar_inventario(_inventario_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.inventario_status;
  v_uid UUID := auth.uid();
  r RECORD;
BEGIN
  IF NOT has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem fechar inventários';
  END IF;

  SELECT status INTO v_status FROM public.inventarios WHERE id = _inventario_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Inventário não encontrado';
  END IF;
  IF v_status = 'fechado' THEN
    RAISE EXCEPTION 'Inventário já está fechado';
  END IF;

  -- Gera movimentação de ajuste para cada item com diferença
  FOR r IN
    SELECT produto_id, diferenca
    FROM public.inventario_itens
    WHERE inventario_id = _inventario_id
      AND contagem_fisica IS NOT NULL
      AND diferenca <> 0
  LOOP
    IF r.diferenca > 0 THEN
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel)
      VALUES (r.produto_id, 'entrada', r.diferenca, 'Ajuste de inventário ' || _inventario_id::text, v_uid::text);
    ELSE
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel)
      VALUES (r.produto_id, 'saida', abs(r.diferenca), 'Ajuste de inventário ' || _inventario_id::text, v_uid::text);
    END IF;
  END LOOP;

  UPDATE public.inventarios
    SET status = 'fechado',
        fechado_por = v_uid,
        fechado_em = now()
    WHERE id = _inventario_id;
END;
$$;

-- Função para criar inventário completo com snapshot atual
CREATE OR REPLACE FUNCTION public.criar_inventario(
  _tipo public.inventario_tipo,
  _titulo TEXT,
  _produto_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF NOT (has_role(v_uid, 'admin') OR has_role(v_uid, 'estoquista')) THEN
    RAISE EXCEPTION 'Sem permissão para criar inventário';
  END IF;

  INSERT INTO public.inventarios (tipo, titulo, criado_por, status)
  VALUES (_tipo, _titulo, v_uid, 'em_conferencia')
  RETURNING id INTO v_id;

  IF _tipo = 'parcial' AND _produto_ids IS NOT NULL THEN
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual
    FROM public.produtos p
    WHERE p.ativo = true AND p.id = ANY(_produto_ids);
  ELSE
    INSERT INTO public.inventario_itens (inventario_id, produto_id, estoque_sistema)
    SELECT v_id, p.id, p.estoque_atual
    FROM public.produtos p
    WHERE p.ativo = true;
  END IF;

  RETURN v_id;
END;
$$;
