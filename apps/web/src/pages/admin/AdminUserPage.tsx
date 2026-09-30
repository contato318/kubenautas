import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Award, BookOpen, ChevronDown, Clock3, FlaskConical, GraduationCap, RefreshCw, UserRound } from 'lucide-react';
import { learningCatalog, type ActivityKind, type AdminActivityResponse, type AdminUserDetail, type UserActivity } from '@jack-academy/contracts';
import { useAdminResource } from '../../hooks/useAdminResource';
import { AdminFeedback, AdminPagination, AdminUserStatus, adminDate, percent } from '../../components/admin/AdminUi';
import ProgressMeter from '../../components/ProgressMeter';

const lessonTitles = new Map<string,string>(learningCatalog.modules.flatMap(module=>module.lessons.map(lesson=>[lesson.key,lesson.title] as const)));
const caseTitles = new Map<string,string>(learningCatalog.cases.map(item=>[item.id,item.title]));
const simulatorTitles = new Map<string,string>(learningCatalog.simulators.map(item=>[item.id,item.title]));
const activityLabels: Record<ActivityKind,string> = {lesson_opened:'Abriu uma lição',simulator_opened:'Abriu um simulador',case_opened:'Abriu um estudo de caso',exam_started:'Iniciou a prova final',quiz_submitted:'Respondeu um quiz',exam_submitted:'Finalizou a prova final',case_answered:'Respondeu um estudo de caso',certificate_issued:'Emitiu o certificado',progress_reset:'Reiniciou o progresso'};
function activityTarget(event:UserActivity) {
  if (!event.target || event.target==='final') return null;
  const catalog = event.kind.startsWith('case_') ? caseTitles : event.kind==='simulator_opened' ? simulatorTitles : lessonTitles;
  return catalog.get(event.target) ?? (event.kind==='certificate_issued' ? 'Certificado de aprovação' : event.target);
}

