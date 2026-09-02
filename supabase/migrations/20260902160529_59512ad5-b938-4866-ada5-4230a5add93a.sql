CREATE OR REPLACE FUNCTION public.criar_requisicao_com_itens(
  _requisitante text,
  _setor text,
  _observacao text,
  _extra boolean,
  _itens jsonb
)
RETURNS public.requisicoes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _requisicao public.requisicoes;
  _quantidade_itens integer;
BEGIN
  IF NOT public.is_app_user() THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF nullif(btrim(_requisitante), '') IS NULL THEN
    RAISE EXCEPTION 'Requisitante não identificado';
  END IF;

  IF nullif(btrim(_setor), '') IS NULL THEN
    RAISE EXCEPTION 'Destino / setor não informado';
  END IF;

  IF jsonb_typeof(_itens) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Lista de itens inválida';
  END IF;

  SELECT count(*)
  INTO _quantidade_itens
  FROM jsonb_to_recordset(_itens) AS item(
    produto_id uuid,
    codigo text,
    quantidade_solicitada numeric
  )
  WHERE item.produto_id IS NOT NULL
    AND item.quantidade_solicitada > 0;

  IF _quantidade_itens = 0 OR _quantidade_itens <> jsonb_array_length(_itens) THEN
    RAISE EXCEPTION 'Todos os itens devem ter produto e quantidade maior que zero';
  END IF;

  INSERT INTO public.requisicoes (
    requisitante,
    setor,
    observacao,
    extra
  ) VALUES (
    btrim(_requisitante),
    btrim(_setor),
    nullif(btrim(_observacao), ''),
    coalesce(_extra, false)
  )
  RETURNING * INTO _requisicao;

  INSERT INTO public.requisicao_itens (
    requisicao_id,
    produto_id,
    codigo,
    quantidade_solicitada
  )
  SELECT
    _requisicao.id,
    item.produto_id,
    item.codigo,
    item.quantidade_solicitada
  FROM jsonb_to_recordset(_itens) AS item(
    produto_id uuid,
    codigo text,
    quantidade_solicitada numeric
  );

  RETURN _requisicao;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_requisicao_com_itens(text, text, text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_requisicao_com_itens(text, text, text, boolean, jsonb) TO authenticated, service_role;