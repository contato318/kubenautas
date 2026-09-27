import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { findLesson, modules } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';
import Markdown from '../components/Markdown';
import Quiz from '../components/Quiz';
import SimulatorHost from '../components/simulators/SimulatorHost';
import NotFoundPage from './NotFoundPage';

export default function LessonPage() {
  const { moduleId = '', slug = '' } = useParams();
  const found = findLesson(moduleId, slug);
  const { progress, recordQuiz } = useProgress();
  if (!found) return <NotFoundPage />;

  const { module, lesson, prev, next } = found;
  const key = lessonKey(module.id, lesson.slug);
  const done = !!progress.completed[key];

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-10">
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto pr-2 lg:block">
        {modules.map((m) => (
          <div key={m.id} className="mb-5">
            <div className="label mb-2">
              {m.emoji} {m.title}
            </div>
            <ul className="space-y-0.5">
              {m.lessons.map((l) => {
                const active = m.id === module.id && l.slug === lesson.slug;
                const ok = !!progress.completed[lessonKey(m.id, l.slug)];
                return (
                  <li key={l.slug}>
                    <Link
                      to={`/aprender/${m.id}/${l.slug}`}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${active ? 'bg-k8s-500/15 text-white' : 'text-tactical-dim hover:bg-tactical-raised'}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-signal-green' : active ? 'bg-k8s-400' : 'bg-tactical-line'}`} />
                      {l.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      <article className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center gap-3 font-mono text-xs text-tactical-label">
          <Link to="/trilha" className="hover:text-tactical-text">TRILHA</Link>/<span>{module.title.toUpperCase()}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lesson.minutes} min</span>
          {done && <span className="flex items-center gap-1 text-signal-green"><CheckCircle2 className="h-3 w-3" /> concluída</span>}
        </div>

        <div className="max-w-3xl">
          <Markdown>{lesson.content}</Markdown>
        </div>

        {lesson.simulator && (
          <section className="mt-10">
            <div className="label mb-3">🧪 Simulador</div>
            <SimulatorHost id={lesson.simulator} />
          </section>
        )}

        <section className="mt-12 max-w-3xl">
          <div className="label mb-3">✅ Teste seus conhecimentos</div>
          <Quiz key={key} questions={lesson.quiz} title={`Quiz · ${lesson.title}`} onFinish={(s) => recordQuiz(key, s)} />
        </section>

        <nav className="mt-12 flex max-w-3xl justify-between gap-4 border-t border-tactical-border pt-6">
          {prev ? (
            <Link to={`/aprender/${prev.module.id}/${prev.lesson.slug}`} className="btn-ghost">
              <ArrowLeft className="h-4 w-4" /> {prev.lesson.title}
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/aprender/${next.module.id}/${next.lesson.slug}`} className="btn-primary">
              {next.lesson.title} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link to="/prova" className="btn-primary">
              Prova final <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
