
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  numero text,
  fornecedor text,
  cnpj text,
  data_emissao date,
  responsavel text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated, anon;
GRANT ALL ON public.notas_fiscais TO service_role;

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY notas_fiscais_all ON public.notas_fiscais
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE TRIGGER trg_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
