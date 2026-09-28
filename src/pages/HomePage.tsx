import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, Layers, GraduationCap, Activity } from 'lucide-react';
import { modules, allLessons } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';
import { Logo } from '../components/Layout';
import { simulators } from '../components/simulators/registry';
import { cases } from '../content/cases';
import jackExpertsLogo from '../assets/jack-experts-white.png';

export default function HomePage() {
  const { progress } = useProgress();
  const done = Object.keys(progress.completed).length;
  const nextLesson = allLessons.find(({ module, lesson }) => !progress.completed[lessonKey(module.id, lesson.slug)]);
  const quizScores = Object.values(progress.quizzes);
  const avg = quizScores.length ? Math.round((quizScores.reduce((a, b) => a + b, 0) / quizScores.length) * 100) : 0;
  const totalQuestions = allLessons.reduce((n, x) => n + x.lesson.quiz.length, 0);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-tactical-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'linear-gradient(to right,#326ce5 1px,transparent 1px),linear-gradient(to bottom,#326ce5 1px,transparent 1px)', backgroundSize: '32px 32px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="mb-6 flex items-center gap-3">
            <Logo size={44} />
            <span className="label">// desafios online · {allLessons.length} lições · {simulators.length} simuladores · {cases.length} estudos de caso</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Kubernetes,{' '}
            <span className="inline-flex items-center gap-3 align-middle text-k8s-400 md:gap-4">
              <span>com a</span>
              <img
                src={jackExpertsLogo}
                alt="Jack Experts"
                width={3937}
                height={1985}
                className="h-auto w-24 md:w-32"
              />
              <span className="sr-only">.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-tactical-dim">
            Uma plataforma gratuita e interativa para dominar Kubernetes: lições objetivas, simuladores onde você mata Pods e vê o cluster se curar, um terminal
            <code className="mx-1 rounded bg-tactical-raised px-1.5 font-mono text-signal-amber">kubectl</code>
            no navegador e quizzes para fixar o conteúdo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {nextLesson ? (
              <Link to={`/aprender/${nextLesson.module.id}/${nextLesson.lesson.slug}`} className="btn-primary px-6 py-3 text-sm">
                {done ? 'Continuar' : 'Começar agora'} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/prova" className="btn-primary px-6 py-3 text-sm">
                Fazer a prova final <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link to="/simuladores/terminal" className="btn-ghost px-6 py-3 text-sm">
              <Terminal className="h-4 w-4" /> Abrir terminal kubectl
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={<Layers className="h-4 w-4" />} label="Lições concluídas" value={`${done}/${allLessons.length}`} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Média nos quizzes" value={`${avg}%`} />
          <Stat icon={<GraduationCap className="h-4 w-4" />} label="Prova final" value={progress.examBest !== undefined ? `${Math.round(progress.examBest * 100)}%` : '—'} />
          <Stat icon={<Terminal className="h-4 w-4" />} label="Perguntas no banco" value={`${totalQuestions}`} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="label mb-1">Trilha de aprendizado</div>
            <h2 className="text-2xl font-bold">Módulos</h2>
          </div>
          <Link to="/trilha" className="font-mono text-xs uppercase text-k8s-400 hover:underline">
            ver trilha completa →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => {
            const c = m.lessons.filter((l) => progress.completed[lessonKey(m.id, l.slug)]).length;
            return (
              <Link key={m.id} to={`/aprender/${m.id}/${m.lessons[0].slug}`} className="panel group p-5 transition-colors hover:border-k8s-500">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="font-mono text-xs text-tactical-label">MÓDULO {String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="text-lg font-semibold group-hover:text-k8s-400">{m.title}</h3>
                <p className="mt-1 text-sm text-tactical-dim">{m.description}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded bg-tactical-raised">
                    <div className="h-full bg-signal-green" style={{ width: `${(c / m.lessons.length) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-tactical-label">
                    {c}/{m.lessons.length}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="panel flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
          <div>
            <div className="label mb-1">Troubleshooting de verdade</div>
            <h2 className="text-xl font-bold">{cases.length} estudos de caso de problemas recorrentes</h2>
            <p className="mt-1 text-sm text-tactical-dim">CrashLoopBackOff, OOMKilled, DNS de 5 segundos, 502 no deploy, drain travado… diagnostique antes de ver a solução.</p>
          </div>
          <Link to="/casos" className="btn-primary px-6 py-3 text-sm">
            Ver casos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-tactical-border bg-tactical-surface/50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="label mb-1">Aprenda executando</div>
          <h2 className="mb-6 text-2xl font-bold">Simuladores interativos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {simulators.map((s) => (
              <Link key={s.id} to={`/simuladores/${s.id}`} className="panel p-5 transition-colors hover:border-k8s-500">
                <div className="mb-2 text-2xl">{s.emoji}</div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-tactical-dim">{s.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="label mb-2 flex items-center gap-2">
        {icon} {label}
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
