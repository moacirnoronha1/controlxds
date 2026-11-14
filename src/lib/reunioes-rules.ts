import type { AppRole } from '@/hooks/use-auth';

export function gerenciaReunioes(role: AppRole | null) { return role === 'mestre' || role === 'lider'; }
export function acessaReunioes(role: AppRole | null) { return gerenciaReunioes(role) || role === 'estoquista'; }
export function acaoAtrasada(prazo: string, status: string, hoje: string) { return status !== 'concluida' && prazo < hoje; }