import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { modules } from '../content/modules';
import { learningStages } from '../content/home';
import { lessonKey, type Progress } from '../hooks/useProgress';

function readingTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${minutes}min`;
}

export default function HomeModules({ progress }: { progress: Progress }) {
  const initialModule = modules.find((module) => module.lessons.some((lesson) => !progress.completed[lessonKey(module.id, lesson.slug)])) ?? modules[0];
  const [level, setLevel] = useState(initialModule.level);
  const [expanded, setExpanded] = useState<string | null>(initialModule.id);
  const visibleModules = modules.filter((module) => module.level === level);
  const stage = learningStages.find((item) => item.level === level)!;

  return (
    <section id="modulos" aria-labelledby="modules-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 md:py-20">
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="label mb-3">Uma trilha, do básico ao avançado</p>
          <h2 id="modules-title" className="text-3xl font-bold tracking-tight md:text-4xl">Saiba o que aprender em cada etapa.</h2>
          <p className="mt-4 leading-relaxed text-tactical-dim">Comece pelos fundamentos ou escolha o assunto que precisa aprofundar. Abra um módulo para conhecer as lições antes de começar.</p>
        </div>
        <Link to="/trilha" className="btn-ghost shrink-0">Ver trilha completa <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <div>
          <div role="group" aria-label="Nível dos módulos" className="space-y-2">
            {learningStages.map((item, index) => (
              <button
                key={item.level}
                type="button"
                aria-pressed={level === item.level}
                aria-controls="home-module-list"
                onClick={() => { setLevel(item.level); setExpanded(modules.find((module) => module.level === item.level)!.id); }}
                className={`flex w-full items-center gap-4 rounded-r-lg border-l-2 px-4 py-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 ${level === item.level ? 'border-k8s-400 bg-k8s-500/10 text-white' : 'border-tactical-border text-tactical-dim hover:border-tactical-label hover:bg-tactical-surface'}`}
              >
                <span className="font-mono text-sm text-k8s-400">0{index + 1}</span>
                <span>
                  <span className="block text-xs text-tactical-label">{item.level} · {modules.filter((module) => module.level === item.level).length} módulos</span>
                  <span className="mt-1 block font-semibold">{item.title}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-tactical-dim">{stage.description}</p>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-tactical-label"><Clock className="mt-0.5 h-4 w-4 shrink-0" />Os tempos indicam a leitura estimada. Reserve também um tempo para os quizzes e a prática.</p>
        </div>

        <div id="home-module-list" className="min-w-0 border-t border-tactical-border">
          {visibleModules.map((module) => {
            const isOpen = expanded === module.id;
            const completed = module.lessons.filter((lesson) => progress.completed[lessonKey(module.id, lesson.slug)]).length;
            const next = module.lessons.find((lesson) => !progress.completed[lessonKey(module.id, lesson.slug)]);
            const target = next ?? module.lessons[0];
            const minutes = module.lessons.reduce((total, lesson) => total + lesson.minutes, 0);

            return (
              <article key={module.id} className="border-b border-tactical-border">
                <h3>
                  <button
                    id={`module-trigger-${module.id}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`module-preview-${module.id}`}
                    onClick={() => setExpanded(isOpen ? null : module.id)}
                    className="group flex w-full items-start gap-4 py-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"
                  >
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-tactical-border bg-tactical-surface text-xl">{module.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-lg font-semibold transition-colors group-hover:text-k8s-400 ${isOpen ? 'text-k8s-400' : ''}`}>{module.title}</span>
                      <span className="mt-2 block text-sm font-normal leading-relaxed text-tactical-dim">{module.description}</span>
                      <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-normal text-tactical-label">
                        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{module.lessons.length} lições</span>
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{readingTime(minutes)} de leitura</span>
                        {completed > 0 && <span className="inline-flex items-center gap-1.5 text-signal-green"><CheckCircle2 className="h-3.5 w-3.5" />{completed}/{module.lessons.length} concluídas</span>}
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className={`mt-1 h-5 w-5 shrink-0 text-tactical-label transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                <div id={`module-preview-${module.id}`} role="region" aria-labelledby={`module-trigger-${module.id}`} hidden={!isOpen} className="pb-6 sm:pl-[60px]">
                  <p className="label mb-4">Suas primeiras lições neste módulo</p>
                  <ol className="space-y-4">
                    {module.lessons.slice(0, 3).map((lesson, index) => (
                      <li key={lesson.slug} className="flex gap-3">
                        <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-k8s-400">0{index + 1}</span>
                        <div>
                          <Link to={`/aprender/${module.id}/${lesson.slug}`} className="text-sm font-medium hover:text-k8s-400 hover:underline">{lesson.title}</Link>
                          <p className="mt-1 text-sm leading-relaxed text-tactical-dim">{lesson.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {module.lessons.length > 3 && <p className="mt-4 text-xs text-tactical-label">E mais {module.lessons.length - 3} lições na trilha completa.</p>}
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Link to={`/aprender/${module.id}/${target.slug}`} className="btn-primary">
                      {next ? (completed ? 'Continuar módulo' : 'Começar módulo') : 'Revisar módulo'} <ArrowRight className="h-4 w-4" />
                    </Link>
                    <span className="text-xs text-tactical-label">Quiz em cada lição</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
