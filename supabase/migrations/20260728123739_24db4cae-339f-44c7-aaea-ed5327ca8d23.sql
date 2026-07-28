
-- Sessões do login próprio
CREATE TABLE IF NOT EXISTS public.sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '12 hours'
);
REVOKE ALL ON public.sessoes FROM anon, authenticated;
GRANT ALL ON public.sessoes TO service_role;
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;

-- Helper: exige token de sessão de um usuário Mestre ativo
CREATE OR REPLACE FUNCTION public.exigir_mestre(_token text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT u.id INTO v_id
  FROM public.sessoes s
  JOIN public.usuarios u ON u.id = s.usuario_id
  WHERE s.token = _token
    AND s.expires_at > now()
    AND u.ativo = true
    AND u.cargo = 'mestre';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.exigir_mestre(text) FROM PUBLIC, anon, authenticated;

-- Login devolve token
DROP FUNCTION IF EXISTS public.login_usuario(text, text);
CREATE FUNCTION public.login_usuario(_username text, _senha text)
RETURNS TABLE(id uuid, nome text, username text, cargo user_cargo, setor text, ativo boolean, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE u public.usuarios%ROWTYPE; v_token text;
BEGIN
  SELECT * INTO u FROM public.usuarios x
  WHERE upper(x.username) = upper(_username)
    AND x.ativo = true
    AND x.senha_hash = extensions.crypt(_senha, x.senha_hash);
  IF u.id IS NULL THEN RETURN; END IF;

  DELETE FROM public.sessoes WHERE expires_at < now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.sessoes (token, usuario_id) VALUES (v_token, u.id);

  RETURN QUERY SELECT u.id, u.nome, u.username, u.cargo, u.setor, u.ativo, v_token;
END; $$;
REVOKE ALL ON FUNCTION public.login_usuario(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon, authenticated;

-- Gestão de usuários exige token de Mestre
DROP FUNCTION IF EXISTS public.listar_usuarios();
CREATE FUNCTION public.listar_usuarios(_token text)
RETURNS TABLE(id uuid, nome text, username text, cargo user_cargo, setor text, ativo boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.exigir_mestre(_token);
  RETURN QUERY SELECT u.id, u.nome, u.username, u.cargo, u.setor, u.ativo
  FROM public.usuarios u ORDER BY u.nome;
END; $$;

DROP FUNCTION IF EXISTS public.criar_usuario(text, text, text, user_cargo, text, boolean);
CREATE FUNCTION public.criar_usuario(_token text, _nome text, _username text, _senha text, _cargo user_cargo, _setor text, _ativo boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.exigir_mestre(_token);
  IF _senha IS NULL OR length(_senha) < 3 THEN
    RAISE EXCEPTION 'Senha muito curta';
  END IF;
  INSERT INTO public.usuarios (nome, username, senha_hash, cargo, setor, ativo)
  VALUES (_nome, upper(_username), extensions.crypt(_senha, extensions.gen_salt('bf')),
          _cargo, NULLIF(_setor,''), COALESCE(_ativo, true))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

DROP FUNCTION IF EXISTS public.atualizar_usuario(uuid, text, text, user_cargo, text, boolean, text);
CREATE FUNCTION public.atualizar_usuario(_token text, _id uuid, _nome text, _username text, _cargo user_cargo, _setor text, _ativo boolean, _senha text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  PERFORM public.exigir_mestre(_token);
  UPDATE public.usuarios SET
    nome = _nome,
    username = upper(_username),
    cargo = _cargo,
    setor = NULLIF(_setor,''),
    ativo = _ativo,
    senha_hash = CASE
      WHEN _senha IS NOT NULL AND length(_senha) >= 3
        THEN extensions.crypt(_senha, extensions.gen_salt('bf'))
      ELSE senha_hash
    END
  WHERE id = _id;
END; $$;

DROP FUNCTION IF EXISTS public.excluir_usuario(uuid);
CREATE FUNCTION public.excluir_usuario(_token text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.exigir_mestre(_token);
  DELETE FROM public.usuarios WHERE id = _id;
END; $$;

REVOKE ALL ON FUNCTION public.listar_usuarios(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_usuario(text, text, text, text, user_cargo, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atualizar_usuario(text, uuid, text, text, user_cargo, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_usuario(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_usuario(text, text, text, text, user_cargo, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_usuario(text, uuid, text, text, user_cargo, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_usuario(text, uuid) TO anon, authenticated;
