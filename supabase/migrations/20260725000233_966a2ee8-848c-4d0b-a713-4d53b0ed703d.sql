CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.login_usuario(_username text, _senha text)
 RETURNS TABLE(id uuid, nome text, username text, cargo user_cargo, setor text, ativo boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.cargo, u.setor, u.ativo
  FROM public.usuarios u
  WHERE upper(u.username) = upper(_username)
    AND u.ativo = true
    AND u.senha_hash = extensions.crypt(_senha, u.senha_hash);
END; $function$;

CREATE OR REPLACE FUNCTION public.criar_usuario(_nome text, _username text, _senha text, _cargo user_cargo, _setor text, _ativo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF _senha IS NULL OR length(_senha) < 3 THEN
    RAISE EXCEPTION 'Senha muito curta';
  END IF;
  INSERT INTO public.usuarios (nome, username, senha_hash, cargo, setor, ativo)
  VALUES (_nome, upper(_username), extensions.crypt(_senha, extensions.gen_salt('bf')),
          _cargo, NULLIF(_setor,''), COALESCE(_ativo, true))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.atualizar_usuario(_id uuid, _nome text, _username text, _cargo user_cargo, _setor text, _ativo boolean, _senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
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
END; $function$;

GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_usuario(text, text, text, user_cargo, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_usuario(uuid, text, text, user_cargo, text, boolean, text) TO anon, authenticated;

-- Recadastrar Moacir com hash correto caso o insert anterior tenha falhado
INSERT INTO public.usuarios (nome, username, senha_hash, cargo, ativo)
VALUES ('Moacir', 'MOACIR', extensions.crypt('3101', extensions.gen_salt('bf')), 'mestre', true)
ON CONFLICT (username) DO UPDATE
  SET senha_hash = extensions.crypt('3101', extensions.gen_salt('bf')),
      cargo = 'mestre',
      ativo = true;
