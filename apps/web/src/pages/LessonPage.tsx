import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Target } from 'lucide-react';
import { findLesson, modules } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';
import Markdown from '../components/Markdown';
import Quiz from '../components/Quiz';
import SimulatorHost from '../components/simulators/SimulatorHost';
import { simulators } from '../components/simulators/registry';
import NotFoundPage from './NotFoundPage';
import { useActivityVisit } from '../hooks/useActivity';

export default function LessonPage() {
  const { moduleId = '', slug = '' } = useParams();
  const found = findLesson(moduleId, slug);
  const { progress, recordQuiz } = useProgress();
  useActivityVisit('lesson_opened', found ? `${moduleId}/${slug}` : undefined);
  if (!found) return <NotFoundPage />;

  const { module, lesson, prev, next } = found;
  const key = lessonKey(module.id, lesson.slug);
  const done = !!progress.completed[key];
  const best = progress.quizzes[key];

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

        {[lesson.simulator, ...(lesson.extraSimulators ?? [])].filter((id) => id !== undefined).map((id) => (
          <section key={id} className="mt-10">
            <div className="label mb-3">🧪 Simulador · {simulators.find((s) => s.id === id)?.title}</div>
            <SimulatorHost id={id} />
          </section>
        ))}

        <section className="mt-12 max-w-3xl">
          <div className="label mb-3">✅ Teste seus conhecimentos</div>
          {best !== undefined ? (
            <div role="status" aria-label="Resultado salvo desta lição" className="mb-4 flex items-start gap-3 rounded-lg border border-tactical-border bg-tactical-surface p-4">
              {done ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-signal-green" /> : <Target aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-signal-amber" />}
              <div>
                <p className="text-sm font-medium">Melhor nota salva: <strong className={done ? 'text-signal-green' : 'text-signal-amber'}>{Math.round(best * 100)}%</strong></p>
                <p className="mt-1 text-sm leading-6 text-tactical-dim">{done ? 'Lição concluída. Você pode refazer o quiz para revisar; sua melhor nota será mantida.' : `Sua tentativa foi registrada. Para concluir a lição, acerte pelo menos ${Math.ceil(lesson.quiz.length * 0.7)} de ${lesson.quiz.length} perguntas (70%). Você pode tentar novamente abaixo.`}</p>
              </div>
            </div>
          ) : <p className="mb-4 text-sm leading-6 text-tactical-dim">Acerte pelo menos {Math.ceil(lesson.quiz.length * 0.7)} de {lesson.quiz.length} perguntas (70%) para concluir esta lição.</p>}
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
