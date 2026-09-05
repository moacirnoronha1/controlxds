DO $$
DECLARE
  e RECORD;
  v_local uuid;
  v_restante numeric;
  v_consumir numeric;
  v_lote uuid;
  l RECORD;
BEGIN
  FOR e IN
    SELECT em.* FROM public.emprestimos em
    WHERE NOT EXISTS (
      SELECT 1 FROM public.movimentacoes m
      WHERE m.tipo IN ('emprestimo_entrada','emprestimo_saida')
        AND m.observacao LIKE '%[EMP:' || em.id::text || ']%'
    )
    ORDER BY em.created_at
  LOOP
    v_local := COALESCE(e.local_id, (SELECT local_padrao_id FROM public.produtos WHERE id = e.produto_id));

    IF e.produto_id IS NULL THEN CONTINUE; END IF;

    IF e.local_id IS NULL AND v_local IS NOT NULL THEN
      UPDATE public.emprestimos SET local_id = v_local, updated_at = now() WHERE id = e.id;
    END IF;

    IF e.tipo = 'emprestamos' THEN
      -- baixa: consome lotes FEFO quando existirem
      v_restante := e.quantidade;
      FOR l IN
        SELECT id, saldo::numeric AS saldo, local_id FROM public.lotes
         WHERE produto_id = e.produto_id AND saldo > 0
           AND (v_local IS NULL OR local_id = v_local)
         ORDER BY validade NULLS LAST, created_at
         FOR UPDATE
      LOOP
        EXIT WHEN v_restante <= 0;
        v_consumir := LEAST(l.saldo, v_restante);
        UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
        VALUES (e.produto_id, 'emprestimo_saida', v_consumir,
                'Empréstimo concedido (regularização) [EMP:' || e.id::text || ']',
                NULLIF(e.responsavel,''), l.id, l.local_id);
        v_restante := v_restante - v_consumir;
      END LOOP;
      IF v_restante > 0 THEN
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, local_id)
        VALUES (e.produto_id, 'emprestimo_saida', v_restante,
                'Empréstimo concedido (regularização) [EMP:' || e.id::text || ']',
                NULLIF(e.responsavel,''), v_local);
      END IF;

      IF e.status = 'devolvido' THEN
        INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
        VALUES (e.produto_id, COALESCE(v_local, (SELECT id FROM public.locais_estoque WHERE ativo ORDER BY created_at LIMIT 1)),
                e.quantidade, e.quantidade, 'Devolução de empréstimo (regularização)')
        RETURNING id INTO v_lote;
        INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
        VALUES (e.produto_id, 'emprestimo_entrada', e.quantidade,
                'Devolução de empréstimo (regularização) [EMP:' || e.id::text || ']',
                NULLIF(e.responsavel,''), v_lote, v_local);
      END IF;

    ELSIF e.tipo = 'tomamos_emprestado' THEN
      INSERT INTO public.lotes (produto_id, local_id, quantidade_inicial, saldo, observacao)
      VALUES (e.produto_id, COALESCE(v_local, (SELECT id FROM public.locais_estoque WHERE ativo ORDER BY created_at LIMIT 1)),
              e.quantidade, e.quantidade, 'Empréstimo recebido (regularização)')
      RETURNING id INTO v_lote;
      INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
      VALUES (e.produto_id, 'emprestimo_entrada', e.quantidade,
              'Empréstimo recebido (regularização) [EMP:' || e.id::text || ']',
              NULLIF(e.responsavel,''), v_lote, v_local);

      IF e.status = 'devolvido' THEN
        v_restante := e.quantidade;
        FOR l IN
          SELECT id, saldo::numeric AS saldo, local_id FROM public.lotes
           WHERE produto_id = e.produto_id AND saldo > 0
             AND (v_local IS NULL OR local_id = v_local)
           ORDER BY validade NULLS LAST, created_at
           FOR UPDATE
        LOOP
          EXIT WHEN v_restante <= 0;
          v_consumir := LEAST(l.saldo, v_restante);
          UPDATE public.lotes SET saldo = saldo - v_consumir, updated_at = now() WHERE id = l.id;
          INSERT INTO public.movimentacoes (produto_id, tipo, quantidade, observacao, responsavel, lote_id, local_id)
          VALUES (e.produto_id, 'emprestimo_saida', v_consumir,
                  'Devolução de empréstimo (regularização) [EMP:' || e.id::text || ']',
                  NULLIF(e.responsavel,''), l.id, l.local_id);
          v_restante := v_restante - v_consumir;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $$;