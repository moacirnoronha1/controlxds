CREATE OR REPLACE FUNCTION public.fechar_inventario(_inventario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status public.inventario_status;
  r RECORD;
  v_atual numeric;
  v_dif numeric;
  v_local uuid;
  v_lote_id uuid;
  v_restante numeric;
  l RECORD;
  v_consumir numeric;
BEGIN
  SELECT status INTO v_status FROM public.inventarios WHERE id = _inventario_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Inventário não encontrado'; END IF;
  IF v_status = 'fechado' THEN RAISE EXCEPTION 'Inventário já está fechado'; END IF;

  FOR r IN
    SELECT ii.produto_id, ii.contagem_fisica
      FROM public.inventario_itens ii
     WHERE ii.inventario_id = _inventario_id
       AND ii.contagem_fisica IS NOT NULL
  LOOP
    SELECT COALESCE(p.estoque_atual, 0), p.local_padrao_id
      INTO v_atual, v_local
      FROM public.produtos p WHERE p.id = r.produto_id FOR UPDATE;

    v_dif := r.contagem_fisica - COALESCE(v_atual, 0);
    CONTINUE WHEN v_dif = 0;

    IF v_local IS NULL THEN
      SELECT local_id INTO v_local FROM public.lotes
        WHERE produto_id = r.produto_id AND saldo > 0
        ORDER BY validade NULLS LAST, created_at LIMIT 1;
    END IF;
    IF v_local IS NULL THEN
      SELECT id INTO v_local FROM public.locais_estoque WHERE ativo = true ORDER BY created_at LIMIT 1;
    END IF;

    IF v_dif > 0 THEN
      IF v_local IS NULL THEN
        RAISE EXCEPTION 'Nenhum local de estoque disponível para ajuste do produto %', r.produto_id;
      END IF;
      INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
      VALUES (r.produto_id, v_local, v_dif, v_dif, 'Ajuste de inventário ' || _inventario_id::text)
      RETURNING id INTO v_lote_id;

      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (r.produto_id, 'entrada', v_dif, 'Ajuste de inventário ' || _inventario_id::text,
              COALESCE(auth.uid()::text, 'sistema'), v_lote_id, v_local);
    ELSE
      v_restante := -v_dif;
      FOR l IN
        SELECT id, saldo, local_id FROM public.lotes
         WHERE produto_id = r.produto_id AND saldo > 0
         ORDER BY validade NULLS LAST, created_at
         FOR UPDATE
      LOOP
        EXIT WHEN v_restante <= 0;
        v_consumir := LEAST(l.saldo, v_restante);
        UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
        VALUES (r.produto_id, 'saida', v_consumir, 'Ajuste de inventário ' || _inventario_id::text,
                COALESCE(auth.uid()::text, 'sistema'), l.id, l.local_id);
        v_restante := v_restante - v_consumir;
      END LOOP;

      IF v_restante > 0 THEN
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
        VALUES (r.produto_id, 'saida', v_restante, 'Ajuste de inventário ' || _inventario_id::text || ' (sem lote)',
                COALESCE(auth.uid()::text, 'sistema'), v_local);
      END IF;
    END IF;

    UPDATE public.produtos SET estoque_atual = r.contagem_fisica, updated_at = now()
      WHERE id = r.produto_id;
  END LOOP;

  UPDATE public.inventarios
     SET status='fechado', fechado_por=auth.uid(), fechado_em=now()
   WHERE id = _inventario_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bloquear_edicao_inventario_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.inventario_status;
BEGIN
  SELECT status INTO v_status FROM public.inventarios WHERE id = NEW.inventario_id;
  IF v_status = 'fechado' THEN
    RAISE EXCEPTION 'Inventário fechado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_inventario_itens_bloqueio ON public.inventario_itens;
CREATE TRIGGER trg_inventario_itens_bloqueio
BEFORE UPDATE ON public.inventario_itens
FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_inventario_fechado();