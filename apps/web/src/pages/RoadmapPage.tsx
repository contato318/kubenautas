import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock, FlaskConical, GraduationCap, Route, UserRound } from 'lucide-react';
import { allLessons, modules } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';
import { EXAM_SIZE } from './ExamPage';
import { useAccount } from '../auth/AccountProvider';
import AccountNotice from '../components/AccountNotice';
import ProgressMeter from '../components/ProgressMeter';
import { AnimatedCollapse, NavigationHighlight } from '../components/NavigationMotion';
import type { Level } from '../types';

const levelColor = { Básico: 'text-signal-green bg-signal-green/10', Intermediário: 'text-signal-amber bg-signal-amber/10', Avançado: 'text-signal-cyan bg-signal-cyan/10' };
const levels = ['Todos', 'Básico', 'Intermediário', 'Avançado'] as const;

function readingTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${minutes}min`;
}

export default function RoadmapPage() {
  const reducedMotion = useReducedMotion();
  const { progress } = useProgress();
  const { user, status, saving, error } = useAccount();
  const [level, setLevel] = useState<Level | 'Todos'>('Todos');
  const [expanded, setExpanded] = useState<string | null>();
  const ready = status === 'ready';
  const done = allLessons.filter(({ module, lesson }) => progress.completed[lessonKey(module.id, lesson.slug)]).length;
  const next = allLessons.find(({ module, lesson }) => !progress.completed[lessonKey(module.id, lesson.slug)]);
  const openId = expanded === undefined ? (next?.module.id ?? modules[0].id) : expanded;
  const started = done > 0 || Object.keys(progress.quizzes).length > 0;
  const visibleModules = modules.filter((module) => level === 'Todos' || module.level === level);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="label mb-3">Um passo de cada vez</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Trilha de aprendizado</h1>
          <p className="mt-3 text-sm leading-6 text-tactical-dim sm:text-base">Dos primeiros containers aos desafios de Kubernetes. Escolha um módulo e aprenda no seu ritmo.</p>
        </div>
        {user && <Link to="/perfil" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-k8s-400 hover:underline"><UserRound aria-hidden="true" className="h-4 w-4" />Meu perfil</Link>}
      </div>
      {(!user || !ready || saving || error) && <div className="mt-6"><AccountNotice /></div>}

      <section aria-labelledby="next-lesson-title" className="mt-8 grid overflow-hidden rounded-2xl border border-k8s-400/25 bg-gradient-to-br from-[#12213a] to-tactical-surface md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5 sm:p-7">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-k8s-400"><Route aria-hidden="true" className="h-4 w-4" />{!ready ? 'Seu caminho de aprendizado' : !next ? 'Todas as lições concluídas' : started ? 'Seu próximo passo' : 'Comece por aqui'}</p>
          <h2 id="next-lesson-title" className="text-xl font-semibold leading-snug sm:text-2xl">{!ready ? 'Explore os módulos abaixo' : next ? next.lesson.title : 'Hora de colocar tudo à prova.'}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-tactical-dim">{!ready ? 'As lições estão disponíveis para leitura. Seu progresso aparece assim que a conta for carregada.' : next ? next.lesson.summary : 'Você percorreu toda a trilha. Faça a prova final ou abra um módulo para revisar.'}</p>
          {ready && <>
            {next && <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tactical-dim"><span>{next.module.title}</span><span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{next.lesson.minutes} min de leitura</span></p>}
            <Link to={next ? `/aprender/${next.module.id}/${next.lesson.slug}` : '/prova'} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-lg bg-k8s-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-k8s-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 sm:w-auto">{next ? (started ? 'Continuar aprendendo' : 'Começar a trilha') : 'Fazer a prova final'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </>}
        </div>
        <div className="flex flex-col justify-center border-t border-k8s-400/15 bg-black/10 p-5 sm:p-7 md:border-l md:border-t-0">
          <p className="text-sm font-medium">{user ? 'Seu avanço na trilha' : 'O que vem pela frente'}</p>
          {user && ready ? <>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(done / allLessons.length * 100)}<span className="text-lg text-tactical-label">%</span></p>
            <div className="mt-4"><ProgressMeter label="Progresso na trilha" done={done} total={allLessons.length} /></div>
            <p className="mt-3 text-xs text-tactical-dim">{done} de {allLessons.length} lições concluídas</p>
          </> : <p className="mt-3 text-xl font-semibold">{modules.length} módulos · {allLessons.length} lições</p>}
          <p className="mt-4 text-xs leading-5 text-tactical-label">Conclua cada lição com pelo menos 70% de acertos no quiz. Todos os módulos estão disponíveis.</p>
        </div>
      </section>

      <section aria-labelledby="roadmap-modules-title" className="mt-10 sm:mt-12">
        <h2 id="roadmap-modules-title" className="text-xl font-semibold">Explore os módulos</h2>
        <p className="mt-2 text-sm leading-6 text-tactical-dim">Abra um módulo para ver suas lições. Siga a ordem sugerida ou vá direto ao assunto que precisa.</p>
        <div role="group" aria-label="Filtrar módulos por nível" className="mt-5 flex flex-wrap gap-2">
          <LayoutGroup id="roadmap-levels">
            {levels.map((item) => <button key={item} type="button" aria-pressed={level === item} aria-controls="roadmap-modules" onClick={() => { setLevel(item); setExpanded(item === 'Todos' ? next?.module.id ?? modules[0].id : modules.find((module) => module.level === item)?.id); }} className={`relative isolate min-h-11 rounded-lg border px-4 py-2 text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-k8s-400 ${level === item ? 'border-k8s-400/50 text-k8s-400' : 'border-tactical-border text-tactical-dim hover:border-tactical-label'}`}>{level === item && <NavigationHighlight />}{item}<span className="ml-2 text-xs opacity-70">{' '}{item === 'Todos' ? modules.length : modules.filter((module) => module.level === item).length}</span></button>)}
          </LayoutGroup>
        </div>

        <motion.ol key={level} id="roadmap-modules" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }} className="mt-6 space-y-4">
          {visibleModules.map((module) => {
            const index = modules.indexOf(module);
            const isOpen = openId === module.id;
            const completed = module.lessons.filter((lesson) => progress.completed[lessonKey(module.id, lesson.slug)]).length;
            const isComplete = completed === module.lessons.length;
            const isNext = ready && next?.module.id === module.id;
            return (
              <li key={module.id} className={`overflow-hidden rounded-xl border bg-tactical-surface transition-colors motion-reduce:transition-none ${isOpen ? 'border-k8s-400/40' : 'border-tactical-border'}`}>
                <h3>
                  <button id={`roadmap-trigger-${module.id}`} type="button" aria-expanded={isOpen} aria-controls={`roadmap-lessons-${module.id}`} onClick={() => setExpanded(isOpen ? null : module.id)} className="group flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-tactical-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-k8s-400 sm:gap-5 sm:p-6">
                    <span aria-hidden="true" className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-xs sm:h-12 sm:w-12 sm:text-sm ${isComplete && ready ? 'border-signal-green/30 bg-signal-green/10 text-signal-green' : 'border-tactical-line bg-tactical-raised text-k8s-400'}`}>{isComplete && ready ? <CheckCircle2 className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[11px] font-medium ${levelColor[module.level]}`}>{module.level}</span>{isNext && <span className="text-[11px] font-medium text-k8s-400">{started ? 'Em foco' : 'Ponto de partida'}</span>}{isComplete && ready && <span className="text-[11px] text-signal-green">Concluído</span>}</span>
                      <span className="block text-base font-semibold leading-snug text-tactical-text group-hover:text-white sm:text-lg">{module.title}</span>
                      <span className="mt-2 block text-sm font-normal leading-6 text-tactical-dim">{module.description}</span>
                      <span className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-normal text-tactical-label"><span className="inline-flex items-center gap-1.5"><BookOpen aria-hidden="true" className="h-3.5 w-3.5" />{module.lessons.length} lições</span><span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{readingTime(module.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0))} de leitura</span>{user && ready && <span className={isComplete ? 'text-signal-green' : 'text-tactical-dim'}>{completed}/{module.lessons.length} concluídas</span>}</span>
                    </span>
                    <motion.span aria-hidden="true" initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} className="mt-2 shrink-0 text-tactical-label"><ChevronDown className="h-5 w-5" /></motion.span>
                  </button>
                </h3>
                <AnimatedCollapse id={`roadmap-lessons-${module.id}`} labelledBy={`roadmap-trigger-${module.id}`} open={isOpen}>
                  <div className="border-t border-tactical-border px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <p className="mb-4 text-xs leading-5 text-tactical-label">Lições do módulo · selecione uma para começar ou revisar.</p>
                    <ol className="grid gap-3 md:grid-cols-2">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const key = lessonKey(module.id, lesson.slug);
                        const finished = ready && !!progress.completed[key];
                        const score = ready ? progress.quizzes[key] : undefined;
                        const recommended = ready && next?.module.id === module.id && next.lesson.slug === lesson.slug;
                        return <li key={key}><Link to={`/aprender/${module.id}/${lesson.slug}`} className={`group flex h-full flex-col rounded-xl border p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 sm:p-5 ${recommended ? 'border-k8s-400/40 bg-k8s-500/5 hover:bg-k8s-500/10' : 'border-tactical-border bg-tactical-bg/50 hover:border-tactical-label'}`}>
                          <span className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="font-mono text-tactical-label">LIÇÃO {String(lessonIndex + 1).padStart(2, '0')}</span>{finished ? <span className="inline-flex items-center gap-1 text-signal-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Concluída</span> : recommended ? <span className="text-k8s-400">Próxima lição</span> : null}</span>
                          <span className="mt-3 text-sm font-semibold leading-6 group-hover:text-k8s-400 sm:text-base">{lesson.title}</span>
                          <span className="mb-4 mt-2 text-sm leading-6 text-tactical-dim">{lesson.summary}</span>
                          <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-tactical-border pt-3 text-xs text-tactical-label"><span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{lesson.minutes} min</span>{(lesson.simulator || lesson.extraSimulators?.length) && <span className="inline-flex items-center gap-1 text-k8s-400"><FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />Prática</span>}{score !== undefined && <span>Quiz: {Math.round(score * 100)}%</span>}<ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-k8s-400" /></span>
                        </Link></li>;
                      })}
                    </ol>
                  </div>
                </AnimatedCollapse>
              </li>
            );
          })}
        </motion.ol>
      </section>

      <section aria-labelledby="roadmap-exam-title" className="mt-8 flex flex-col items-start gap-5 rounded-xl border border-signal-amber/25 bg-signal-amber/5 p-5 sm:flex-row sm:items-center sm:p-7">
        <GraduationCap aria-hidden="true" className="h-9 w-9 shrink-0 text-signal-amber" /><div className="flex-1"><h2 id="roadmap-exam-title" className="text-lg font-semibold">Seu desafio final</h2><p className="mt-2 text-sm leading-6 text-tactical-dim">{EXAM_SIZE} perguntas para revisar toda a jornada. Recomendado ao terminar a trilha, disponível quando você quiser.</p></div><Link to="/prova" className="btn-ghost min-h-11 shrink-0">Ver prova final<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
      </section>
    </div>
  );
}
