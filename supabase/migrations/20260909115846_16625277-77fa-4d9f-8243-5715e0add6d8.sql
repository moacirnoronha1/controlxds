REVOKE EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text, jsonb) TO service_role;