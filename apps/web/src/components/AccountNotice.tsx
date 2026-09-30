import { Link } from 'react-router-dom';
import { Cloud, LogIn } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { useLoginPath } from '../hooks/useLoginPath';

export default function AccountNotice() {
  const { user, status, saving, error, retrySave } = useAccount();
  const login = useLoginPath();
  if (user && status === 'ready' && !saving && !error) return null;
  return (
    <div className="mb-5 rounded-lg border border-tactical-border bg-tactical-raised/50 p-4 text-sm" role="status">
      {status === 'loading' ? <p className="text-tactical-dim">Carregando sua conta…</p> : status === 'error' || (error && user) ? (
        <div className="flex flex-wrap items-center gap-3"><p className="text-signal-amber">{error ?? 'Não foi possível confirmar sua sessão. Tente novamente para responder.'}</p><button className="text-k8s-400 underline disabled:opacity-50" disabled={saving} onClick={() => void retrySave()}>Tentar novamente</button></div>
      ) : user ? (
        <p className="flex items-center gap-2 text-tactical-dim"><Cloud className="h-4 w-4 shrink-0 text-k8s-400" />Salvando seu progresso…</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-tactical-dim">Entre para responder às perguntas e salvar seu progresso na sua conta.</p><Link to={login} className="inline-flex items-center gap-2 font-medium text-k8s-400 hover:underline"><LogIn className="h-4 w-4" />Entrar com Google ou GitHub</Link></div>
      )}
    </div>
  );
}
