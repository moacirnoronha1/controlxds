CREATE TABLE public.amostragens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT current_date,
  responsavel text,
  local_id uuid REFERENCES public.locais_estoque(id),
  observacao text,
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amostragens TO authenticated;
GRANT ALL ON public.amostragens TO service_role;
ALTER TABLE public.amostragens ENABLE ROW LEVEL SECURITY;
CREATE POLICY amostragens_app_user_all ON public.amostragens FOR ALL TO authenticated USING (is_app_user()) WITH CHECK (is_app_user());

CREATE TABLE public.amostragem_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amostragem_id uuid NOT NULL REFERENCES public.amostragens(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  categoria text,
  local_nome text,
  estoque_sistema numeric NOT NULL DEFAULT 0,
  contagem_fisica numeric,
  diferenca numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (amostragem_id, produto_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amostragem_itens TO authenticated;
GRANT ALL ON public.amostragem_itens TO service_role;
ALTER TABLE public.amostragem_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY amostragem_itens_app_user_all ON public.amostragem_itens FOR ALL TO authenticated USING (is_app_user()) WITH CHECK (is_app_user());

CREATE TRIGGER amostragens_touch BEFORE UPDATE ON public.amostragens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER amostragem_itens_touch BEFORE UPDATE ON public.amostragem_itens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_amostragens_data ON public.amostragens(data DESC);
CREATE INDEX idx_amostragem_itens_amostragem ON public.amostragem_itens(amostragem_id);