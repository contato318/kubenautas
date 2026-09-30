import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BookOpen, CheckCircle2, Cloud, FlaskConical, LoaderCircle, LogOut, Route } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { BrandName, Logo } from '../components/Brand';
import { modules } from '../content/modules';
import { useLoginPath } from '../hooks/useLoginPath';
import jackAcademyLogo from '../assets/jack-academy-logo.svg';
import giraffe from '../assets/jack-academy-giraffe-welcome.png';

const steps = [
  { icon: BookOpen, title: 'Siga a trilha', description: 'Os módulos organizam seu caminho, dos primeiros conceitos aos desafios avançados.' },
  { icon: FlaskConical, title: 'Coloque em prática', description: 'Experimente nos simuladores e observe como o cluster reage às suas escolhas.' },
  { icon: CheckCircle2, title: 'Veja sua evolução', description: 'Responda aos quizzes. Com 70% de acertos, a lição fica concluída na sua conta.' },
];

export default function WelcomePage() {
  const { user, status, refresh, logout, completeWelcome } = useAccount();
  const login = useLoginPath();
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  if (status === 'loading' || status === 'error') return (
    <main className="flex min-h-svh items-center justify-center bg-tactical-bg px-6">
      <div className="max-w-sm text-center">
        {status === 'loading' ? <p role="status" className="flex items-center justify-center gap-3 text-tactical-dim"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Preparando suas boas-vindas…</p> : <><p role="alert" className="text-tactical-dim">Não foi possível carregar sua conta.</p><button onClick={() => void refresh()} className="btn-primary mt-5">Tentar novamente</button></>}
      </div>
    </main>
  );
  if (!user) return <Navigate to={login} replace />;
  if (user.welcomeCompleted) return <Navigate to="/trilha" replace />;

  const firstName = user.name.trim().split(/\s+/)[0] || 'explorador';
  const start = async () => {
    setContinuing(true);
    setError(null);
    try {
      await completeWelcome();
      // The completed account state redirects to /trilha above, only after saving.
    } catch {
      setError('Não foi possível confirmar seu início. Tente novamente para abrir a trilha.');
    } finally { setContinuing(false); }
  };

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-tactical-bg">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_25%,rgba(39,73,135,0.24),transparent_60%)]" />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-7 lg:px-8">
        <Link to="/" aria-label="Jack Academy — início" className="flex items-center gap-2.5 rounded-sm font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><Logo size={30} /><BrandName /></Link>
        <button onClick={() => void logout()} disabled={continuing} className="inline-flex items-center gap-2 rounded-sm text-xs text-tactical-label transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 disabled:opacity-50"><LogOut aria-hidden="true" className="h-3.5 w-3.5" />Sair</button>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-10 lg:px-8">
        <section aria-labelledby="welcome-title" className="grid items-center gap-8 pb-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12 lg:pb-12 lg:pt-12">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal-green/20 bg-signal-green/5 px-3 py-1.5 text-xs text-signal-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Conta conectada com {user.provider === 'google' ? 'Google' : 'GitHub'}</p>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-k8s-400">Boas-vindas à Jack Academy</p>
            <h1 id="welcome-title" className="break-words text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">Sua jornada começa<br />agora, <span className="text-[#ffd166]">{firstName}.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-tactical-dim">O próximo passo é a sua <strong className="font-medium text-white">trilha de aprendizado</strong>. Ela organiza o caminho de Containers a Kubernetes avançado, para você saber por onde começar e o que estudar depois.</p>

            <div className="mt-7 flex items-start gap-3 border-l-2 border-k8s-500 pl-4">
              <Route aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-k8s-400" />
              <div><p className="text-xs text-tactical-label">Seu ponto de partida</p><p className="mt-1 text-sm font-medium text-tactical-text">{modules[0].title}</p><p className="mt-1 text-xs text-tactical-label">{modules[0].lessons.length} lições para construir sua base.</p></div>
            </div>

            <button type="button" onClick={() => void start()} disabled={continuing} className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-k8s-500 px-7 py-4 text-base font-semibold text-white shadow-[0_8px_32px_rgba(50,108,229,0.2)] transition-colors hover:bg-k8s-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
              {continuing ? <><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Abrindo sua trilha…</> : <>Ir para minha trilha<ArrowRight aria-hidden="true" className="h-5 w-5" /></>}
            </button>
            {error && <p role="alert" className="mt-4 max-w-md text-sm leading-relaxed text-signal-amber">{error}</p>}
            <p className="mt-4 flex items-center gap-2 text-xs text-tactical-label"><Cloud aria-hidden="true" className="h-4 w-4 shrink-0" />Seu progresso fica salvo na sua conta. Vá no seu ritmo.</p>
          </div>

          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative mx-auto w-full max-w-[270px] sm:max-w-[330px] lg:max-w-[400px]">
            <div aria-hidden="true" className="absolute inset-[8%] rounded-full border border-k8s-400/10 bg-k8s-500/5" />
            <div aria-hidden="true" className="absolute bottom-[3%] left-1/2 h-[15%] w-[80%] -translate-x-1/2 rounded-[50%] border border-blue-300/20 bg-blue-400/15" />
            <img src={giraffe} width={1254} height={1254} alt="Girafa da Jack Experts com mochila e mapa, convidando você a começar a trilha" className="relative h-auto w-full" />
          </motion.div>
        </section>

        <section aria-labelledby="welcome-steps" className="border-t border-tactical-border pt-7">
          <h2 id="welcome-steps" className="font-mono text-[10px] uppercase tracking-[0.18em] text-tactical-label">Um caminho simples para aprender de verdade</h2>
          <ol className="mt-6 grid gap-7 sm:grid-cols-3 sm:gap-6">
            {steps.map((step, index) => <li key={step.title} className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-k8s-400/20 bg-k8s-500/10 text-k8s-400"><step.icon aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold"><span className="mr-2 font-mono text-[10px] text-tactical-label">0{index + 1}</span>{step.title}</h3><p className="mt-2 text-xs leading-6 text-tactical-dim">{step.description}</p></div></li>)}
          </ol>
        </section>

        <footer className="mt-10 flex items-center justify-between gap-4 border-t border-tactical-border pt-5"><p className="text-xs text-tactical-label">Aprendizado gratuito, do primeiro container ao cluster.</p><img src={jackAcademyLogo} alt="Jack Academy" width={512} height={280} className="h-auto w-16 shrink-0" /></footer>
      </div>
    </main>
  );
}
