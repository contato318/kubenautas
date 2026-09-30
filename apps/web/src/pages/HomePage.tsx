import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, Layers, GraduationCap, Activity, BookOpen, FlaskConical, CheckCircle2 } from 'lucide-react';
import { modules, allLessons } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';
import { Logo } from '../components/Brand';
import { simulators } from '../components/simulators/registry';
import { cases } from '../content/cases';
import HomeModules from '../components/HomeModules';
import HomeSimulators from '../components/HomeSimulators';
import jackExpertsLogo from '../assets/jack-experts-white.png';
import jackAcademyGiraffe from '../assets/jack-academy-giraffe.png';

export default function HomePage() {
  const { progress } = useProgress();
  const done = allLessons.filter(({ module, lesson }) => progress.completed[lessonKey(module.id, lesson.slug)]).length;
  const nextLesson = allLessons.find(({ module, lesson }) => !progress.completed[lessonKey(module.id, lesson.slug)]);
  const quizScores = Object.values(progress.quizzes);
  const avg = quizScores.length ? Math.round((quizScores.reduce((a, b) => a + b, 0) / quizScores.length) * 100) : null;
  const hasProgress = done > 0 || quizScores.length > 0 || progress.examBest !== undefined || Object.keys(progress.cases ?? {}).length > 0;
  const startLink = nextLesson ? `/aprender/${nextLesson.module.id}/${nextLesson.lesson.slug}` : '/prova';
  const totalQuestions = allLessons.reduce((n, x) => n + x.lesson.quiz.length, 0);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-tactical-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'linear-gradient(to right,#326ce5 1px,transparent 1px),linear-gradient(to bottom,#326ce5 1px,transparent 1px)', backgroundSize: '32px 32px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <Logo size={44} />
              <span className="label">// aprendizado gratuito · no seu ritmo</span>
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
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-tactical-label"><span>Login com Google ou GitHub</span><span>Laboratórios no navegador</span><span>Progresso salvo na sua conta</span></p>
          </div>
          <div className="pointer-events-none relative isolate hidden w-full max-w-md justify-self-center select-none lg:block">
            <div
              aria-hidden="true"
              className="absolute bottom-[3%] left-1/2 h-[17%] w-[82%] -translate-x-1/2 rounded-[50%] border border-k8s-400/30 bg-gradient-to-b from-k8s-400/30 to-k8s-600/50"
            />
            <img
              src={jackAcademyGiraffe}
              alt="Girafa com fones azuis usando um notebook e apresentando um cluster Kubernetes"
              width={1254}
              height={1254}
              className="relative h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section aria-label="Conteúdo da plataforma" className="mx-auto max-w-7xl px-4">
        <dl className="grid grid-cols-2 border-b border-tactical-border py-8 md:grid-cols-4">
          {[
            { value: modules.length, label: 'módulos do básico ao avançado' },
            { value: allLessons.length, label: 'lições com quiz e explicação' },
            { value: simulators.length, label: 'simuladores para experimentar' },
            { value: cases.length, label: 'casos para treinar o diagnóstico' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col px-3 py-4 first:pl-0 md:border-l md:border-tactical-border md:px-6 md:first:border-l-0">
              <dt className="mt-2 max-w-[180px] text-sm leading-relaxed text-tactical-dim">{item.label}</dt>
              <dd className="order-first font-mono text-3xl font-semibold text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {hasProgress && (
        <section aria-labelledby="progress-title" className="mx-auto max-w-7xl px-4 pt-12">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="label mb-2">Seu aprendizado</p>
              <h2 id="progress-title" className="text-xl font-semibold">{nextLesson ? 'Continue de onde parou.' : 'Trilha concluída. Hora de testar seus conhecimentos.'}</h2>
              {nextLesson && <p className="mt-1 text-sm text-tactical-dim">Próxima lição: {nextLesson.lesson.title}</p>}
            </div>
            <Link to={startLink} className="btn-primary">{nextLesson ? 'Continuar estudando' : 'Fazer a prova final'} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={<Layers className="h-4 w-4" />} label="Lições concluídas" value={`${done}/${allLessons.length}`} />
            <Stat icon={<Activity className="h-4 w-4" />} label="Média nos quizzes" value={avg !== null ? `${avg}%` : '—'} />
            <Stat icon={<GraduationCap className="h-4 w-4" />} label="Prova final" value={progress.examBest !== undefined ? `${Math.round(progress.examBest * 100)}%` : '—'} />
          </div>
        </section>
      )}

      <section aria-labelledby="method-title" className="mx-auto max-w-7xl px-4 pt-16 md:pt-20">
        <p className="label mb-3">Como você aprende aqui</p>
        <h2 id="method-title" className="text-2xl font-bold md:text-3xl">Entenda o conceito. Coloque em prática.</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            { icon: BookOpen, title: 'Leia e entenda', text: 'Lições objetivas explicam os componentes, os comandos e as decisões por trás de cada configuração.' },
            { icon: FlaskConical, title: 'Experimente e observe', text: 'Nos simuladores, altere o estado do cluster, provoque falhas e acompanhe o efeito das suas escolhas.' },
            { icon: CheckCircle2, title: 'Teste seu raciocínio', text: `Fixe o conteúdo com um banco de ${totalQuestions} perguntas e pratique o diagnóstico nos estudos de caso.` },
          ].map((step, index) => (
            <div key={step.title} className="border-t border-tactical-line pt-5">
              <div className="mb-3 flex items-center justify-between"><step.icon className="h-5 w-5 text-k8s-400" /><span className="font-mono text-xs text-tactical-label">0{index + 1}</span></div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-tactical-dim">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <HomeModules progress={progress} />
      <HomeSimulators />

      <section aria-labelledby="cases-title" className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <p className="label mb-3">Do sintoma à causa</p>
          <h2 id="cases-title" className="text-3xl font-bold tracking-tight md:text-4xl">O cluster falhou. Por onde começar?</h2>
          <p className="mt-4 leading-relaxed text-tactical-dim">Investigue cenários de problemas recorrentes: leia os sintomas, escolha um diagnóstico e só então revele a causa, a correção e como prevenir a falha.</p>
          <Link to="/casos" className="btn-ghost mt-6">Explorar {cases.length} estudos de caso <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="divide-y divide-tactical-border border-y border-tactical-border">
          {cases.slice(0, 3).map((item) => (
            <Link key={item.slug} to={`/casos/${item.slug}`} className="group flex items-start gap-4 py-5">
              <div className="flex-1">
                <p className="mb-2 font-mono text-xs text-signal-amber">{item.area}</p>
                <h3 className="font-semibold group-hover:text-k8s-400">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-tactical-dim">{item.summary}</p>
              </div>
              <ArrowRight className="mt-6 h-4 w-4 shrink-0 text-tactical-label group-hover:text-k8s-400" />
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-tactical-border bg-k8s-500/5">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Seu próximo passo pode ser uma única lição.</h2>
            <p className="mt-2 text-sm text-tactical-dim">Estude no seu ritmo. Entre com Google ou GitHub para salvar seu progresso na sua conta.</p>
          </div>
          <Link to={startLink} className="btn-primary shrink-0 px-6 py-3">{nextLesson ? (hasProgress ? 'Continuar aprendendo' : 'Começar a aprender') : 'Fazer a prova final'} <ArrowRight className="h-4 w-4" /></Link>
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
