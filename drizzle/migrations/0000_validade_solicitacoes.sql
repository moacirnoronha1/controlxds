CREATE TABLE public.validade_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  validade_antiga date,
  validade_nova date NOT NULL,
  motivo text NOT NULL,
  solicitado_por text NOT NULL,
  status public.ajuste_status NOT NULL DEFAULT 'pendente',
  decidido_por text,
  decisao_motivo text,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.validade_solicitacoes TO authenticated;
GRANT ALL ON public.validade_solicitacoes TO service_role;
ALTER TABLE public.validade_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app users read validade_solicitacoes" ON public.validade_solicitacoes
  FOR SELECT TO authenticated USING (public.is_app_user());
CREATE INDEX validade_solicitacoes_status_idx ON public.validade_solicitacoes(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.solicitar_alteracao_validade(_lote_id uuid, _validade_nova date, _motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u record; v_l public.lotes%ROWTYPE; v_id uuid;
BEGIN
  SELECT nome, cargo INTO v_u FROM public.usuarios WHERE auth_user_id = auth.uid() AND ativo = true;
  IF v_u IS NULL OR v_u.cargo NOT IN ('mestre','lider','estoquista') THEN
    RAISE EXCEPTION 'Seu perfil não permite solicitar alteração de validade';
  END IF;
  IF _validade_nova IS NULL THEN RAISE EXCEPTION 'Informe a nova validade'; END IF;
  IF coalesce(trim(_motivo),'') = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO v_l FROM public.lotes WHERE id = _lote_id;
  IF v_l.id IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF v_l.validade IS NOT DISTINCT FROM _validade_nova THEN RAISE EXCEPTION 'A nova validade é igual à atual'; END IF;
  IF EXISTS (SELECT 1 FROM public.validade_solicitacoes WHERE lote_id = _lote_id AND status = 'pendente') THEN
    RAISE EXCEPTION 'Já existe uma solicitação pendente para este lote';
  END IF;
  INSERT INTO public.validade_solicitacoes(lote_id, produto_id, validade_antiga, validade_nova, motivo, solicitado_por)
  VALUES (_lote_id, v_l.produto_id, v_l.validade, _validade_nova, trim(_motivo), v_u.nome) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decidir_alteracao_validade(_id uuid, _aprovar boolean, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u record; s public.validade_solicitacoes%ROWTYPE;
BEGIN
  SELECT nome, cargo INTO v_u FROM public.usuarios WHERE auth_user_id = auth.uid() AND ativo = true;
  IF v_u IS NULL OR v_u.cargo <> 'mestre' THEN RAISE EXCEPTION 'Apenas o Mestre pode decidir alterações de validade'; END IF;
  SELECT * INTO s FROM public.validade_solicitacoes WHERE id = _id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF s.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já foi decidida'; END IF;
  IF _aprovar THEN
    UPDATE public.lotes SET validade = s.validade_nova, updated_at = now() WHERE id = s.lote_id;
    INSERT INTO public.entrada_alteracoes(lote_id, dados_antes, dados_depois, alterado_por, cargo)
    VALUES (s.lote_id, jsonb_build_object('validade', s.validade_antiga),
            jsonb_build_object('validade', s.validade_nova, 'motivo', s.motivo, 'solicitado_por', s.solicitado_por),
            v_u.nome, v_u.cargo);
  END IF;
  UPDATE public.validade_solicitacoes SET status = CASE WHEN _aprovar THEN 'aprovado'::ajuste_status ELSE 'recusado'::ajuste_status END,
    decidido_por = v_u.nome, decidido_em = now(), decisao_motivo = NULLIF(trim(coalesce(_motivo,'')),'')
  WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.solicitar_alteracao_validade(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decidir_alteracao_validade(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_alteracao_validade(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decidir_alteracao_validade(uuid, boolean, text) TO authenticated, service_role;