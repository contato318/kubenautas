import { motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Github, LoaderCircle, Terminal } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { BrandName, Logo } from '../components/Brand';
import LoginDiscoveries from '../components/LoginDiscoveries';
import { allLessons } from '../content/modules';
import { cases } from '../content/cases';
import { simulators } from '../components/simulators/registry';
import { apiUrl } from '../lib/api';
import { safeReturnPath } from '@jack-academy/contracts';
import jackExpertsLogo from '../assets/jack-experts-white.png';
import jackAcademyGiraffe from '../assets/jack-academy-giraffe-builder.png';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}

function PlatformPanel() {
  const reducedMotion = useReducedMotion();

  return (
    <aside aria-labelledby="platform-title" className="relative isolate flex flex-col overflow-hidden border-t border-white/10 bg-[#080f20] px-6 py-8 sm:px-12 lg:border-l lg:border-t-0 lg:px-10 xl:px-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_65%_40%,rgba(39,73,135,0.22),transparent_65%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
        style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 65%, transparent)' }}
      />
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-blue-100"><span className="h-1.5 w-1.5 rounded-full bg-signal-green" />100% gratuito</span>
        <a href="https://jackexperts.com.br" target="_blank" rel="noopener noreferrer" aria-label="Conheça a Jack Experts (abre em nova aba)" className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="hidden text-[10px] uppercase tracking-widest text-blue-200/70 sm:inline">Uma iniciativa</span>
          <img src={jackExpertsLogo} alt="Jack Experts" width={3937} height={1985} className="h-auto w-20" />
        </a>
      </div>

      <div className="mx-auto mt-9 w-full max-w-xl lg:mt-8">
        <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-blue-200"><Terminal className="h-3.5 w-3.5" aria-hidden="true" />Seu laboratório de Kubernetes</p>
        <h2 id="platform-title" className="max-w-lg text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl xl:text-[2.75rem]">Conhecimento que<br />vira <span className="text-[#ffd166]">prática.</span></h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-blue-100/80">Do primeiro container à segurança de clusters. Aprenda, experimente e descubra como tudo se conecta.</p>
      </div>

      <div className="relative mx-auto my-4 flex w-full max-w-xl flex-1 items-center justify-center">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-[280px] sm:w-[300px] xl:w-[340px]"
        >
          <div aria-hidden="true" className="absolute bottom-[3%] left-1/2 h-[15%] w-[80%] -translate-x-1/2 rounded-[50%] border border-blue-300/20 bg-blue-400/15 shadow-[0_0_60px_rgba(91,141,239,0.12)]" />
          <img src={jackAcademyGiraffe} alt="Girafa da Jack Experts com fones azuis montando um cluster com blocos Kubernetes" width={1254} height={1254} className="relative h-auto w-full" />
        </motion.div>
      </div>

      <div className="mx-auto w-full max-w-xl">
        <LoginDiscoveries />
        <dl className="mt-6 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-6">
          {[
            { value: allLessons.length, label: 'lições guiadas' },
            { value: simulators.length, label: 'simuladores' },
            { value: cases.length, label: 'estudos de caso' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col px-3 first:pl-0 sm:px-5">
              <dt className="mt-1 text-[11px] text-blue-200/75">{item.label}</dt>
              <dd className="order-first font-mono text-2xl font-semibold leading-none text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  const { user, status, providers, refresh } = useAccount();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('returnTo'));
  if (user && status === 'ready') return <Navigate to={returnTo} replace />;

  return (
    <main className="min-h-svh bg-tactical-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="login-title" className="flex min-h-svh flex-col px-6 py-7 sm:px-12 lg:px-10 lg:py-8 xl:px-16">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Jack Academy — início" className="inline-flex items-center gap-2.5 rounded-sm font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><Logo size={30} /><BrandName /></Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-sm text-xs text-tactical-label transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />Voltar ao site</Link>
        </header>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14 lg:py-12">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-k8s-400">Seu espaço de aprendizado</p>
          <h1 id="login-title" className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">Bom ter você<br />por aqui<span className="text-k8s-400">.</span></h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-tactical-dim">Entre para acompanhar sua evolução, salvar suas conquistas e continuar de onde parou.</p>

          {params.get('account') === 'deleted' && <div role="status" className="mt-6 flex items-start gap-3 rounded-lg border border-signal-green/25 bg-signal-green/5 p-4 text-sm leading-6 text-signal-green"><CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" /><p>Sua conta foi excluída. Você pode continuar explorando o conteúdo sem entrar.</p></div>}

          <div aria-label="Opções de login" aria-busy={status === 'loading'} className="mt-9 space-y-3">
            {(['google', 'github'] as const).map((provider) => {
              const available = status === 'ready' && providers[provider];
              const content = <>{provider === 'github' ? <Github aria-hidden="true" className="h-5 w-5 shrink-0" /> : <GoogleIcon />}<span className="flex-1 text-left">Entrar com {provider === 'google' ? 'Google' : 'GitHub'}</span><ArrowRight aria-hidden="true" className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5" /></>;
              const className = `group flex min-h-14 w-full items-center gap-3 rounded-lg border px-5 py-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 disabled:cursor-not-allowed disabled:opacity-50 ${provider === 'google' ? 'border-white/90 bg-white text-[#202124] enabled:hover:bg-slate-100 [&:is(a)]:hover:bg-slate-100' : 'border-tactical-line bg-tactical-raised text-white enabled:hover:border-tactical-label [&:is(a)]:hover:border-tactical-label'}`;
              return available ? <a key={provider} className={className} href={apiUrl(`auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`)}>{content}</a> : <button key={provider} type="button" className={className} disabled>{content}</button>;
            })}
          </div>
          <div className="mt-4 space-y-3 text-xs leading-relaxed">
            {status === 'loading' && <p role="status" className="flex items-center gap-2 text-tactical-label"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />Preparando seu acesso…</p>}
            {params.get('error') && <p role="alert" className="rounded-lg border border-signal-amber/20 bg-signal-amber/5 p-3 text-signal-amber">Não foi possível concluir o login. Tente novamente com o provedor escolhido.</p>}
            {status === 'error' && <div role="alert" className="rounded-lg border border-signal-amber/20 bg-signal-amber/5 p-3 text-signal-amber">Não foi possível conectar ao serviço de login. <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-4">Tentar novamente</button></div>}
            {status === 'ready' && !providers.google && !providers.github && <p role="status" className="rounded-lg border border-signal-amber/20 bg-signal-amber/5 p-3 text-signal-amber">O login estará disponível em breve. Enquanto isso, você pode explorar todo o conteúdo.</p>}
          </div>
          <p className="mt-5 text-xs leading-6 text-tactical-label">Antes de entrar, consulte os <Link to="/termos-de-uso" className="text-tactical-dim underline underline-offset-4 hover:text-k8s-400">Termos de uso</Link> e as informações de <Link to="/privacidade" className="text-tactical-dim underline underline-offset-4 hover:text-k8s-400">Privacidade</Link>. Conheça também seus <Link to="/lgpd" className="text-tactical-dim underline underline-offset-4 hover:text-k8s-400">direitos LGPD</Link>.</p>

          <div className="my-8 flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-tactical-border" /><span className="text-[11px] text-tactical-label">ou conheça primeiro</span><span className="h-px flex-1 bg-tactical-border" /></div>
          <Link to="/trilha" className="group mx-auto inline-flex items-center gap-2 rounded-sm text-sm text-tactical-dim transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400">Explorar a plataforma<ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
        </div>

        <footer className="mx-auto w-full max-w-[400px] border-t border-tactical-border pt-5 text-[11px] leading-relaxed text-tactical-label">Seu progresso acompanha a conta escolhida.<br />Use sempre o mesmo provedor: Google e GitHub mantêm progressos separados.</footer>
      </section>
      <PlatformPanel />
    </main>
  );
}
