ALTER TABLE public.produtos ADD COLUMN codigo_barras text;
CREATE UNIQUE INDEX produtos_codigo_barras_unique ON public.produtos (codigo_barras) WHERE codigo_barras IS NOT NULL;
