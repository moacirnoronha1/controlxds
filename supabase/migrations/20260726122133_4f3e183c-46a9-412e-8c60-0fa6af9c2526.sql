GRANT EXECUTE ON FUNCTION public.criar_usuario(text, text, text, user_cargo, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_usuario(uuid, text, text, user_cargo, text, boolean, text) TO anon, authenticated;
GRANT SELECT ON public.locais_estoque TO anon;