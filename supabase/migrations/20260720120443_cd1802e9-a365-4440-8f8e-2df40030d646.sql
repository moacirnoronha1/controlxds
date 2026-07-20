GRANT EXECUTE ON FUNCTION public.criar_inventario(public.inventario_tipo, text, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.fechar_inventario(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.liberar_requisicao(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.cancelar_requisicao(uuid) TO anon;