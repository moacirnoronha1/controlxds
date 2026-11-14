import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Reuniao, Acao, Historico } from './reunioes';
export function exportarFollowup(reunioes: Reuniao[], acoes: Acao[], historico: Historico[]) {
  const doc = new jsPDF();
  doc.setFontSize(15); doc.text('StockX — Reuniões e Follow-up', 14, 16);
  doc.setFontSize(9); doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, 14, 23);
  autoTable(doc, { startY: 29, head: [['Reunião / Data', 'Participantes', 'Pauta', 'Ata / Decisões']], body: reunioes.map(r => [`${r.titulo}\n${new Date(r.data).toLocaleString('pt-BR')}`, r.participantes, r.pauta, r.ata]), styles: { fontSize: 8 } });
  doc.addPage(); doc.text('Planos de ação', 14, 16);
  autoTable(doc, { startY: 22, head: [['Ação', 'Responsável', 'Prazo', 'Prioridade', 'Status', 'Observação']], body: acoes.map(a => [a.titulo, a.responsavel_nome, a.prazo.split('-').reverse().join('/'), a.prioridade, a.status.replace('_', ' '), a.observacao]), styles: { fontSize: 8 } });
  doc.addPage(); doc.text('Histórico de atualizações', 14, 16);
  autoTable(doc, { startY: 22, head: [['Data', 'Autor', 'Evento', 'Alteração']], body: historico.map(h => [new Date(h.created_at).toLocaleString('pt-BR'), h.autor, h.evento, JSON.stringify({ antes: h.antes, depois: h.depois })]), styles: { fontSize: 7 } });
  doc.save('stockx-reunioes-followup.pdf');
}