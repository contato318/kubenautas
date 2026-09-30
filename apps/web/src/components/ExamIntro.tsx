import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, Clock3, FileQuestion, GraduationCap, MessageSquareText, Trophy } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import AccountNotice from './AccountNotice';
import { useLoginPath } from '../hooks/useLoginPath';
import jackAcademyLogo from '../assets/jack-academy-logo.svg';
import { Logo } from './Brand';

const steps = [
  { icon: FileQuestion, title: 'Um desafio a cada tentativa', description: 'As perguntas vêm de toda a trilha. As questões e as alternativas são embaralhadas a cada nova prova.' },
  { icon: MessageSquareText, title: 'Aprenda com cada resposta', description: 'Escolha uma alternativa, confirme e confira a explicação antes de seguir para a próxima questão.' },
  { icon: Award, title: 'Leve sua conquista com você', description: 'Com a aprovação, informe seu nome completo para emitir o certificado. O PDF fica disponível no seu perfil.' },
];

export default function ExamIntro({ size, onStart, children }: { size: number; onStart: () => void; children?: ReactNode }) {
  const { user, status, progress } = useAccount();
  const login = useLoginPath();
  const best = progress.examBest;
  const passed = best !== undefined && best >= 0.7;
  const canStart = !!user && status === 'ready';
  const startClassName = 'group inline-flex min-h-14 items-center justify-center gap-4 rounded-xl bg-k8s-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(50,108,229,0.18)] transition-colors hover:bg-k8s-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      <section aria-labelledby="exam-title" className="relative isolate overflow-hidden rounded-3xl border border-[#263752] bg-[#101a2c]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(50,108,229,0.16),transparent_65%)]" />
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-9 lg:p-10">
            <p className="flex items-center gap-2.5 text-xs font-medium text-[#a5bdf0]"><GraduationCap aria-hidden="true" className="h-4 w-4" />Certificação Jack Academy</p>
            <h1 id="exam-title" className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">Prova final<span aria-hidden="true" className="text-k8s-400">.</span></h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#b7c3d6]">Coloque seu conhecimento de Kubernetes à prova e conquiste um certificado com o seu nome.</p>

            <dl className="mt-7 grid grid-cols-3 border-y border-white/10 py-5">
              <div className="pr-3"><dt className="text-xs leading-5 text-[#a7b6ce]">Perguntas</dt><dd className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{size}</dd></div>
              <div className="border-l border-white/10 px-3 sm:px-5"><dt className="text-xs leading-5 text-[#a7b6ce]">Aprovação</dt><dd className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">70<span className="text-lg text-[#a7b6ce]">%</span></dd></div>
              <div className="border-l border-white/10 pl-3 sm:pl-5"><dt className="text-xs leading-5 text-[#a7b6ce]">Tempo</dt><dd className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-white"><Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a5bdf0]" />Livre</dd></div>
            </dl>

            {best !== undefined && (
              <div className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${passed ? 'border-signal-green/20 bg-signal-green/5' : 'border-white/10 bg-white/[0.03]'}`}>
                <Trophy aria-hidden="true" className={`h-5 w-5 shrink-0 ${passed ? 'text-signal-green' : 'text-signal-amber'}`} />
                <div className="min-w-0 flex-1"><p className="text-xs text-[#b7c3d6]">Seu melhor resultado</p><p className={`mt-1 text-xs ${passed ? 'text-signal-green' : 'text-[#b7c3d6]'}`}>{passed ? 'Nota de aprovação atingida' : 'Você pode tentar novamente'}</p></div>
                <p className="shrink-0 text-2xl font-semibold text-white">{Math.round(best * 100)}<span className="text-sm text-[#a7b6ce]">%</span></p>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              {status === 'ready' && !user ? (
                <Link to={login} className={startClassName}>Entrar para fazer a prova<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              ) : (
                <button type="button" disabled={!canStart} onClick={() => { if (canStart) onStart(); }} className={startClassName}>{status === 'loading' ? 'Verificando sua conta…' : 'Iniciar prova'}<ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></button>
              )}
              <Link to="/trilha" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm text-[#b7c3d6] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><BookOpen aria-hidden="true" className="h-4 w-4" />Revisar a trilha</Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#91a4c2]">Recomendado após concluir a trilha. Você pode tentar quando quiser.</p>
            {status === 'error' && <div className="mt-4"><AccountNotice /></div>}
            {status === 'ready' && !user && <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-[#b7c3d6]"><Link to={login} className="rounded font-medium text-[#9ebfff] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400">Entre na sua conta</Link> para responder às perguntas, guardar sua nota e emitir o certificado.</p>}
          </div>

          <aside aria-label="Certificado de aprovação" className="relative flex min-w-0 flex-col justify-center overflow-hidden border-t border-white/10 bg-[#0c1526]/65 px-6 py-9 sm:px-10 lg:border-l lg:border-t-0 lg:px-8">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-k8s-400/10 bg-k8s-400/[0.03] ring-[40px] ring-k8s-400/[0.025]" />
            <div className="relative mx-auto w-full max-w-[380px]">
              <p className="mb-7 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-signal-amber"><Award aria-hidden="true" className="h-4 w-4" />Seu próximo marco</p>
              <div aria-hidden="true" className="relative mx-2 -rotate-3 rounded-lg bg-[#faf9f5] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:p-3">
                <div className="overflow-hidden rounded-sm border border-[#d9d3c4]">
                  <div className="flex items-center justify-between gap-4 border-b-2 border-[#c69a3b] bg-[#101d35] px-4 py-3 sm:px-5"><img src={jackAcademyLogo} alt="" width={512} height={280} className="h-auto w-16" /><span className="text-[7px] uppercase tracking-widest text-[#b8c5df]">Kubernetes na prática</span></div>
                  <div className="px-3 py-6 text-center sm:py-7">
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-[#101d35] sm:text-sm">CERTIFICADO</p>
                    <p className="mt-1 text-[7px] tracking-[0.16em] text-[#806021]">DE APROVAÇÃO</p>
                    <p className="mt-5 font-serif text-lg text-[#101d35] sm:text-2xl">Seu nome completo</p>
                    <div className="mx-auto mt-3 h-0.5 w-4/5 bg-[#e6e2d9]" /><div className="mx-auto mt-1.5 h-0.5 w-3/5 bg-[#e6e2d9]" />
                    <div className="mt-5 flex items-center justify-center gap-5"><span className="h-px w-12 bg-[#d9c69a]" /><Logo size={32} /><span className="h-px w-12 bg-[#d9c69a]" /></div>
                    <p className="mt-3 text-[7px] tracking-[0.12em] text-[#657081]">KUBERNETES NA PRÁTICA</p>
                  </div>
                </div>
              </div>
              <div className="relative mx-auto mt-8 max-w-xs text-center"><h2 className="text-lg font-semibold text-white">Conhecimento que vira conquista.</h2><p className="mt-2 text-sm leading-6 text-[#a7b6ce]">Um certificado da Jack Academy para celebrar sua aprovação.</p><p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#b7c3d6]"><span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-signal-amber" />Em PDF</span><span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-signal-amber" />No seu nome</span></p><p className="mt-4 text-[10px] text-[#7f92af]">Modelo ilustrativo do certificado</p></div>
            </div>
          </aside>
        </div>
      </section>

      {children}

      <section aria-labelledby="exam-how-title" className="mt-10 sm:mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="exam-how-title" className="text-lg font-semibold">Da primeira pergunta ao certificado</h2><span className="inline-flex items-center gap-2 text-xs text-tactical-label"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-k8s-400" />No seu ritmo, em três passos</span></div>
        <ol className="mt-6 grid gap-7 border-t border-tactical-border pt-6 md:grid-cols-3 md:gap-6">
          {steps.map((step, index) => <li key={step.title} className="flex gap-4"><div className="flex shrink-0 flex-col items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-k8s-400/20 bg-k8s-500/5 text-k8s-400"><step.icon aria-hidden="true" className="h-4 w-4" /></span><span aria-hidden="true" className="font-mono text-[10px] text-tactical-label">0{index + 1}</span></div><div className="min-w-0"><h3 className="pt-1 text-sm font-semibold leading-6">{step.title}</h3><p className="mt-2 text-sm leading-6 text-tactical-dim">{step.description}</p></div></li>)}
        </ol>
      </section>
    </>
  );
}
