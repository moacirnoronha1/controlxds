
ALTER TABLE public.avarias ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id);

CREATE OR REPLACE FUNCTION public.aplicar_avaria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric;
  v_lote_produto uuid;
  v_lote_local uuid;
  v_validade date;
  v_custo numeric;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.momento = 'depois_chegada' AND COALESCE(NEW.quantidade, 0) > 0 THEN
    IF NEW.lote_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o lote específico para avaria depois da chegada';
    END IF;

    SELECT produto_id, local_id, saldo, validade, custo_unitario
      INTO v_lote_produto, v_lote_local, v_saldo, v_validade, v_custo
      FROM public.lotes WHERE id = NEW.lote_id FOR UPDATE;

    IF v_lote_produto IS NULL THEN
      RAISE EXCEPTION 'Lote não encontrado';
    END IF;
    IF v_lote_produto <> NEW.produto_id THEN
      RAISE EXCEPTION 'Lote não pertence ao produto informado';
    END IF;
    IF v_saldo < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote. Disponível: %, solicitado: %', v_saldo, NEW.quantidade;
    END IF;

    UPDATE public.lotes
      SET saldo = saldo - NEW.quantidade, updated_at = now()
      WHERE id = NEW.lote_id;

    -- garante que o local_id da avaria reflete o lote
    NEW.local_id := v_lote_local;

    INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
    VALUES (
      NEW.produto_id,
      'saida',
      NEW.quantidade,
      'Avaria: ' || NEW.tipo::text
        || COALESCE(' - ' || NULLIF(NEW.motivo,''), '')
        || ' | Lote val ' || COALESCE(to_char(v_validade,'DD/MM/YYYY'),'s/val')
        || ' custo ' || COALESCE(v_custo::text,'—'),
      NULLIF(NEW.responsavel,''),
      NEW.lote_id,
      v_lote_local
    );
  END IF;
  RETURN NEW;
END;
$function$;
