import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { useLoginPath } from '../hooks/useLoginPath';

const accountActionClass = 'flex min-h-11 w-full items-center gap-2 rounded-lg bg-k8s-500/10 px-3 text-left text-sm font-medium text-k8s-400 transition-colors hover:bg-k8s-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export default function AccountMenu({ onOpen }: { onOpen?: () => void }) {
  const { user, status, logout } = useAccount();
  const location = useLocation();
  const login = useLoginPath();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [location.pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  if (!user) return <Link to={login} className="btn-primary min-h-11 shrink-0 px-3"><LogIn aria-hidden="true" className="hidden h-4 w-4 sm:block" />{status === 'loading' ? 'Aguarde…' : 'Entrar'}</Link>;
  return (
    <details ref={menu} className="relative shrink-0" onToggle={(event) => { if (event.currentTarget.open) onOpen?.(); }} onKeyDown={(event) => { if (event.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
      <summary aria-label={`Conta de ${user.name}`} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-tactical-line px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 [&::-webkit-details-marker]:hidden"><UserRound aria-hidden="true" className="h-4 w-4 text-k8s-400" /><span className="hidden max-w-24 truncate sm:block">{user.name}</span><ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 sm:block" /></summary>
      <div className="fixed right-4 top-[72px] z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-tactical-line bg-tactical-surface p-4 shadow-xl sm:absolute sm:right-0 sm:top-full">
        <p className="break-words font-medium">{user.name}</p>
        {user.email && <p className="mt-1 break-all text-xs text-tactical-label">{user.email}</p>}
        <Link to="/perfil" onClick={() => { if (menu.current) menu.current.open = false; }} className={`mt-4 ${accountActionClass}`}><UserRound aria-hidden="true" className="h-4 w-4" />Meu perfil</Link>
        {user.isAdmin && <Link to="/admin" onClick={() => { if (menu.current) menu.current.open = false; }} className="mt-2 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-tactical-dim hover:bg-tactical-raised hover:text-white"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Administração</Link>}
        <button type="button" disabled={status === 'loading'} onClick={() => void logout()} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-tactical-dim transition-colors enabled:hover:text-signal-red focus-visible:text-signal-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-red disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"><LogOut aria-hidden="true" className="h-4 w-4" />Sair da conta</button>
      </div>
    </details>
  );
}
