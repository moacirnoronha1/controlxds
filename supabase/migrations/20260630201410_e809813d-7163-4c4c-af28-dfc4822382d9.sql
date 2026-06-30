-- Harden SECURITY DEFINER functions: revoke public/anon EXECUTE.
-- Trigger-only functions need no grants (triggers run with the function owner's rights).
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_movimentacao() FROM PUBLIC, anon, authenticated;

-- has_role is used by RLS policies; runs as definer via policy evaluation, no direct anon RPC needed.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Business RPCs: restrict to authenticated callers only (no anon).
REVOKE EXECUTE ON FUNCTION public.criar_inventario(public.inventario_tipo, text, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.criar_inventario(public.inventario_tipo, text, uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fechar_inventario(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fechar_inventario(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancelar_requisicao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancelar_requisicao(uuid) TO authenticated;
