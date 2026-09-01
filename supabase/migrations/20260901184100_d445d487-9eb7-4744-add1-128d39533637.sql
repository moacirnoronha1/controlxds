CREATE TYPE public.produto_solicitacao_tipo AS ENUM ('inclusao','edicao','exclusao');
CREATE TYPE public.produto_solicitacao_status AS ENUM ('pendente','aprovado','recusado');

CREATE TABLE public.produto_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.produto_solicitacao_tipo NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  dados_antes jsonb,
  dados_propostos jsonb,
  motivo text,
  solicitado_por text,
  status public.produto_solicitacao_status NOT NULL DEFAULT 'pendente',
  decidido_por text,
  decisao_motivo text,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_solicitacoes TO authenticated;
GRANT ALL ON public.produto_solicitacoes TO service_role;

ALTER TABLE public.produto_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY produto_solicitacoes_app_user_all ON public.produto_solicitacoes
  FOR ALL TO authenticated USING (public.is_app_user()) WITH CHECK (public.is_app_user());

CREATE TRIGGER trg_produto_solicitacoes_updated_at
  BEFORE UPDATE ON public.produto_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.aprovar_produto_solicitacao(_solicitacao_id uuid, _responsavel text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.produto_solicitacoes%ROWTYPE;
  d jsonb;
BEGIN
  SELECT * INTO s FROM public.produto_solicitacoes WHERE id = _solicitacao_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF s.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já foi decidida'; END IF;

  d := COALESCE(s.dados_propostos, '{}'::jsonb);

  IF s.tipo = 'inclusao' THEN
    INSERT INTO public.produtos (
      nome, categoria, unidade_medida, estoque_minimo, dias_seguranca,
      codigo_barras, codigo_caixa, unidades_por_caixa, local_padrao_id, ativo
    ) VALUES (
      upper(COALESCE(d->>'nome', s.produto_nome)),
      upper(COALESCE(d->>'categoria', 'SECOS')),
      COALESCE(d->>'unidade_medida', 'un'),
      COALESCE((d->>'estoque_minimo')::numeric, 0),
      COALESCE((d->>'dias_seguranca')::integer, 0),
      NULLIF(d->>'codigo_barras',''),
      NULLIF(d->>'codigo_caixa',''),
      COALESCE((d->>'unidades_por_caixa')::numeric, 1),
      NULLIF(d->>'local_padrao_id','')::uuid,
      COALESCE((d->>'ativo')::boolean, true)
    );

  ELSIF s.tipo = 'edicao' THEN
    IF s.produto_id IS NULL THEN RAISE EXCEPTION 'Produto não informado'; END IF;
    UPDATE public.produtos p SET
      nome = upper(COALESCE(d->>'nome', p.nome)),
      categoria = upper(COALESCE(d->>'categoria', p.categoria)),
      unidade_medida = COALESCE(d->>'unidade_medida', p.unidade_medida),
      estoque_minimo = COALESCE((d->>'estoque_minimo')::numeric, p.estoque_minimo),
      dias_seguranca = COALESCE((d->>'dias_seguranca')::integer, p.dias_seguranca),
      codigo_barras = CASE WHEN d ? 'codigo_barras' THEN NULLIF(d->>'codigo_barras','') ELSE p.codigo_barras END,
      codigo_caixa = CASE WHEN d ? 'codigo_caixa' THEN NULLIF(d->>'codigo_caixa','') ELSE p.codigo_caixa END,
      unidades_por_caixa = COALESCE((d->>'unidades_por_caixa')::numeric, p.unidades_por_caixa),
      local_padrao_id = CASE WHEN d ? 'local_padrao_id' THEN NULLIF(d->>'local_padrao_id','')::uuid ELSE p.local_padrao_id END,
      ativo = COALESCE((d->>'ativo')::boolean, p.ativo),
      updated_at = now()
    WHERE p.id = s.produto_id;

  ELSIF s.tipo = 'exclusao' THEN
    IF s.produto_id IS NULL THEN RAISE EXCEPTION 'Produto não informado'; END IF;
    DELETE FROM public.produtos WHERE id = s.produto_id;
  END IF;

  UPDATE public.produto_solicitacoes
     SET status = 'aprovado',
         decidido_por = NULLIF(_responsavel,''),
         decidido_em = now(),
         produto_id = CASE WHEN tipo = 'exclusao' THEN NULL ELSE produto_id END
   WHERE id = _solicitacao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recusar_produto_solicitacao(_solicitacao_id uuid, _responsavel text, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status public.produto_solicitacao_status;
BEGIN
  SELECT status INTO v_status FROM public.produto_solicitacoes WHERE id = _solicitacao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já foi decidida'; END IF;

  UPDATE public.produto_solicitacoes
     SET status = 'recusado',
         decidido_por = NULLIF(_responsavel,''),
         decisao_motivo = NULLIF(_motivo,''),
         decidido_em = now()
   WHERE id = _solicitacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_produto_solicitacao(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.recusar_produto_solicitacao(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aprovar_produto_solicitacao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_produto_solicitacao(uuid, text, text) TO authenticated;