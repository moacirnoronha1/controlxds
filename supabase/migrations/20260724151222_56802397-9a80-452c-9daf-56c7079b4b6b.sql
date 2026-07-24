
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.user_cargo AS ENUM ('mestre','estoquista','lider','requisitante');

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  username text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  cargo public.user_cargo NOT NULL DEFAULT 'requisitante',
  setor text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO anon, authenticated;
GRANT ALL ON public.usuarios TO service_role;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_open" ON public.usuarios
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_usuarios_updated
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Login
CREATE OR REPLACE FUNCTION public.login_usuario(_username text, _senha text)
RETURNS TABLE(id uuid, nome text, username text, cargo public.user_cargo, setor text, ativo boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.cargo, u.setor, u.ativo
  FROM public.usuarios u
  WHERE upper(u.username) = upper(_username)
    AND u.ativo = true
    AND u.senha_hash = crypt(_senha, u.senha_hash);
END; $$;

REVOKE ALL ON FUNCTION public.login_usuario(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_usuario(text,text) TO anon, authenticated;

-- Criar usuário
CREATE OR REPLACE FUNCTION public.criar_usuario(
  _nome text, _username text, _senha text,
  _cargo public.user_cargo, _setor text, _ativo boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _senha IS NULL OR length(_senha) < 3 THEN
    RAISE EXCEPTION 'Senha muito curta';
  END IF;
  INSERT INTO public.usuarios (nome, username, senha_hash, cargo, setor, ativo)
  VALUES (_nome, upper(_username), crypt(_senha, gen_salt('bf')),
          _cargo, NULLIF(_setor,''), COALESCE(_ativo, true))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.criar_usuario(text,text,text,public.user_cargo,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_usuario(text,text,text,public.user_cargo,text,boolean) TO anon, authenticated;

-- Atualizar usuário (senha opcional)
CREATE OR REPLACE FUNCTION public.atualizar_usuario(
  _id uuid, _nome text, _username text,
  _cargo public.user_cargo, _setor text, _ativo boolean, _senha text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios SET
    nome = _nome,
    username = upper(_username),
    cargo = _cargo,
    setor = NULLIF(_setor,''),
    ativo = _ativo,
    senha_hash = CASE
      WHEN _senha IS NOT NULL AND length(_senha) >= 3
        THEN crypt(_senha, gen_salt('bf'))
      ELSE senha_hash
    END
  WHERE id = _id;
END; $$;
REVOKE ALL ON FUNCTION public.atualizar_usuario(uuid,text,text,public.user_cargo,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_usuario(uuid,text,text,public.user_cargo,text,boolean,text) TO anon, authenticated;

-- Seed Moacir
INSERT INTO public.usuarios (nome, username, senha_hash, cargo, ativo)
VALUES ('Moacir', 'MOACIR', crypt('3101', gen_salt('bf')), 'mestre', true)
ON CONFLICT (username) DO NOTHING;
