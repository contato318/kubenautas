import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, FlaskConical, GraduationCap, LoaderCircle, Route } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { allLessons, modules } from '../content/modules';
import { cases } from '../content/cases';
import { lessonKey } from '../hooks/useProgress';
import ProgressMeter from '../components/ProgressMeter';
import CertificateSection from '../components/CertificateSection';
import DeleteAccountSection from '../components/DeleteAccountSection';
import { useLoginPath } from '../hooks/useLoginPath';

export default function ProfilePage() {
  const { user, status, progress, refresh, accountDeleted } = useAccount();
  const login = useLoginPath();

  if (status !== 'ready') return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Meu perfil</h1>
      {status === 'loading' ? <p role="status" className="mt-6 flex items-center gap-3 text-tactical-dim"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Carregando seu perfil…</p> : <div className="mt-6"><p className="text-tactical-dim">Seu perfil está indisponível no momento.</p><button onClick={() => void refresh()} className="btn-primary mt-5 min-h-11">Tentar novamente</button></div>}
    </div>
  );
  if (!user) return <Navigate to={accountDeleted ? '/entrar?account=deleted' : login} replace />;

  const completed = allLessons.filter(({ module, lesson }) => progress.completed[lessonKey(module.id, lesson.slug)]).length;
  const completedModules = modules.filter((module) => module.lessons.every((lesson) => progress.completed[lessonKey(module.id, lesson.slug)])).length;
  const answeredCases = cases.filter((item) => progress.cases?.[item.slug]);
  const correctCases = answeredCases.filter((item) => progress.cases?.[item.slug].correct).length;
  const next = allLessons.find(({ module, lesson }) => !progress.completed[lessonKey(module.id, lesson.slug)]);
  const started = completed > 0 || Object.keys(progress.quizzes).length > 0;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'K';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="label mb-3">Seu espaço de aprendizado</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meu perfil</h1><p className="mt-3 text-sm leading-6 text-tactical-dim sm:text-base">Acompanhe sua evolução e escolha o próximo passo.</p></div>
        <Link to="/trilha" className="btn-ghost min-h-11">Ir para a trilha<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
      </div>

      <section aria-label="Sua conta" className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-k8s-400/20 bg-gradient-to-br from-[#12213a] to-tactical-surface p-5 sm:gap-5 sm:p-7">
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-k8s-400/30 bg-k8s-500/15 text-xl font-semibold text-k8s-400">{initials}</span>
        <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-semibold sm:text-2xl">{user.name}</h2>{user.email && <p className="mt-2 break-all text-sm text-tactical-dim">{user.email}</p>}</div>
        <p className="inline-flex items-center gap-2 rounded-full border border-signal-green/20 bg-signal-green/5 px-3 py-2 text-xs text-signal-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Conectado com {user.provider === 'google' ? 'Google' : 'GitHub'}</p>
      </section>

      <section aria-labelledby="profile-progress-title" className="mt-10">
        <h2 id="profile-progress-title" className="text-xl font-semibold">Seu progresso</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-tactical-border bg-tactical-surface p-5 sm:p-6">
            <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-green/10 text-signal-green"><BookOpen aria-hidden="true" className="h-5 w-5" /></span><span className="font-mono text-2xl text-signal-green">{Math.round(completed / allLessons.length * 100)}%</span></div>
            <h3 className="mt-5 text-lg font-semibold">Curso</h3><p className="mt-2 text-sm leading-6 text-tactical-dim">{completed} de {allLessons.length} lições concluídas</p>
            <div className="mt-4"><ProgressMeter label="Progresso do curso" done={completed} total={allLessons.length} color="green" /></div>
            <p className="mb-6 mt-3 text-xs leading-5 text-tactical-label">{completedModules} de {modules.length} módulos concluídos. Cada lição conta a partir de 70% de acertos no quiz.</p>
            <Link to="/trilha" className="mt-auto inline-flex min-h-11 items-center justify-between gap-3 border-t border-tactical-border pt-4 text-sm font-medium text-k8s-400 hover:underline">Ver minha trilha<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </article>
          <article className="flex flex-col rounded-xl border border-tactical-border bg-tactical-surface p-5 sm:p-6">
            <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-amber/10 text-signal-amber"><FlaskConical aria-hidden="true" className="h-5 w-5" /></span><span className="font-mono text-2xl text-signal-amber">{Math.round(answeredCases.length / cases.length * 100)}%</span></div>
            <h3 className="mt-5 text-lg font-semibold">Casos</h3><p className="mt-2 text-sm leading-6 text-tactical-dim">{answeredCases.length} de {cases.length} casos respondidos</p>
            <div className="mt-4"><ProgressMeter label="Progresso dos casos" done={answeredCases.length} total={cases.length} color="amber" /></div>
            <p className="mb-6 mt-3 text-xs leading-5 text-tactical-label">{answeredCases.length ? `${correctCases} diagnósticos corretos na primeira resposta. Revise as investigações para aprofundar seu aprendizado.` : 'Leia os sintomas, escolha seu diagnóstico e descubra como resolver cada incidente.'}</p>
            <Link to="/casos" className="mt-auto inline-flex min-h-11 items-center justify-between gap-3 border-t border-tactical-border pt-4 text-sm font-medium text-k8s-400 hover:underline">Explorar estudos de caso<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="profile-next-title" className="mt-6 grid gap-6 rounded-xl border border-tactical-border p-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="flex items-center gap-2 text-xs text-k8s-400"><Route aria-hidden="true" className="h-4 w-4" />{next ? (started ? 'Continue sua jornada' : 'Seu ponto de partida') : 'Trilha concluída'}</p>
          <h2 id="profile-next-title" className="mt-3 text-lg font-semibold">{next ? next.lesson.title : 'Você concluiu todas as lições!'}</h2>
          <p className="mt-2 text-sm leading-6 text-tactical-dim">{next ? next.lesson.summary : 'Volte aos módulos para revisar os temas ou pratique nos simuladores.'}</p>
          <Link to={next ? `/aprender/${next.module.id}/${next.lesson.slug}` : '/trilha'} className="btn-primary mt-5 min-h-11">{next ? (started ? 'Continuar aprendendo' : 'Começar a trilha') : 'Revisar a trilha'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
        <div className="border-t border-tactical-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><GraduationCap aria-hidden="true" className="h-5 w-5 text-signal-amber" />Prova final</h2>
          {progress.examBest !== undefined ? <><p className="mt-3 text-3xl font-semibold">{Math.round(progress.examBest * 100)}<span className="text-lg text-tactical-label">%</span></p><p className="mt-2 text-xs text-tactical-label">Sua melhor nota · {progress.examBest >= 0.7 ? 'Nota de aprovação atingida' : 'Aprovação a partir de 70%'}</p></> : <p className="mt-3 text-sm leading-6 text-tactical-dim">Você ainda não fez a prova. Quando estiver pronto, teste seu conhecimento de toda a trilha.</p>}
          <Link to="/prova" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-k8s-400 hover:underline">{progress.examBest !== undefined ? 'Tentar novamente' : 'Conhecer a prova'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </section>

      <CertificateSection />
      <DeleteAccountSection key={user.id} />
    </div>
  );
}
