
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'estoquista', 'leitor');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabela de papéis (separada para evitar privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar papel
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger: cria profile + papel leitor padrão no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  -- Primeiro usuário vira admin; demais viram leitor
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'leitor');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger reutiliza função existente se houver, senão cria
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS profiles ============
CREATE POLICY "users see own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "admins update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============ RLS user_roles ============
CREATE POLICY "users see own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Atualiza RLS de produtos ============
DROP POLICY IF EXISTS open_read_produtos ON public.produtos;
DROP POLICY IF EXISTS open_write_produtos ON public.produtos;

CREATE POLICY "auth read produtos" ON public.produtos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin write produtos" ON public.produtos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- estoquista pode UPDATE de produtos (para ajustar estoque) mas não delete/insert
CREATE POLICY "estoquista update produtos" ON public.produtos
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'))
WITH CHECK (public.has_role(auth.uid(), 'estoquista'));

-- ============ Atualiza RLS de movimentacoes ============
DROP POLICY IF EXISTS open_read_mov ON public.movimentacoes;
DROP POLICY IF EXISTS open_write_mov ON public.movimentacoes;

CREATE POLICY "auth read mov" ON public.movimentacoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin/estoquista insert mov" ON public.movimentacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'estoquista')
);

CREATE POLICY "admin delete mov" ON public.movimentacoes
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update mov" ON public.movimentacoes
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
