
-- Setores
CREATE TABLE public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO anon, authenticated;
GRANT ALL ON public.setores TO service_role;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.setores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Responsáveis pela liberação
CREATE TABLE public.responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cargo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO anon, authenticated;
GRANT ALL ON public.responsaveis TO service_role;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.responsaveis FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Sequence para número da requisição
CREATE SEQUENCE public.requisicao_numero_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.requisicao_numero_seq TO anon, authenticated, service_role;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.requisicao_status AS ENUM ('pendente','liberada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Requisições
CREATE TABLE public.requisicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('public.requisicao_numero_seq'),
  data timestamptz NOT NULL DEFAULT now(),
  requisitante text NOT NULL,
  setor text NOT NULL,
  responsavel_liberacao text,
  status public.requisicao_status NOT NULL DEFAULT 'pendente',
  observacao text,
  liberada_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes TO anon, authenticated;
GRANT ALL ON public.requisicoes TO service_role;
ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.requisicoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_requisicoes_updated BEFORE UPDATE ON public.requisicoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Itens da requisição
CREATE TABLE public.requisicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  codigo text,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_itens TO anon, authenticated;
GRANT ALL ON public.requisicao_itens TO service_role;
ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open all" ON public.requisicao_itens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_req_itens_req ON public.requisicao_itens(requisicao_id);

-- Função: liberar requisição (baixa estoque)
CREATE OR REPLACE FUNCTION public.liberar_requisicao(_requisicao_id uuid, _responsavel text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.requisicao_status;
  v_numero integer;
  r RECORD;
BEGIN
  SELECT status, numero INTO v_status, v_numero
    FROM public.requisicoes WHERE id = _requisicao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Requisição não está pendente'; END IF;

  FOR r IN
    SELECT produto_id, quantidade FROM public.requisicao_itens
    WHERE requisicao_id = _requisicao_id
  LOOP
    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel)
    VALUES (r.produto_id, 'saida', r.quantidade,
            'Requisição #' || v_numero, _responsavel);
  END LOOP;

  UPDATE public.requisicoes
    SET status='liberada', liberada_em=now(), responsavel_liberacao=_responsavel
    WHERE id=_requisicao_id;
END;
$$;

-- Função: cancelar requisição
CREATE OR REPLACE FUNCTION public.cancelar_requisicao(_requisicao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status public.requisicao_status;
BEGIN
  SELECT status INTO v_status FROM public.requisicoes WHERE id=_requisicao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  IF v_status = 'liberada' THEN RAISE EXCEPTION 'Requisição já liberada não pode ser cancelada'; END IF;
  UPDATE public.requisicoes SET status='cancelada', cancelada_em=now() WHERE id=_requisicao_id;
END;
$$;