export default function AdminUserPage() {
  const { id } = useParams();
  const location = useLocation();
  const listSearch = typeof location.state?.listSearch === 'string' ? location.state.listSearch : '';
  const [tab,setTab]=useState<'trail'|'cases'|'history'>('trail');
  const [page,setPage]=useState(1);
  useEffect(()=>{setTab('trail');setPage(1);},[id]);
  const {data,loading,error,reload}=useAdminResource<AdminUserDetail>(`admin/users/${encodeURIComponent(id ?? '')}`);
  const history=useAdminResource<AdminActivityResponse>(tab==='history'?`admin/users/${encodeURIComponent(id ?? '')}/activity?page=${page}&pageSize=20`:null);
  const refresh=()=>{reload();history.reload();};
  const answeredCases = Object.entries(data?.progress.cases ?? {}).sort((a,b)=>b[1].at.localeCompare(a[1].at));

  return <>
    <Link to={`/admin/usuarios${listSearch ? `?${listSearch}` : ''}`} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-tactical-dim hover:text-white"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Voltar aos usuários</Link>
    <AdminFeedback loading={loading} error={error} reload={reload} />
    {data && <>
      <header className="rounded-2xl border border-k8s-400/20 bg-gradient-to-br from-[#12213a] to-tactical-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex min-w-0 flex-1 items-start gap-4"><span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-k8s-500/15 text-k8s-400 sm:flex"><UserRound aria-hidden="true" className="h-6 w-6" /></span><div className="min-w-0"><p className="label mb-2">Acompanhamento individual</p><h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{data.user.name}</h1><p className="mt-2 break-all text-sm text-tactical-dim">{data.user.email ?? 'E-mail não informado pelo provedor'}</p><div className="mt-4"><AdminUserStatus user={data.user} /></div></div></div><button type="button" onClick={refresh} className="btn-ghost min-h-11"><RefreshCw aria-hidden="true" className="h-4 w-4" />Atualizar</button></div>
        <dl className="mt-6 grid gap-5 border-t border-white/10 pt-5 text-xs sm:grid-cols-2 lg:grid-cols-4">{[{label:'Cadastro',value:adminDate(data.user.createdAt,true)},{label:'Último login',value:adminDate(data.user.lastLoginAt,true)},{label:'Última atividade',value:adminDate(data.user.lastActivityAt,true)},{label:'Conta',value:`${data.user.provider==='google'?'Google':'GitHub'} · ${data.user.welcomeCompleted?'Boas-vindas concluídas':'Boas-vindas pendentes'}`}].map(item=><div key={item.label}><dt className="text-tactical-label">{item.label}</dt><dd className="mt-2 leading-5">{item.value}</dd></div>)}</dl>
      </header>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-tactical-border bg-tactical-surface p-4 sm:p-5">
          <p className="text-2xl font-semibold tabular-nums">{data.user.completedLessons}/{data.totalLessons}</p>
          <p className="mt-2 text-xs leading-5 text-tactical-label">Lições concluídas</p>
          <div className="mt-3"><ProgressMeter label="Progresso total na trilha" done={data.user.completedLessons} total={data.totalLessons} color="green" /></div>
        </div>
        {[{label:'Quizzes respondidos',value:data.user.attemptedLessons},{label:'Casos respondidos',value:data.user.answeredCases},{label:'Simuladores abertos',value:data.visits.simulators}].map(item=><div key={item.label} className="rounded-xl border border-tactical-border bg-tactical-surface p-4 sm:p-5"><p className="text-2xl font-semibold">{item.value}</p><p className="mt-2 text-xs leading-5 text-tactical-label">{item.label}</p></div>)}
      </div>
      <section aria-labelledby="admin-exam-title" className="mt-6 grid gap-6 rounded-xl border border-tactical-border p-5 sm:p-6 md:grid-cols-2"><div><h2 id="admin-exam-title" className="flex items-center gap-2 text-sm font-semibold"><GraduationCap aria-hidden="true" className="h-5 w-5 text-k8s-400" />Prova final</h2><p className="mt-3 text-3xl font-semibold">{percent(data.user.examBest)}</p><p className="mt-2 text-xs leading-5 text-tactical-label">{data.user.examBest === null ? 'Nenhuma prova finalizada.' : `Melhor nota registrada · ${data.user.examBest >= .7?'Aprovado':'Abaixo dos 70% necessários'}`}</p></div><div className="border-t border-tactical-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0"><h2 className="flex items-center gap-2 text-sm font-semibold"><Award aria-hidden="true" className="h-5 w-5 text-signal-amber" />Certificado</h2>{data.certificate ? <><p className="mt-3 break-words text-sm">{data.certificate.fullName}</p><p className="mt-1 text-xs text-tactical-label">Emitido em {adminDate(data.certificate.issuedAt,true)}</p><a href={data.certificate.verificationUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-k8s-400 hover:underline">Validar certificado<ArrowUpRight aria-hidden="true" className="h-4 w-4" /><span className="sr-only">(abre em nova aba)</span></a></> : <p className="mt-3 text-sm leading-6 text-tactical-dim">{(data.user.examBest ?? 0)>=.7?'Aprovação atingida. O usuário ainda não emitiu o certificado.':'Ainda não emitido.'}</p>}</div></section>

      <nav aria-label="Informações do usuário" className="mt-8 flex flex-wrap gap-2 border-b border-tactical-border pb-4">{[{id:'trail' as const,label:'Trilha',icon:BookOpen},{id:'cases' as const,label:'Casos',icon:FlaskConical},{id:'history' as const,label:'Histórico',icon:Clock3}].map(item=><button key={item.id} type="button" aria-pressed={tab===item.id} onClick={()=>setTab(item.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${tab===item.id?'bg-k8s-500/15 text-k8s-400':'text-tactical-dim hover:bg-tactical-raised'}`}><item.icon aria-hidden="true" className="h-4 w-4" />{item.label}</button>)}</nav>
      {tab==='trail' && <section aria-label="Progresso por módulo" className="mt-5 space-y-3"><p className="mb-5 text-xs leading-6 text-tactical-label">A conclusão de cada lição exige pelo menos 70% de acertos. As notas exibidas são os melhores resultados salvos.</p>{learningCatalog.modules.map(module=>{
        const done=module.lessons.filter(lesson=>data.progress.completed[lesson.key]).length;
        return <details key={module.id} className="group rounded-xl border border-tactical-border bg-tactical-surface">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{module.title}</span>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-tactical-label"><span>Lições concluídas</span><span className="shrink-0 font-medium tabular-nums text-tactical-text">{done}/{module.lessons.length}</span></div>
              <div className="mt-2"><ProgressMeter label={`Progresso em ${module.title}`} done={done} total={module.lessons.length} color="green" /></div>
            </div>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-tactical-label transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-tactical-border border-t border-tactical-border px-4">{module.lessons.map(lesson=>{const score=data.progress.quizzes[lesson.key];const at=data.progress.completed[lesson.key];return <li key={lesson.key} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-sm leading-6">{lesson.title}</p><p className={`mt-1 text-xs leading-5 ${at?'text-signal-green':'text-tactical-label'}`}>{at?`Concluída em ${adminDate(at,true)}`:score!==undefined?'Quiz respondido · aprovação ainda não atingida':'Sem resultado salvo'}</p></div><span className={`shrink-0 rounded-lg px-3 py-2 font-mono text-xs ${at?'bg-signal-green/10 text-signal-green':'bg-tactical-raised text-tactical-dim'}`}>{percent(score)}</span></li>;})}</ul>
        </details>;
      })}</section>}
      {tab==='cases' && <section aria-label="Estudos de caso respondidos" className="mt-5"><p className="mb-5 text-xs leading-6 text-tactical-label">O resultado preservado corresponde à primeira resposta em cada caso.</p>{answeredCases.length ? <ul className="divide-y divide-tactical-border rounded-xl border border-tactical-border bg-tactical-surface px-5">{answeredCases.map(([slug,answer])=><li key={slug} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0 flex-1"><h2 className="text-sm font-medium leading-6">{caseTitles.get(slug) ?? slug}</h2><p className="mt-1 text-xs text-tactical-label">{adminDate(answer.at,true)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs ${answer.correct?'bg-signal-green/10 text-signal-green':'bg-signal-amber/10 text-signal-amber'}`}>{answer.correct?'Diagnóstico correto':'Sem acerto na primeira resposta'}</span></li>)}</ul> : <p className="rounded-xl border border-dashed border-tactical-line p-6 text-sm text-tactical-dim">Nenhum estudo de caso respondido.</p>}</section>}
      {tab==='history' && <section aria-label="Histórico de atividades" className="mt-5"><p className="mb-5 text-xs leading-6 text-tactical-label">Atividades registradas desde {adminDate(data.trackingSince,true)}. Acessos anteriores a essa data não estavam sendo acompanhados. Resultados antigos continuam disponíveis nas abas Trilha e Casos.</p><AdminFeedback loading={history.loading} error={history.error} reload={history.reload} />{history.data && <>{history.data.events.length ? <ol className="divide-y divide-tactical-border rounded-xl border border-tactical-border bg-tactical-surface px-5">{history.data.events.map(event=><li key={event.id} className="flex gap-3 py-5"><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-k8s-400" /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-medium">{activityLabels[event.kind]}</h2><time dateTime={event.occurredAt} className="text-xs text-tactical-label">{adminDate(event.occurredAt,true)}</time></div>{activityTarget(event) && <p className="mt-2 break-words text-sm leading-6 text-tactical-dim">{activityTarget(event)}</p>}{event.score!==null && <p className={`mt-2 text-xs ${event.score>=.7?'text-signal-green':'text-signal-amber'}`}>Nota desta tentativa: {percent(event.score)}</p>}{event.correct!==null && <p className="mt-2 text-xs text-tactical-label">{event.correct?'Diagnóstico correto':'Resposta sem acerto'}</p>}</div></li>)}</ol> : <p className="rounded-xl border border-dashed border-tactical-line p-6 text-sm text-tactical-dim">Nenhuma atividade registrada neste histórico.</p>}<AdminPagination page={history.data.page} pageSize={history.data.pageSize} total={history.data.total} onPage={setPage} /></>}</section>}
    </>}
  </>;
}
