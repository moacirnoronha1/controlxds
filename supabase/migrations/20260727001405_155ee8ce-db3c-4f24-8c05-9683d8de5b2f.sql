
-- 1) Lock down usuarios table: remove open policy, revoke direct table access
DROP POLICY IF EXISTS usuarios_open ON public.usuarios;
REVOKE ALL ON public.usuarios FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.usuarios TO service_role;

-- Keep RLS on with no policies -> denies all direct access (definer functions still work)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 2) Safe listing function (no senha_hash exposed)
CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS TABLE(id uuid, nome text, username text, cargo user_cargo, setor text, ativo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nome, u.username, u.cargo, u.setor, u.ativo
  FROM public.usuarios u
  ORDER BY u.nome;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios() TO anon, authenticated;

-- 3) Safe delete function
CREATE OR REPLACE FUNCTION public.excluir_usuario(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.usuarios WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_usuario(uuid) TO anon, authenticated;

-- 4) Lock trigger-only definer functions from public execution
REVOKE ALL ON FUNCTION public.aplicar_movimentacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_avaria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5) Restrict has_role to authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
