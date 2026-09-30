import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { BarChart3, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import { useAccount } from '../../auth/AccountProvider';
import { AdminFeedback } from './AdminUi';
import { useLoginPath } from '../../hooks/useLoginPath';

export default function AdminShell() {
  const { user, status, refresh } = useAccount();
  const login = useLoginPath();
  if (status !== 'ready') return <div className="mx-auto max-w-6xl px-4 py-12"><AdminFeedback loading={status === 'loading'} error={status === 'error' ? 'Não foi possível conferir seu acesso.' : null} reload={() => void refresh()} /></div>;
  if (!user) return <Navigate to={login} replace />;
  if (!user.isAdmin) return <div className="mx-auto max-w-xl px-4 py-16"><LockKeyhole aria-hidden="true" className="h-10 w-10 text-signal-amber" /><h1 className="mt-5 text-3xl font-semibold">Acesso restrito</h1><p className="mt-4 leading-7 text-tactical-dim">Esta área está disponível apenas para administradores da plataforma.</p><Link to="/perfil" className="btn-primary mt-6 min-h-11">Voltar ao meu perfil</Link></div>;
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"><div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-tactical-border pb-5"><p className="flex items-center gap-2 text-xs font-medium text-k8s-400"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Administração da plataforma</p><nav aria-label="Navegação administrativa" className="flex gap-2">{[{to:'/admin',label:'Visão geral',icon:BarChart3},{to:'/admin/usuarios',label:'Usuários',icon:Users}].map(item=><NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={({isActive})=>`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${isActive?'bg-k8s-500/15 text-k8s-400':'text-tactical-dim hover:bg-tactical-raised'}`}><item.icon aria-hidden="true" className="h-4 w-4" />{item.label}</NavLink>)}</nav></div><Outlet /></div>;
}
