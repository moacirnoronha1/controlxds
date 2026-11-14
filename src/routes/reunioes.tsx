import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Pencil, FileDown, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { acessaReunioes, gerenciaReunioes, acaoAtrasada } from '@/lib/reunioes-rules';
import { carregarFollowup, salvarReuniao, salvarAcao, type Reuniao, type Acao } from '@/lib/reunioes';
import { mensagemErro } from '@/lib/rede';

export const Route = createFileRoute('/reunioes')({ component: ReunioesPage, head: () => ({ meta: [
  { title: 'Reuniões e Follow-up | StockX' }, { name: 'description', content: 'Reuniões, decisões e acompanhamento dos planos de ação do StockX.' },
  { property: 'og:title', content: 'Reuniões e Follow-up | StockX' }, { property: 'og:description', content: 'Prazos, responsáveis e histórico de melhorias.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }) });

function ReunioesPage() {
  const { role, user } = useAuth();
  const gestor = gerenciaReunioes(role), acesso = acessaReunioes(role);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['followup', user?.id, gestor], queryFn: () => carregarFollowup(gestor), enabled: acesso });
  const [reuniao, setReuniao] = useState<Partial<Reuniao> | null>(null);
  const [acao, setAcao] = useState<Partial<Acao> | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [pagina, setPagina] = useState(0);
  const [pdf, setPdf] = useState(false);
  const salvar = useMutation({ mutationFn: async () => {
    if (reuniao) {
      if (!reuniao.id || !reuniao.titulo?.trim() || !reuniao.data || !reuniao.participantes?.trim() || !reuniao.pauta?.trim()) throw new Error('Preencha título, data, participantes e pauta.');
      await salvarReuniao({ id: reuniao.id, titulo: reuniao.titulo.trim(), data: new Date(reuniao.data).toISOString(), participantes: reuniao.participantes, pauta: reuniao.pauta, ata: reuniao.ata ?? '' });
    } else if (acao) {
      if (!acao.id || !acao.titulo?.trim() || !acao.responsavel_id || !acao.prazo) throw new Error('Preencha ação, responsável e prazo.');
      await salvarAcao({ id: acao.id, titulo: acao.titulo.trim(), reuniao_id: acao.reuniao_id || null, responsavel_id: acao.responsavel_id, prazo: acao.prazo, prioridade: acao.prioridade ?? 'media', status: acao.status ?? 'pendente', observacao: acao.observacao ?? '' });
    }
  }, onSuccess: () => { setReuniao(null); setAcao(null); void qc.invalidateQueries({ queryKey: ['followup'] }); toast.success('Registro salvo.'); }, onError: e => toast.error(mensagemErro(e)) });
  if (!acesso) return <div className="p-6 text-muted-foreground">Acesso não permitido.</div>;
  const { reunioes = [], acoes = [], historico = [], responsaveis = [] } = q.data ?? {};
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const atrasada = (a: Acao) => acaoAtrasada(a.prazo, a.status, hoje);
  const lista = acoes.filter(a => filtro === 'todas' || (filtro === 'atrasadas' ? atrasada(a) : a.status === filtro));
  const futuras = reunioes.filter(r => new Date(r.data).getTime() >= Date.now()).sort((a,b) => a.data.localeCompare(b.data));
  async function baixar() { setPdf(true); try { const { exportarFollowup } = await import('@/lib/reunioes-pdf'); exportarFollowup(reunioes, acoes, historico); } catch(e) { toast.error(mensagemErro(e)); } finally { setPdf(false); } }
  const select = (label: string, value: string, options: { id: string; nome: string }[], change: (s: string) => void) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
  return <div className="p-4 md:p-6 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold uppercase">Reuniões e Follow-up</h1><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pdf || !q.data} onClick={baixar}><FileDown className="h-4 w-4 mr-2" />PDF</Button>{gestor && <><Button variant="outline" onClick={() => setReuniao({ id: crypto.randomUUID(), data: format(new Date(), "yyyy-MM-dd'T'HH:mm") })}><Plus className="h-4 w-4 mr-2" />Reunião</Button><Button onClick={() => setAcao({ id: crypto.randomUUID(), status: 'pendente', prioridade: 'media' })}><Plus className="h-4 w-4 mr-2" />Ação</Button></>}</div></header>
    {q.isLoading && <p>Carregando...</p>}{q.isError && <div className="text-destructive">{mensagemErro(q.error)} <Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div>}
    <div className="grid grid-cols-3 gap-4 border-y py-4">{[['Pendências', acoes.filter(a=>a.status!=='concluida').length], ['Concluídas', acoes.filter(a=>a.status==='concluida').length], ['Atrasadas', acoes.filter(atrasada).length]].map(([t,n])=><div key={t}><p className="text-sm text-muted-foreground">{t}</p><p className="text-2xl font-semibold">{n}</p></div>)}</div>
    <section className="space-y-2"><h2 className="font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" />Próximos compromissos</h2>{gestor && futuras.slice(0,3).map(r=><p key={r.id} className="text-sm">{new Date(r.data).toLocaleString('pt-BR')} — {r.titulo}</p>)}{acoes.filter(a=>a.status!=='concluida').slice(0,5).map(a=><p key={a.id} className={atrasada(a)?'text-sm text-destructive':'text-sm'}>{a.prazo.split('-').reverse().join('/')} — {a.titulo} · {a.responsavel_nome}</p>)}{!futuras.length && !acoes.some(a=>a.status!=='concluida') && <p className="text-sm text-muted-foreground">Nenhum compromisso pendente.</p>}</section>
    <Tabs defaultValue="acoes"><TabsList>{gestor && <TabsTrigger value="reunioes">Reuniões</TabsTrigger>}<TabsTrigger value="acoes">Planos de ação</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
      <TabsContent value="reunioes" className="space-y-4">{!reunioes.length && <p className="py-6 text-muted-foreground">Nenhuma reunião registrada.</p>}{reunioes.map(r=><article key={r.id} className="border-b py-4 space-y-2"><div className="flex justify-between gap-2"><h3 className="font-semibold">{r.titulo}</h3><Button variant="ghost" size="icon" aria-label={`Editar reunião ${r.titulo}`} onClick={()=>setReuniao({...r,data:format(new Date(r.data),"yyyy-MM-dd'T'HH:mm")})}><Pencil className="h-4 w-4" /></Button></div><p className="text-sm text-muted-foreground">{new Date(r.data).toLocaleString('pt-BR')} · {r.participantes}</p><p className="whitespace-pre-wrap text-sm break-words"><strong>Pauta: </strong>{r.pauta}</p><p className="whitespace-pre-wrap text-sm break-words"><strong>Ata / Decisões: </strong>{r.ata || 'Não registrada'}</p></article>)}</TabsContent>
      <TabsContent value="acoes" className="space-y-3">{select('Status', filtro, [{id:'todas',nome:'Todas'}, {id:'pendente',nome:'Pendentes'}, {id:'em_andamento',nome:'Em andamento'}, {id:'concluida',nome:'Concluídas'}, {id:'atrasadas',nome:'Atrasadas'}],setFiltro)}{!lista.length && <p className="py-6 text-muted-foreground">Nenhuma ação encontrada.</p>}{lista.map(a=><article key={a.id} className="border-b py-4 space-y-2"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold break-words">{a.titulo}</h3>{gestor && <Button variant="ghost" size="icon" aria-label={`Editar ação ${a.titulo}`} onClick={()=>setAcao(a)}><Pencil className="h-4 w-4" /></Button>}</div><div className="flex flex-wrap gap-2"><Badge variant={atrasada(a)?'destructive':'secondary'}>{atrasada(a)?'Atrasada':a.status.replace('_',' ')}</Badge><Badge variant="outline">Prioridade {a.prioridade}</Badge></div><p className="text-sm text-muted-foreground">{a.responsavel_nome} · Prazo: {a.prazo.split('-').reverse().join('/')}</p>{a.reuniao_id && gestor && <p className="text-sm">Reunião: {reunioes.find(r=>r.id===a.reuniao_id)?.titulo}</p>}<p className="whitespace-pre-wrap text-sm break-words">{a.observacao}</p></article>)}</TabsContent>
      <TabsContent value="historico">{historico.slice(pagina*25,pagina*25+25).map(h=><article key={h.id} className="border-b py-3 text-sm"><p className="font-medium">{h.evento} · {h.autor}</p><p className="text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</p><details><summary className="cursor-pointer">Detalhes</summary><pre className="whitespace-pre-wrap break-words text-xs py-2">{JSON.stringify({antes:h.antes,depois:h.depois},null,2)}</pre></details></article>)}{!historico.length && <p className="py-6 text-muted-foreground">Nenhuma atualização registrada.</p>}<div className="flex items-center gap-3 pt-3"><Button variant="outline" disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</Button><span className="text-sm">{pagina+1} / {Math.max(1,Math.ceil(historico.length/25))}</span><Button variant="outline" disabled={(pagina+1)*25>=historico.length} onClick={()=>setPagina(p=>p+1)}>Próxima</Button></div></TabsContent>
    </Tabs>
    <Dialog open={!!reuniao || !!acao} onOpenChange={open=>{if(!open && !salvar.isPending){setReuniao(null);setAcao(null);}}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{reuniao?'Reunião':'Plano de ação'}</DialogTitle></DialogHeader><form className="space-y-4" noValidate onSubmit={e=>{e.preventDefault();if(!salvar.isPending)salvar.mutate();}}>
      <div className="space-y-2"><Label htmlFor="titulo-followup">Título</Label><Input id="titulo-followup" value={(reuniao||acao)?.titulo??''} onChange={e=>reuniao?setReuniao({...reuniao,titulo:e.target.value}):setAcao({...acao,titulo:e.target.value})} /></div>
      {reuniao ? <><div className="space-y-2"><Label htmlFor="data-reuniao">Data e hora</Label><Input id="data-reuniao" type="datetime-local" value={reuniao.data??''} onChange={e=>setReuniao({...reuniao,data:e.target.value})}/></div>{(['participantes','pauta','ata'] as const).map(k=><div key={k} className="space-y-2"><Label htmlFor={k}>{k==='ata'?'Ata / Decisões':k==='pauta'?'Pauta':'Participantes'}</Label><Textarea id={k} value={reuniao[k]??''} onChange={e=>setReuniao({...reuniao,[k]:e.target.value})}/></div>)}</> : <>{select('Responsável',acao?.responsavel_id??'',responsaveis,v=>setAcao({...acao,responsavel_id:v}))}<div className="space-y-2"><Label htmlFor="prazo-acao">Prazo</Label><Input id="prazo-acao" type="date" value={acao?.prazo??''} onChange={e=>setAcao({...acao,prazo:e.target.value})}/></div>{select('Reunião vinculada',acao?.reuniao_id||'nenhuma',[{id:'nenhuma',nome:'Sem reunião'},...reunioes.map(r=>({id:r.id,nome:r.titulo}))],v=>setAcao({...acao,reuniao_id:v==='nenhuma'?null:v}))}{select('Prioridade',acao?.prioridade??'media',[{id:'baixa',nome:'Baixa'},{id:'media',nome:'Média'},{id:'alta',nome:'Alta'}],v=>setAcao({...acao,prioridade:v}))}{select('Status da ação',acao?.status??'pendente',[{id:'pendente',nome:'Pendente'},{id:'em_andamento',nome:'Em andamento'},{id:'concluida',nome:'Concluída'}],v=>setAcao({...acao,status:v}))}<div className="space-y-2"><Label htmlFor="obs-acao">Observação</Label><Textarea id="obs-acao" value={acao?.observacao??''} onChange={e=>setAcao({...acao,observacao:e.target.value})}/></div></>}
      <Button type="submit" disabled={salvar.isPending} className="w-full">{salvar.isPending?'Salvando...':'Salvar'}</Button>
    </form></DialogContent></Dialog>
  </div>;
}