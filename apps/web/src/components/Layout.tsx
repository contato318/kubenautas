import { ReactNode, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { allLessons } from '../content/modules';
import { cases } from '../content/cases';
import { useProgress } from '../hooks/useProgress';

const nav = [
  { to: '/trilha', label: 'Trilha' },
  { to: '/simuladores', label: 'Simuladores' },
  { to: '/casos', label: 'Casos' },
  { to: '/prova', label: 'Prova final' },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <polygon points="32,3 57,15 63,42 46,62 18,62 1,42 7,15" fill="#326ce5" />
      <circle cx="32" cy="33" r="11" fill="none" stroke="#fff" strokeWidth="4" />
      <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
        <line x1="32" y1="12" x2="32" y2="22" />
        <line x1="32" y1="44" x2="32" y2="54" />
        <line x1="12" y1="33" x2="21" y2="33" />
        <line x1="43" y1="33" x2="52" y2="33" />
      </g>
    </svg>
  );
}

const barColor = {
  green: { bar: 'bg-signal-green', text: 'text-signal-green' },
  amber: { bar: 'bg-signal-amber', text: 'text-signal-amber' },
};

function ProgressBar({ label, done, total, unit, color }: { label: string; done: number; total: number; unit: string; color: keyof typeof barColor }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const { bar, text } = barColor[color];
  return (
    <div className="flex items-center gap-3" title={`${done} de ${total} ${unit}`}>
      <span className="label w-12">{label}</span>
      <div className="h-1.5 w-28 overflow-hidden rounded bg-tactical-raised">
        <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-9 text-right font-mono text-xs ${text}`}>{pct}%</span>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { progress } = useProgress();
  const { pathname } = useLocation();
  const done = Object.keys(progress.completed).length;
  const casesDone = cases.filter((c) => progress.cases?.[c.slug]).length;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-tactical-border bg-tactical-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Logo />
            <span>Kube<span className="text-k8s-400">nautas</span></span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wider ${isActive ? 'bg-tactical-raised text-white' : 'text-tactical-label hover:text-tactical-text'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden flex-col gap-1 sm:flex">
            <ProgressBar label="Curso" done={done} total={allLessons.length} unit="lições concluídas" color="green" />
            <ProgressBar label="Casos" done={casesDone} total={cases.length} unit="casos resolvidos" color="amber" />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-tactical-border py-6 text-center font-mono text-xs text-tactical-label">
        Kubenautas · aprenda Kubernetes na prática · inspirado no projeto <a className="underline" href="https://github.com/flaviojmendes/dinamos" target="_blank" rel="noreferrer">Dinamos</a>
      </footer>
    </div>
  );
}
