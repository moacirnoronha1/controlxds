
-- Categorias suportadas
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Secos',
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  estoque_inicial NUMERIC NOT NULL DEFAULT 0,
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  responsavel TEXT,
  fornecedor TEXT,
  barco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_produto ON public.movimentacoes(produto_id);
CREATE INDEX idx_mov_data ON public.movimentacoes(data_movimentacao DESC);
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria);

-- Trigger: atualiza estoque e bloqueia negativo
CREATE OR REPLACE FUNCTION public.aplicar_movimentacao()
RETURNS TRIGGER AS $$
DECLARE
  estoque_novo NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + NEW.quantidade,
            updated_at = now()
        WHERE id = NEW.produto_id
        RETURNING estoque_atual INTO estoque_novo;
    ELSE
      SELECT estoque_atual - NEW.quantidade INTO estoque_novo
        FROM public.produtos WHERE id = NEW.produto_id;
      IF estoque_novo < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, solicitado: %',
          estoque_novo + NEW.quantidade, NEW.quantidade;
      END IF;
      UPDATE public.produtos
        SET estoque_atual = estoque_novo,
            updated_at = now()
        WHERE id = NEW.produto_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.produtos
        SET estoque_atual = estoque_atual - OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    ELSE
      UPDATE public.produtos
        SET estoque_atual = estoque_atual + OLD.quantidade, updated_at = now()
        WHERE id = OLD.produto_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mov_aplicar
AFTER INSERT OR DELETE ON public.movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimentacao();

-- RLS: sistema de uso interno, acesso aberto (anon)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_read_produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "open_write_produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "open_read_mov" ON public.movimentacoes FOR SELECT USING (true);
CREATE POLICY "open_write_mov" ON public.movimentacoes FOR ALL USING (true) WITH CHECK (true);
