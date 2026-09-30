import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, FlaskConical, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Route, Terminal, X } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import AccountMenu from '../components/AccountMenu';
import AccountNotice from '../components/AccountNotice';
import { BrandName, Logo } from '../components/Brand';
import SimulatorNavigator from '../components/SimulatorNavigator';
import SimulatorHost from '../components/simulators/SimulatorHost';
import { simulators } from '../components/simulators/registry';
import { simulatorCategory } from '../components/simulators/catalog';
import { categoryIcons } from '../components/SimulatorCatalog';
import { allLessons } from '../content/modules';
import { cases } from '../content/cases';
import { useActivityVisit } from '../hooks/useActivity';

export default function SimulatorWorkspace() {
  const { user } = useAccount();
  return <Workspace key={user?.id ?? 'guest'} />;
}

function Workspace() {
  const { simId } = useParams();
  const [searchParams] = useSearchParams();
  const { error } = useAccount();
  const active = simulators.find((item) => item.id === simId);
  const category = active ? simulatorCategory(active.id) : undefined;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const sidebar = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const menu = useRef<HTMLDialogElement>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  useActivityVisit('simulator_opened', active?.id);
  const params = new URLSearchParams(searchParams);
  if (!params.has('tema') && category) params.set('tema', category.id);
  const search = params.size ? `?${params.toString()}` : '';
  const index = active && category ? category.simulatorIds.indexOf(active.id) : -1;
  const previous = category?.simulatorIds[index - 1];
  const next = category?.simulatorIds[index + 1];
  const Icon = active?.id === 'terminal' ? Terminal : categoryIcons[category?.id ?? 'todos'];
  const related = active ? allLessons.filter(({ lesson }) => lesson.simulator === active.id || lesson.extraSimulators?.includes(active.id)) : [];
  const relatedCases = active ? cases.filter((item) => item.simulator === active.id) : [];

  useEffect(() => {
    setMenuOpen(false);
    guide.current?.close();
    scrollArea.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [simId]);
  useLayoutEffect(() => {
    if (sidebar.current) sidebar.current.inert = !sidebarOpen;
  }, [sidebarOpen]);
  useLayoutEffect(() => {
    if (menu.current) menu.current.inert = !menuOpen;
    if (menuOpen && !menu.current?.open) menu.current?.showModal();
  }, [menuOpen]);
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => { document.removeEventListener('fullscreenchange', changed); };
  }, []);
  const toggleFullscreen = async () => {
    try {
      setFullscreenError('');
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setFullscreenError('Seu navegador não permitiu o modo de tela cheia.'); }
  };

  return (
    <div className="lab-workspace flex h-dvh min-h-0 flex-col overflow-hidden bg-tactical-bg">
      <a href="#lab-content" className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-k8s-500 focus:p-3">Ir para o simulador</a>
      <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-tactical-border bg-tactical-surface px-3 sm:px-5">
        <Link to="/" aria-label="Jack Academy — início" className="flex min-h-11 shrink-0 items-center gap-2.5 font-bold tracking-tight"><Logo size={27} /><BrandName className="hidden sm:inline" /><span className="rounded border border-k8s-400/25 bg-k8s-500/10 px-1.5 py-0.5 font-mono text-[9px] font-normal uppercase tracking-widest text-k8s-400">Labs</span></Link>
        <div className="hidden min-w-0 items-center gap-2 text-xs text-tactical-label md:flex"><Link to={{ pathname: '/simuladores', search }} className="hover:text-white">Simuladores</Link><ChevronRight aria-hidden="true" className="h-3 w-3" /><span className="truncate text-tactical-dim">{category?.title ?? 'Laboratório'}</span></div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3"><Link to="/trilha" className="flex min-h-11 items-center gap-2 px-2 text-xs text-tactical-dim hover:text-white"><Route aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Voltar à trilha</span><span className="sr-only sm:hidden">Trilha</span></Link><span className="h-5 border-l border-tactical-border" aria-hidden="true" /><AccountMenu /></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <motion.aside
          ref={sidebar}
          id="lab-navigation"
          aria-label="Menu de laboratórios"
          aria-hidden={!sidebarOpen}
          initial={false}
          animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ width: { duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: reducedMotion ? 0 : 0.18 } }}
          style={{ pointerEvents: sidebarOpen ? 'auto' : 'none' }}
          className="hidden shrink-0 overflow-hidden bg-tactical-surface/70 lg:block"
        >
          <div className="h-full w-64 border-r border-tactical-border"><SimulatorNavigator activeId={active?.id} search={search} /></div>
        </motion.aside>
        <main id="lab-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          <div className="flex shrink-0 items-center gap-3 border-b border-tactical-border px-3 py-3 sm:gap-4 sm:px-5">
            <button type="button" aria-label={sidebarOpen ? 'Recolher menu de simuladores' : 'Abrir menu de simuladores'} aria-expanded={sidebarOpen} aria-controls="lab-navigation" className="lab-icon-button hidden lg:flex" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}</button>
            <button type="button" aria-label="Trocar simulador" aria-haspopup="dialog" aria-expanded={menuOpen} className="lab-icon-button lg:hidden" onClick={() => setMenuOpen(true)}><PanelLeftOpen aria-hidden="true" className="h-4 w-4" /></button>
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-k8s-400/20 bg-k8s-500/10 sm:flex"><Icon aria-hidden="true" className="h-5 w-5 text-k8s-400" /></div>
            <div className="min-w-0 flex-1"><p className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-tactical-label">Laboratório interativo</p><h1 ref={heading} tabIndex={-1} className="truncate text-base font-semibold tracking-tight outline-none sm:text-lg">{active?.title ?? 'Simulador não encontrado'}</h1></div>
            {active && <button type="button" aria-haspopup="dialog" onClick={() => guide.current?.showModal()} className="lab-icon-button gap-2 sm:w-auto sm:px-3" aria-label="Guia do laboratório"><BookOpen aria-hidden="true" className="h-4 w-4" /><span className="hidden text-xs sm:inline">Guia</span></button>}
            {typeof document !== 'undefined' && document.fullscreenEnabled && <button type="button" className="lab-icon-button hidden sm:flex" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'} title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>{fullscreen ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}</button>}
          </div>
          {error && <div className="shrink-0 px-4 py-2"><AccountNotice /></div>}
          {fullscreenError && <p role="status" className="px-4 py-2 text-xs text-signal-amber">{fullscreenError}</p>}
          <div ref={scrollArea} className={`lab-scroll min-h-0 flex-1 overflow-auto ${active?.id === 'terminal' ? 'p-3 sm:p-4' : 'lab-canvas p-3 sm:p-6'}`}>
            {active ? <section aria-label={`Controles do simulador: ${active.title}`} className={active.id === 'terminal' ? 'h-full min-h-0' : 'min-w-0'}><SimulatorHost key={active.id} id={active.id} workspace /></section> : <div className="flex h-full flex-col items-center justify-center gap-5 text-center"><FlaskConical aria-hidden="true" className="h-10 w-10 text-k8s-400" /><p className="max-w-sm text-sm leading-6 text-tactical-dim">Esse laboratório não está disponível. Escolha outro simulador no menu ou explore o catálogo.</p><Link to="/simuladores" className="btn-primary">Explorar simuladores<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div>}
          </div>
          <footer className="flex min-h-10 shrink-0 items-center gap-3 border-t border-tactical-border bg-tactical-surface px-3 font-mono text-[10px] text-tactical-label sm:px-5">
            <span className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal-cyan" />Ambiente simulado<span className="hidden sm:inline"> · no navegador</span></span>
            {active && <nav aria-label="Outros simuladores deste tema" className="ml-auto flex items-center gap-1">{previous && <Link to={{ pathname: `/simuladores/${previous}`, search }} className="flex min-h-10 items-center gap-1.5 px-2 hover:text-white" aria-label="Laboratório anterior"><ArrowLeft aria-hidden="true" className="h-3 w-3" /><span className="hidden sm:inline">Anterior</span></Link>}<span className="px-1 text-tactical-dim">{index + 1}/{category?.simulatorIds.length}</span>{next && <Link to={{ pathname: `/simuladores/${next}`, search }} className="flex min-h-10 items-center gap-1.5 px-2 text-k8s-400 hover:text-white" aria-label="Próximo laboratório"><span className="hidden sm:inline">Próximo</span><ArrowRight aria-hidden="true" className="h-3 w-3" /></Link>}</nav>}
          </footer>
        </main>
      </div>

      <motion.dialog
        ref={menu}
        aria-labelledby="lab-menu-title"
        aria-hidden={!menuOpen}
        data-open={menuOpen}
        initial={false}
        animate={{ x: menuOpen ? '0%' : '-110%', opacity: menuOpen ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => { if (!menuOpen) menu.current?.close(); }}
        onCancel={(event) => { event.preventDefault(); setMenuOpen(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}
        className="lab-dialog lab-drawer m-2 h-[calc(100dvh-1rem)] max-h-none w-80 max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="flex h-full flex-col"><div className="flex items-center justify-between border-b border-tactical-border px-4 py-2"><h2 id="lab-menu-title" className="text-sm font-semibold">Trocar simulador</h2><button type="button" autoFocus aria-label="Fechar menu de simuladores" className="lab-icon-button" onClick={() => setMenuOpen(false)}><X aria-hidden="true" className="h-4 w-4" /></button></div><div className="min-h-0 flex-1"><SimulatorNavigator activeId={active?.id} search={search} onNavigate={() => setMenuOpen(false)} /></div></div>
      </motion.dialog>
      <dialog ref={guide} aria-labelledby="lab-guide-title" className="lab-dialog max-h-[85dvh] w-[520px] max-w-[calc(100vw-2rem)] p-0" onClick={(event) => { if (event.target === event.currentTarget) guide.current?.close(); }}>
        <div className="flex items-center justify-between border-b border-tactical-border px-5 py-3"><h2 id="lab-guide-title" className="flex items-center gap-2 text-sm font-semibold"><BookOpen aria-hidden="true" className="h-4 w-4 text-k8s-400" />Guia do laboratório</h2><button type="button" autoFocus aria-label="Fechar guia" className="lab-icon-button" onClick={() => guide.current?.close()}><X aria-hidden="true" className="h-4 w-4" /></button></div>
        <div className="p-5"><h3 className="text-xl font-semibold">{active?.title}</h3><p className="mt-3 text-sm leading-6 text-tactical-dim">{active?.description}</p><p className="mt-4 rounded-lg border border-tactical-border bg-tactical-bg p-3 text-xs leading-5 text-tactical-label">Experimente livremente. As ações acontecem em uma simulação no navegador. Ao trocar de laboratório ou recarregar a página, o experimento recomeça.</p>
          {related.length > 0 && <div className="mt-6"><h3 className="label mb-2">Lições relacionadas</h3>{related.map(({ module, lesson }) => <Link key={lesson.slug} to={`/aprender/${module.id}/${lesson.slug}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-tactical-border py-3 text-sm text-tactical-dim hover:text-k8s-400">{lesson.title}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-k8s-400" /></Link>)}</div>}
          {relatedCases.length > 0 && <div className="mt-6"><h3 className="label mb-2">Estudos de caso</h3>{relatedCases.map((item) => <Link key={item.slug} to={`/casos/${item.slug}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-tactical-border py-3 text-sm text-tactical-dim hover:text-k8s-400">{item.title}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-k8s-400" /></Link>)}</div>}
        </div>
      </dialog>
    </div>
  );
}
