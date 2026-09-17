CREATE OR REPLACE FUNCTION public.devolver_emprestimo(
  _id uuid,
  _data date,
  _responsavel text,
  _local_id uuid DEFAULT NULL,
  _lote_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  e public.emprestimos%ROWTYPE;
  v_local_id uuid;
  v_lote_id uuid;
  v_lote_saldo numeric;
BEGIN
  SELECT * INTO e
    FROM public.emprestimos
   WHERE id = _id
   FOR UPDATE;

  IF e.id IS NULL THEN
    RAISE EXCEPTION 'Empréstimo não encontrado';
  END IF;
  IF e.status = 'devolvido' THEN
    RAISE EXCEPTION 'Empréstimo já devolvido';
  END IF;
  IF e.produto_id IS NULL THEN
    RAISE EXCEPTION 'O empréstimo não possui produto vinculado';
  END IF;
  IF e.quantidade IS NULL OR round(e.quantidade, 6) <= 0 THEN
    RAISE EXCEPTION 'Quantidade de devolução inválida';
  END IF;

  v_local_id := COALESCE(_local_id, e.local_id);
  IF v_local_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o local de estoque da devolução';
  END IF;

  IF e.tipo = 'emprestamos' THEN
    PERFORM public.emprestimo_entrar(
      e.produto_id,
      v_local_id,
      round(e.quantidade, 6),
      _responsavel,
      'Devolução de empréstimo'
    );
  ELSE
    v_lote_id := _lote_id;

    IF v_lote_id IS NULL AND e.lote_id IS NOT NULL THEN
      SELECT saldo
        INTO v_lote_saldo
        FROM public.lotes
       WHERE id = e.lote_id
         AND produto_id = e.produto_id
         AND local_id = v_local_id
         AND saldo > 0
       FOR UPDATE;

      IF FOUND AND round(v_lote_saldo, 6) >= round(e.quantidade, 6) THEN
        v_lote_id := e.lote_id;
      END IF;
    END IF;

    PERFORM public.emprestimo_baixar(
      e.produto_id,
      v_local_id,
      v_lote_id,
      round(e.quantidade, 6),
      _responsavel,
      'Devolução de empréstimo'
    );
  END IF;

  UPDATE public.emprestimos
     SET status = 'devolvido',
         data_devolucao = COALESCE(_data, CURRENT_DATE),
         local_id = v_local_id,
         lote_id = COALESCE(v_lote_id, lote_id),
         updated_at = now()
   WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.devolver_emprestimo(uuid, date, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_emprestimo(uuid, date, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.devolver_emprestimo(uuid, date, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_emprestimo(uuid, date, text, uuid, uuid) TO service_role;

DROP FUNCTION public.devolver_emprestimo(uuid, date, text);