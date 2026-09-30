import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpenCheck, GraduationCap, RefreshCw, Route, Users } from 'lucide-react';
import type { AdminOverview } from '@jack-academy/contracts';
import { useAdminResource } from '../../hooks/useAdminResource';
import { AdminFeedback, adminDate } from '../../components/admin/AdminUi';

export default function AdminOverviewPage() {
  const { data, loading, error, reload } = useAdminResource<AdminOverview>('admin/overview');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = data?.registrations.find(day => day.date === selectedDay);
  const recent = data?.registrations.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const max = Math.max(1, ...(data?.registrations.map(day => day.count) ?? []));

  return <>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Visão geral</h1><p className="mt-3 text-sm leading-6 text-tactical-dim">Acompanhe as contas cadastradas e a evolução do aprendizado.</p></div><button type="button" onClick={reload} disabled={loading} className="btn-ghost min-h-11"><RefreshCw aria-hidden="true" className="h-4 w-4" />Atualizar dados</button></header>
    <AdminFeedback loading={loading} error={error} reload={reload} />
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {label:'Usuários cadastrados',value:data.registered,description:'Contas criadas por Google ou GitHub',icon:Users,stage:'all',tone:'text-k8s-400'},
          {label:'Iniciaram o aprendizado',value:data.started,description:'Acessaram conteúdo ou salvaram resultados',icon:Route,stage:'started',tone:'text-signal-cyan'},
          {label:'Concluíram a trilha',value:data.completed,description:`Todas as ${data.totalLessons} lições concluídas`,icon:BookOpenCheck,stage:'completed',tone:'text-signal-green'},
          {label:'Emitiram certificado',value:data.certified,description:'Documentos emitidos após a aprovação',icon:Award,stage:'certified',tone:'text-signal-amber'},
        ].map(item=><Link key={item.stage} to={`/admin/usuarios?stage=${item.stage}`} className="group rounded-2xl border border-tactical-border bg-tactical-surface p-5 transition-colors hover:border-k8s-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400"><div className="flex items-center justify-between"><item.icon aria-hidden="true" className={`h-5 w-5 ${item.tone}`} /><ArrowRight aria-hidden="true" className="h-4 w-4 text-tactical-label group-hover:text-k8s-400" /></div><p className="mt-5 text-4xl font-semibold tracking-tight">{item.value.toLocaleString('pt-BR')}</p><h2 className="mt-3 text-sm font-medium">{item.label}</h2><p className="mt-2 text-xs leading-5 text-tactical-label">{item.description}</p></Link>)}
      </div>
      <section aria-labelledby="registration-chart-title" className="mt-7 rounded-2xl border border-tactical-border bg-tactical-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="registration-chart-title" className="text-lg font-semibold">Novos cadastros</h2><p className="mt-2 text-xs text-tactical-label">Últimos 30 dias · horário de Brasília</p></div><p className="text-sm text-tactical-dim"><strong className="text-xl text-white">{recent}</strong> novas contas no período</p></div>
        <p role="status" className="mt-6 min-h-5 text-xs text-k8s-400">{selected ? `${adminDate(`${selected.date}T12:00:00-03:00`)} · ${selected.count} ${selected.count === 1 ? 'cadastro' : 'cadastros'}` : 'Selecione uma barra para conferir o dia.'}</p>
        <div aria-label="Cadastros por dia" className="mt-4 flex h-40 items-end gap-1 border-b border-tactical-line sm:gap-2">
          {data.registrations.map(day=><button key={day.date} type="button" aria-label={`${adminDate(`${day.date}T12:00:00-03:00`)}: ${day.count} cadastros`} aria-pressed={selectedDay === day.date} onClick={() => setSelectedDay(day.date)} onFocus={() => setSelectedDay(day.date)} className="group flex h-full min-w-0 flex-1 items-end rounded-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-k8s-400"><span style={{height:day.count ? `${Math.max(4,day.count / max * 100)}%` : '2px'}} className={`w-full rounded-t transition-colors ${day.date === selectedDay ? 'bg-signal-cyan' : day.count ? 'bg-k8s-500 group-hover:bg-k8s-400' : 'bg-tactical-line'}`} /></button>)}
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-tactical-label"><span>{data.registrations[0] && adminDate(`${data.registrations[0].date}T12:00:00-03:00`)}</span><span>Hoje</span></div>
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><section className="flex items-start gap-4 rounded-xl border border-tactical-border p-5"><GraduationCap aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-signal-green" /><div><h2 className="text-base font-semibold">{data.examPassed} {data.examPassed === 1 ? 'usuário aprovado' : 'usuários aprovados'} na prova final</h2><p className="mt-2 text-sm leading-6 text-tactical-dim">Melhor nota de pelo menos 70%. A prova pode ser feita antes de concluir toda a trilha.</p></div></section><section className="rounded-xl border border-tactical-border p-5"><h2 className="text-base font-semibold">{Math.max(0,data.registered - data.started)} contas sem início registrado</h2><p className="mt-2 text-sm leading-6 text-tactical-dim">Contas que ainda não têm acesso a conteúdo ou resultado de aprendizado registrado.</p><Link to="/admin/usuarios?stage=not_started" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-k8s-400 hover:underline">Ver usuários<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></section></div>
      <p className="mt-6 text-xs leading-6 text-tactical-label">Os indicadores consideram todas as contas, inclusive administradores. Resultados antigos entram nas contagens; o histórico de acessos começa em {adminDate(data.trackingSince, true)}. Abertura de conteúdo não significa conclusão.</p>
    </>}
  </>;
}
