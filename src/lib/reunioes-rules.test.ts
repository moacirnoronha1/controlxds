import { describe, expect, it } from 'vitest';
import { acessaReunioes, gerenciaReunioes, acaoAtrasada } from './reunioes-rules';
describe('Reuniões e follow-up', () => {
  it('Mestre gerencia', () => expect(gerenciaReunioes('mestre')).toBe(true));
  it('Líder gerencia', () => expect(gerenciaReunioes('lider')).toBe(true));
  it('Estoquista acompanha sem gerenciar', () => { expect(acessaReunioes('estoquista')).toBe(true); expect(gerenciaReunioes('estoquista')).toBe(false); });
  it('Requisitante não acessa', () => expect(acessaReunioes('requisitante')).toBe(false));
  it('Prazo passado indica atraso, mas ação concluída não', () => { expect(acaoAtrasada('2026-11-13', 'pendente', '2026-11-14')).toBe(true); expect(acaoAtrasada('2026-11-14', 'pendente', '2026-11-14')).toBe(false); expect(acaoAtrasada('2026-11-13', 'concluida', '2026-11-14')).toBe(false); });
});