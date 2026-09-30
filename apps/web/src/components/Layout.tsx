import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutGroup } from 'motion/react';
import { ArrowRight, BookOpen, ExternalLink, FlaskConical, GraduationCap, Menu, Route, X } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import AccountMenu from './AccountMenu';
import { BrandName, Logo } from './Brand';
import AccountNotice from './AccountNotice';
import { AnimatedCollapse, NavigationHighlight } from './NavigationMotion';

const nav = [
  { to: '/trilha', label: 'Trilha', description: 'Seu caminho de aprendizado', icon: Route },
  { to: '/simuladores', label: 'Simuladores', description: 'Pratique em um ambiente interativo', icon: FlaskConical },
  { to: '/casos', label: 'Casos', description: 'Investigue desafios de produção', icon: BookOpen },
  { to: '/prova', label: 'Prova final', description: 'Teste o que você aprendeu', icon: GraduationCap },
];

function JackExpertsLink() {
  return <a href="https://jackexperts.com.br" target="_blank" rel="noopener noreferrer" aria-label="Conheça a Jack Experts (abre em nova aba)" className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium text-signal-amber underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal-amber"><span><span className="lg:hidden xl:inline">Conheça a </span>Jack Experts</span><ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, error } = useAccount();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => { setMobileOpen(false); }, [user?.id]);

  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); menuButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMobileOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (desktop.matches) setMobileOpen(false); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
      desktop.removeEventListener('change', resize);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex flex-col">
      <header ref={header} className="sticky top-0 z-40 border-b border-tactical-border bg-tactical-bg/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-2 px-4 sm:gap-4 lg:gap-6">
          <Link to="/" aria-label="Jack Academy — início" className="flex min-h-11 shrink-0 items-center gap-2 rounded font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400">
            <Logo />
            <BrandName />
          </Link>
          <nav aria-label="Navegação principal" className="hidden flex-1 items-center gap-1 lg:flex">
            <LayoutGroup id="main-navigation">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `relative isolate inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${isActive ? 'text-k8s-400' : 'text-tactical-dim hover:bg-tactical-surface hover:text-white'}`
                  }
                >
                  {({ isActive }) => <>{isActive && <NavigationHighlight />}{n.label}</>}
                </NavLink>
              ))}
            </LayoutGroup>
          </nav>
          <div className="hidden shrink-0 lg:block"><JackExpertsLink /></div>
          <div className="ml-auto lg:ml-0"><AccountMenu onOpen={() => setMobileOpen(false)} /></div>
          <button ref={menuButton} type="button" aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-label={mobileOpen ? 'Fechar navegação' : 'Abrir navegação'} onClick={() => setMobileOpen(!mobileOpen)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-tactical-line text-tactical-text hover:bg-tactical-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 lg:hidden">
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
        <AnimatedCollapse id="mobile-navigation" open={mobileOpen} className="absolute inset-x-0 top-full bg-tactical-surface shadow-2xl lg:hidden">
          <div className="max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-tactical-line p-4">
            <nav aria-label="Navegação mobile" className="mx-auto max-w-7xl space-y-1">
              <LayoutGroup id="mobile-navigation">
                {nav.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `relative isolate flex items-center gap-3 rounded-xl px-4 py-3 transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${isActive ? 'text-k8s-400' : 'text-tactical-dim hover:bg-tactical-raised'}`}>{({ isActive }) => <>{isActive && <NavigationHighlight />}<item.icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-tactical-label">{item.description}</span></span><ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</NavLink>)}
              </LayoutGroup>
              <div className="pt-4"><JackExpertsLink /></div>
            </nav>
          </div>
        </AnimatedCollapse>
      </header>
      {error && <div className="mx-auto w-full max-w-7xl px-4 pt-4"><AccountNotice /></div>}
      <main key={user?.id ?? 'guest'} className="flex-1">{children}</main>
      <footer className="border-t border-tactical-border px-4 py-6 text-center font-mono text-xs leading-6 text-tactical-label">
        Jack Academy · aprenda Kubernetes na prática · inspirado no projeto <a className="underline" href="https://github.com/flaviojmendes/dinamos" target="_blank" rel="noreferrer">Dinamos</a>
        <nav aria-label="Termos e privacidade" className="mt-2 flex flex-wrap justify-center gap-x-5">
          <Link to="/termos-de-uso" className="inline-flex min-h-11 items-center hover:text-white">Termos de uso</Link>
          <Link to="/privacidade" className="inline-flex min-h-11 items-center hover:text-white">Privacidade</Link>
          <Link to="/lgpd" className="inline-flex min-h-11 items-center hover:text-white">LGPD</Link>
        </nav>
      </footer>
    </div>
  );
}
