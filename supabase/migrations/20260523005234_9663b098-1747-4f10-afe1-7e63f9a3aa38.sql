ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_caixa text,
  ADD COLUMN IF NOT EXISTS unidades_por_caixa numeric NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_caixa_unique
  ON public.produtos (codigo_caixa)
  WHERE codigo_caixa IS NOT NULL;