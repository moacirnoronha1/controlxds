
REVOKE ALL ON FUNCTION public.fechar_inventario(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_inventario(public.inventario_tipo, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_inventario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_inventario(public.inventario_tipo, TEXT, UUID[]) TO authenticated;
