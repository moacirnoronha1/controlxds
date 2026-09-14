ALTER FUNCTION public.gx_mestre_atual() SET SCHEMA private;
ALTER FUNCTION public.resumo_uso_banco() SET SCHEMA private;
ALTER FUNCTION public.arquivar_dados_antigos(integer) SET SCHEMA private;
ALTER FUNCTION public.limpar_dados_teste_seguros() SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.resumo_uso_banco()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
DECLARE
  v_usuario text;
  v_tabelas jsonb;
  v_total bigint;
  v_arquivaveis jsonb;
  v_testes jsonb;
  v_duplicidades jsonb;
BEGIN
  v_usuario := private.gx_mestre_atual();
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tabela',x.tabela,'registros',x.registros,'bytes',x.bytes) ORDER BY x.bytes DESC),'[]'::jsonb)
  INTO v_tabelas
  FROM (
    SELECT c.relname tabela, COALESCE(s.n_live_tup,0)::bigint registros, pg_total_relation_size(c.oid)::bigint bytes
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('movimentacoes','inventario_itens','requisicao_itens','produtos','lotes','requisicoes','inventarios','emprestimos','avarias','entrada_alteracoes','requisicao_alteracoes','notas_fiscais','sessoes')
  ) x;
  SELECT pg_database_size(current_database())::bigint INTO v_total;
  SELECT jsonb_build_object(
    'requisicoes',(SELECT count(*) FROM public.requisicoes WHERE arquivado_em IS NULL AND status IN ('liberada','cancelada') AND COALESCE(liberada_em,cancelada_em,data)<now()-interval '180 days'),
    'inventarios',(SELECT count(*) FROM public.inventarios WHERE arquivado_em IS NULL AND status='fechado' AND COALESCE(fechado_em,created_at)<now()-interval '180 days'),
    'emprestimos',(SELECT count(*) FROM public.emprestimos WHERE arquivado_em IS NULL AND status='devolvido' AND COALESCE(data_devolucao::timestamp,created_at)<now()-interval '180 days'),
    'avarias',(SELECT count(*) FROM public.avarias WHERE arquivado_em IS NULL AND status='resolvido' AND updated_at<now()-interval '180 days')) INTO v_arquivaveis;
  SELECT jsonb_build_object(
    'requisicoes',(SELECT count(*) FROM public.requisicoes r WHERE r.dado_teste AND r.status IN ('pendente','cancelada') AND NOT EXISTS (SELECT 1 FROM public.requisicao_itens ri WHERE ri.requisicao_id=r.id AND COALESCE(ri.quantidade_liberada,0)>0)),
    'inventarios',(SELECT count(*) FROM public.inventarios i WHERE i.dado_teste AND i.status<>'fechado' AND NOT EXISTS (SELECT 1 FROM public.inventario_itens ii WHERE ii.inventario_id=i.id AND ii.contagem_fisica IS NOT NULL)),
    'emprestimos',(SELECT count(*) FROM public.emprestimos e WHERE e.dado_teste AND e.produto_id IS NULL),
    'avarias',(SELECT count(*) FROM public.avarias a WHERE a.dado_teste AND a.momento<>'depois_chegada')) INTO v_testes;
  SELECT jsonb_build_object(
    'movimentacoes',COALESCE((SELECT sum(n-1) FROM (SELECT count(*) n FROM public.movimentacoes GROUP BY produto_id,tipo,quantidade,data_movimentacao,COALESCE(lote_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(local_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(observacao,'') HAVING count(*)>1) d),0),
    'itens_requisicao',COALESCE((SELECT sum(n-1) FROM (SELECT count(*) n FROM public.requisicao_itens GROUP BY requisicao_id,produto_id,quantidade_solicitada HAVING count(*)>1) d),0)) INTO v_duplicidades;
  RETURN jsonb_build_object('database_bytes',v_total,'tabelas',v_tabelas,'arquivaveis',v_arquivaveis,'testes_elegiveis',v_testes,'duplicidades_suspeitas',v_duplicidades,'retencao_dias',180,'arquivos_no_banco',false,'gerado_em',now());
END;
$$;

CREATE OR REPLACE FUNCTION private.arquivar_dados_antigos(_dias integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_usuario text; v_req integer:=0; v_inv integer:=0; v_emp integer:=0; v_ava integer:=0; v_sessoes integer:=0;
BEGIN
  v_usuario:=private.gx_mestre_atual();
  IF _dias<180 THEN RAISE EXCEPTION 'O prazo mínimo de arquivamento é 180 dias'; END IF;
  UPDATE public.requisicoes SET arquivado_em=now(),arquivado_por=v_usuario WHERE arquivado_em IS NULL AND status IN ('liberada','cancelada') AND COALESCE(liberada_em,cancelada_em,data)<now()-make_interval(days=>_dias); GET DIAGNOSTICS v_req=ROW_COUNT;
  UPDATE public.inventarios SET arquivado_em=now(),arquivado_por=v_usuario WHERE arquivado_em IS NULL AND status='fechado' AND COALESCE(fechado_em,created_at)<now()-make_interval(days=>_dias); GET DIAGNOSTICS v_inv=ROW_COUNT;
  UPDATE public.emprestimos SET arquivado_em=now(),arquivado_por=v_usuario WHERE arquivado_em IS NULL AND status='devolvido' AND COALESCE(data_devolucao::timestamp,created_at)<now()-make_interval(days=>_dias); GET DIAGNOSTICS v_emp=ROW_COUNT;
  UPDATE public.avarias SET arquivado_em=now(),arquivado_por=v_usuario WHERE arquivado_em IS NULL AND status='resolvido' AND updated_at<now()-make_interval(days=>_dias); GET DIAGNOSTICS v_ava=ROW_COUNT;
  DELETE FROM public.sessoes WHERE expires_at<now(); GET DIAGNOSTICS v_sessoes=ROW_COUNT;
  RETURN jsonb_build_object('requisicoes',v_req,'inventarios',v_inv,'emprestimos',v_emp,'avarias',v_ava,'sessoes_expiradas',v_sessoes);
END;
$$;

CREATE OR REPLACE FUNCTION private.limpar_dados_teste_seguros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_usuario text; v_req integer:=0; v_inv integer:=0; v_emp integer:=0; v_ava integer:=0;
BEGIN
  v_usuario:=private.gx_mestre_atual();
  CREATE TEMP TABLE gx_req_teste(id uuid PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO gx_req_teste SELECT r.id FROM public.requisicoes r WHERE r.dado_teste AND r.status IN ('pendente','cancelada') AND NOT EXISTS (SELECT 1 FROM public.requisicao_itens ri WHERE ri.requisicao_id=r.id AND COALESCE(ri.quantidade_liberada,0)>0);
  DELETE FROM public.requisicao_alteracoes WHERE requisicao_id IN (SELECT id FROM gx_req_teste); DELETE FROM public.requisicao_itens WHERE requisicao_id IN (SELECT id FROM gx_req_teste); DELETE FROM public.requisicoes WHERE id IN (SELECT id FROM gx_req_teste); GET DIAGNOSTICS v_req=ROW_COUNT;
  CREATE TEMP TABLE gx_inv_teste(id uuid PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO gx_inv_teste SELECT i.id FROM public.inventarios i WHERE i.dado_teste AND i.status<>'fechado' AND NOT EXISTS (SELECT 1 FROM public.inventario_itens ii WHERE ii.inventario_id=i.id AND ii.contagem_fisica IS NOT NULL);
  DELETE FROM public.inventario_itens WHERE inventario_id IN (SELECT id FROM gx_inv_teste); DELETE FROM public.inventarios WHERE id IN (SELECT id FROM gx_inv_teste); GET DIAGNOSTICS v_inv=ROW_COUNT;
  DELETE FROM public.emprestimos WHERE dado_teste AND produto_id IS NULL; GET DIAGNOSTICS v_emp=ROW_COUNT;
  DELETE FROM public.avarias WHERE dado_teste AND momento<>'depois_chegada'; GET DIAGNOSTICS v_ava=ROW_COUNT;
  RETURN jsonb_build_object('requisicoes',v_req,'inventarios',v_inv,'emprestimos',v_emp,'avarias',v_ava);
END;
$$;

REVOKE ALL ON FUNCTION private.gx_mestre_atual() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.resumo_uso_banco() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.arquivar_dados_antigos(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.limpar_dados_teste_seguros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.gx_mestre_atual() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.resumo_uso_banco() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.arquivar_dados_antigos(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.limpar_dados_teste_seguros() TO authenticated, service_role;

CREATE FUNCTION public.resumo_uso_banco()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.resumo_uso_banco(); $$;
CREATE FUNCTION public.arquivar_dados_antigos(_dias integer DEFAULT 180)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.arquivar_dados_antigos(_dias); $$;
CREATE FUNCTION public.limpar_dados_teste_seguros()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.limpar_dados_teste_seguros(); $$;
REVOKE ALL ON FUNCTION public.resumo_uso_banco() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arquivar_dados_antigos(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.limpar_dados_teste_seguros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_uso_banco() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.arquivar_dados_antigos(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.limpar_dados_teste_seguros() TO authenticated, service_role;