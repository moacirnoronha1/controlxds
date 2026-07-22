
-- 1) Requisições: separar solicitada x liberada
ALTER TABLE public.requisicao_itens RENAME COLUMN quantidade TO quantidade_solicitada;
ALTER TABLE public.requisicao_itens ADD COLUMN quantidade_liberada numeric;

UPDATE public.requisicao_itens SET quantidade_liberada = quantidade_solicitada
  WHERE quantidade_liberada IS NULL AND EXISTS (
    SELECT 1 FROM public.requisicoes r WHERE r.id = requisicao_id AND r.status = 'liberada'
  );

-- 2) Nova função liberar_requisicao: aceita mapping de liberações e usa FEFO
DROP FUNCTION IF EXISTS public.liberar_requisicao(uuid, text);

CREATE OR REPLACE FUNCTION public.liberar_requisicao(
  _requisicao_id uuid,
  _responsavel text,
  _liberacoes jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status public.requisicao_status;
  v_numero integer;
  r RECORD;
  v_qtd numeric;
BEGIN
  SELECT status, numero INTO v_status, v_numero
    FROM public.requisicoes WHERE id = _requisicao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Requisição não está pendente'; END IF;

  -- Atualizar quantidade_liberada a partir do payload (item_id -> qtd)
  IF _liberacoes IS NOT NULL THEN
    UPDATE public.requisicao_itens ri
      SET quantidade_liberada = COALESCE((_liberacoes ->> ri.id::text)::numeric, ri.quantidade_solicitada)
      WHERE ri.requisicao_id = _requisicao_id;
  ELSE
    UPDATE public.requisicao_itens
      SET quantidade_liberada = COALESCE(quantidade_liberada, quantidade_solicitada)
      WHERE requisicao_id = _requisicao_id;
  END IF;

  FOR r IN
    SELECT produto_id, COALESCE(quantidade_liberada, 0) AS qtd
      FROM public.requisicao_itens
      WHERE requisicao_id = _requisicao_id
  LOOP
    v_qtd := r.qtd;
    IF v_qtd > 0 THEN
      PERFORM public.registrar_saida_fefo(
        r.produto_id, NULL, v_qtd, _responsavel,
        'Requisição #' || v_numero
      );
    END IF;
  END LOOP;

  UPDATE public.requisicoes
    SET status='liberada', liberada_em=now(), responsavel_liberacao=_responsavel
    WHERE id=_requisicao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) TO anon, authenticated, service_role;

-- 3) Empréstimos
DO $$ BEGIN
  CREATE TYPE public.emprestimo_tipo AS ENUM ('emprestamos', 'tomamos_emprestado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.emprestimo_status AS ENUM ('pendente', 'devolvido', 'atrasado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.emprestimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.emprestimo_tipo NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_nome text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  unidade_medida text,
  origem text,
  destino text,
  responsavel text,
  data_emprestimo date NOT NULL DEFAULT CURRENT_DATE,
  previsao_devolucao date,
  data_devolucao date,
  observacao text,
  status public.emprestimo_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emprestimos TO anon, authenticated;
GRANT ALL ON public.emprestimos TO service_role;

ALTER TABLE public.emprestimos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emprestimos_all" ON public.emprestimos;
CREATE POLICY "emprestimos_all" ON public.emprestimos FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_emprestimos_updated_at ON public.emprestimos;
CREATE TRIGGER trg_emprestimos_updated_at BEFORE UPDATE ON public.emprestimos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
