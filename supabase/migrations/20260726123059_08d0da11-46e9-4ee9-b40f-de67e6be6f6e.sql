
-- Enums
DO $$ BEGIN
  CREATE TYPE public.avaria_momento AS ENUM ('na_chegada','depois_chegada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.avaria_tipo AS ENUM ('vencido','quebrado','danificado','perda_operacional','divergencia_contagem','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.avaria_status AS ENUM ('pendente','em_analise','aprovado','recusado','descontado','resolvido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.avarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  local_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL,
  momento public.avaria_momento NOT NULL,
  tipo public.avaria_tipo NOT NULL,
  motivo text,
  quantidade numeric NOT NULL DEFAULT 0,
  -- Campos "na chegada"
  barco text,
  manifesto text,
  quantidade_recebida numeric,
  quantidade_avariada numeric,
  quantidade_aproveitada numeric,
  valor_estimado numeric,
  -- Checklist de tratativa
  chk_registrada boolean NOT NULL DEFAULT true,
  chk_evidencia boolean NOT NULL DEFAULT false,
  chk_comunicado boolean NOT NULL DEFAULT false,
  chk_aguardando boolean NOT NULL DEFAULT false,
  chk_aprovado boolean NOT NULL DEFAULT false,
  chk_recusado boolean NOT NULL DEFAULT false,
  chk_descontado boolean NOT NULL DEFAULT false,
  chk_resolvido boolean NOT NULL DEFAULT false,
  responsavel text,
  observacao text,
  status public.avaria_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avarias TO authenticated;
GRANT ALL ON public.avarias TO service_role;

ALTER TABLE public.avarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avarias_auth_all ON public.avarias;
CREATE POLICY avarias_auth_all ON public.avarias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS avarias_touch_updated_at ON public.avarias;
CREATE TRIGGER avarias_touch_updated_at
  BEFORE UPDATE ON public.avarias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger que aplica baixa FEFO quando a avaria é "depois da chegada"
CREATE OR REPLACE FUNCTION public.aplicar_avaria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.momento = 'depois_chegada' AND COALESCE(NEW.quantidade, 0) > 0 THEN
      PERFORM public.registrar_saida_fefo(
        NEW.produto_id,
        NEW.local_id,
        NEW.quantidade,
        NULLIF(NEW.responsavel,''),
        'Avaria: ' || NEW.tipo::text || COALESCE(' - ' || NULLIF(NEW.motivo,''), '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_avaria() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS avarias_aplicar ON public.avarias;
CREATE TRIGGER avarias_aplicar
  AFTER INSERT ON public.avarias
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_avaria();

CREATE INDEX IF NOT EXISTS avarias_produto_idx ON public.avarias(produto_id);
CREATE INDEX IF NOT EXISTS avarias_local_idx ON public.avarias(local_id);
CREATE INDEX IF NOT EXISTS avarias_status_idx ON public.avarias(status);
CREATE INDEX IF NOT EXISTS avarias_data_idx ON public.avarias(data DESC);
