CREATE TYPE public.ajuste_tipo AS ENUM ('entrada','saida','correcao');
CREATE TYPE public.ajuste_status AS ENUM ('pendente','aprovado','recusado');

CREATE TABLE public.ajustes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  local_id uuid REFERENCES public.locais_estoque(id),
  lote_id uuid REFERENCES public.lotes(id),
  tipo public.ajuste_tipo NOT NULL,
  quantidade numeric NOT NULL,
  motivo text,
  solicitado_por text,
  decidido_por text,
  decisao_motivo text,
  status public.ajuste_status NOT NULL DEFAULT 'pendente',
  saldo_antes numeric,
  saldo_depois numeric,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_estoque TO authenticated;
GRANT ALL ON public.ajustes_estoque TO service_role;

ALTER TABLE public.ajustes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY ajustes_estoque_app_user_all ON public.ajustes_estoque
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

CREATE TRIGGER trg_ajustes_estoque_updated_at
  BEFORE UPDATE ON public.ajustes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.aprovar_ajuste(_ajuste_id uuid, _responsavel text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.ajustes_estoque%ROWTYPE;
  v_saldo_antes numeric;
  v_local uuid;
  v_lote_id uuid;
  v_dif numeric;
  v_qtd numeric;
  v_lote_saldo numeric;
BEGIN
  SELECT * INTO a FROM public.ajustes_estoque WHERE id = _ajuste_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF a.status <> 'pendente' THEN RAISE EXCEPTION 'Ajuste já foi decidido'; END IF;
  IF a.quantidade IS NULL OR a.quantidade < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT COALESCE(estoque_atual, 0), COALESCE(a.local_id, local_padrao_id)
    INTO v_saldo_antes, v_local
    FROM public.produtos WHERE id = a.produto_id FOR UPDATE;

  IF v_local IS NULL THEN
    SELECT local_id INTO v_local FROM public.lotes
      WHERE produto_id = a.produto_id AND saldo > 0
      ORDER BY validade NULLS LAST, created_at LIMIT 1;
  END IF;
  IF v_local IS NULL THEN
    SELECT id INTO v_local FROM public.locais_estoque WHERE ativo = true ORDER BY created_at LIMIT 1;
  END IF;

  IF a.tipo = 'entrada' THEN
    v_dif := a.quantidade;
  ELSIF a.tipo = 'saida' THEN
    v_dif := -a.quantidade;
  ELSE
    v_dif := a.quantidade - v_saldo_antes;
  END IF;

  IF v_dif > 0 THEN
    IF v_local IS NULL THEN
      RAISE EXCEPTION 'Nenhum local de estoque disponível para o ajuste';
    END IF;
    INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
    VALUES (a.produto_id, v_local, v_dif, v_dif, 'Ajuste de estoque ' || a.id::text)
    RETURNING id INTO v_lote_id;

    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (a.produto_id, 'entrada', v_dif,
            'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
            NULLIF(_responsavel,''), v_lote_id, v_local);

  ELSIF v_dif < 0 THEN
    v_qtd := -v_dif;
    IF a.lote_id IS NOT NULL THEN
      SELECT saldo, local_id INTO v_lote_saldo, v_local
        FROM public.lotes WHERE id = a.lote_id FOR UPDATE;
      IF v_lote_saldo IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
      IF v_lote_saldo < v_qtd THEN
        RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_lote_saldo, v_qtd;
      END IF;
      UPDATE public.lotes SET saldo = saldo - v_qtd, updated_at = now() WHERE id = a.lote_id;
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (a.produto_id, 'saida', v_qtd,
              'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), ''),
              NULLIF(_responsavel,''), a.lote_id, v_local);
    ELSE
      PERFORM public.registrar_saida_fefo(
        a.produto_id, NULL, v_qtd, _responsavel,
        'Ajuste aprovado' || COALESCE(' - ' || NULLIF(a.motivo,''), '')
      );
    END IF;
  END IF;

  UPDATE public.ajustes_estoque
     SET status = 'aprovado',
         decidido_por = NULLIF(_responsavel,''),
         decidido_em = now(),
         saldo_antes = v_saldo_antes,
         saldo_depois = (SELECT COALESCE(estoque_atual,0) FROM public.produtos WHERE id = a.produto_id)
   WHERE id = a.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recusar_ajuste(_ajuste_id uuid, _responsavel text, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status public.ajuste_status;
BEGIN
  SELECT status INTO v_status FROM public.ajustes_estoque WHERE id = _ajuste_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Ajuste já foi decidido'; END IF;

  UPDATE public.ajustes_estoque
     SET status = 'recusado',
         decidido_por = NULLIF(_responsavel,''),
         decisao_motivo = NULLIF(_motivo,''),
         decidido_em = now(),
         saldo_antes = (SELECT COALESCE(estoque_atual,0) FROM public.produtos p WHERE p.id = ajustes_estoque.produto_id),
         saldo_depois = (SELECT COALESCE(estoque_atual,0) FROM public.produtos p WHERE p.id = ajustes_estoque.produto_id)
   WHERE id = _ajuste_id;
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_ajuste(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recusar_ajuste(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_ajuste(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_ajuste(uuid, text, text) TO authenticated;