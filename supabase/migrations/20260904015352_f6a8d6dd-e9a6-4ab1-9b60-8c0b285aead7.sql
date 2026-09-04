ALTER TYPE avaria_momento ADD VALUE IF NOT EXISTS 'nao_chegou';
ALTER TYPE avaria_tipo ADD VALUE IF NOT EXISTS 'nao_entregue';
ALTER TYPE avaria_status ADD VALUE IF NOT EXISTS 'comunicado' AFTER 'pendente';
ALTER TABLE public.avarias ADD COLUMN IF NOT EXISTS quantidade_prevista numeric;