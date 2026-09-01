ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_tipo_check;
ALTER TABLE public.movimentacoes ADD CONSTRAINT movimentacoes_tipo_check
  CHECK (tipo IN ('entrada','saida','ajuste_entrada','ajuste_saida'));

CREATE OR REPLACE FUNCTION public.aplicar_movimentacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  estoque_novo NUMERIC;
  v_positivo BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_positivo := NEW.tipo IN ('entrada','ajuste_entrada');
    IF v_positivo THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + NEW.quantidade, updated_at = now()
        WHERE id = NEW.produto_id;
    ELSE
      SELECT estoque_atual - NEW.quantidade INTO estoque_novo
        FROM public.produtos WHERE id = NEW.produto_id;
      IF estoque_novo < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %',
          estoque_novo + NEW.quantidade, NEW.quantidade;
      END IF;
      UPDATE public.produtos
        SET estoque_atual = estoque_novo, updated_at = now()
        WHERE id = NEW.produto_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.tipo IN ('entrada','ajuste_entrada') THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual - OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    ELSE
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

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
      VALUES (r.produto_id, v_local, v_dif, v_dif, 'Ajuste de Inventário ' || _inventario_id::text)
      RETURNING id INTO v_lote_id;

      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (r.produto_id, 'ajuste_entrada', v_dif, 'Ajuste de Inventário',
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
        VALUES (r.produto_id, 'ajuste_saida', v_consumir, 'Ajuste de Inventário',
                COALESCE(auth.uid()::text, 'sistema'), l.id, l.local_id);
        v_restante := v_restante - v_consumir;
      END LOOP;

      IF v_restante > 0 THEN
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
        VALUES (r.produto_id, 'ajuste_saida', v_restante, 'Ajuste de Inventário (sem lote)',
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

UPDATE public.movimentacoes
   SET tipo = CASE WHEN tipo = 'entrada' THEN 'ajuste_entrada' ELSE 'ajuste_saida' END
 WHERE tipo IN ('entrada','saida')
   AND observacao ILIKE 'Ajuste de invent%';