import { supabase } from '@/integrations/supabase/client';
import { comTempoLimite } from '@/lib/rede';
import type { Database } from '@/integrations/supabase/types';
export type Reuniao = Database['public']['Tables']['reunioes']['Row'];
export type Acao = Database['public']['Tables']['followup_acoes']['Row'];
export type Historico = Database['public']['Tables']['followup_historico']['Row'];
export async function carregarFollowup(gestor: boolean) {
  const [r, a, h, u] = await Promise.all([
    supabase.from('reunioes').select('*').order('data', { ascending: false }),
    supabase.from('followup_acoes').select('*').order('prazo'),
    supabase.from('followup_historico').select('*').order('created_at', { ascending: false }).limit(500),
    gestor ? supabase.rpc('followup_responsaveis') : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [r, a, h, u]) if (result.error) throw result.error;
  return { reunioes: r.data ?? [], acoes: a.data ?? [], historico: h.data ?? [], responsaveis: u.data ?? [] };
}
export async function salvarReuniao(row: Database['public']['Tables']['reunioes']['Insert']) {
  const { error } = await comTempoLimite(signal => supabase.from('reunioes').upsert(row).abortSignal(signal));
  if (error) throw error;
}
export async function salvarAcao(row: Database['public']['Tables']['followup_acoes']['Insert']) {
  const { error } = await comTempoLimite(signal => supabase.from('followup_acoes').upsert(row).abortSignal(signal));
  if (error) throw error;
}