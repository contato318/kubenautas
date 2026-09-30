import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LoaderCircle, Trash2 } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { ApiError } from '../lib/api';

export default function DeleteAccountSection() {
  const { user, deleteAccount } = useAccount();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const cancel = () => {
    setOpen(false);
    setConfirmation('');
    setError(null);
    trigger.current?.focus();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation.trim() !== 'EXCLUIR' || pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(user.id);
    } catch (cause) {
      setError(cause instanceof ApiError && [401, 409].includes(cause.status) ? cause.message : 'Não foi possível confirmar a exclusão. Confira sua conexão e tente novamente.');
    } finally { setPending(false); }
  };

  return <section aria-labelledby="delete-account-title" className="mt-10 rounded-xl border border-signal-red/25 bg-signal-red/[0.03] p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <Trash2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-signal-red" />
      <div className="min-w-0 flex-1">
        <h2 id="delete-account-title" className="text-lg font-semibold">Excluir minha conta</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-tactical-dim">Encerre sua conta e apague seus dados de aprendizado. Esta ação é permanente.</p>
        <Link to="/privacidade" className="mt-2 inline-flex min-h-11 items-center text-xs text-tactical-label underline underline-offset-4 hover:text-white">Saiba como seus dados são tratados</Link>
      </div>
    </div>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="delete-account-confirmation" disabled={pending} onClick={() => open ? cancel() : setOpen(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-signal-red/40 px-4 text-sm font-medium text-signal-red transition-colors hover:bg-signal-red/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-red disabled:cursor-not-allowed disabled:opacity-50"><Trash2 aria-hidden="true" className="h-4 w-4" />Excluir minha conta</button>
    {open && <form id="delete-account-confirmation" onSubmit={submit} aria-labelledby="delete-confirmation-title" aria-busy={pending} className="mt-5 border-t border-signal-red/20 pt-5">
      <h3 id="delete-confirmation-title" className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle aria-hidden="true" className="h-4 w-4 text-signal-red" />Confirme a exclusão permanente</h3>
      <p className="mt-3 break-words text-sm leading-6 text-tactical-dim">Conta selecionada: <strong className="text-tactical-text">{user.name}</strong>{user.email && <> ({user.email})</>} · {user.provider === 'google' ? 'Google' : 'GitHub'}.</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-tactical-dim">
        <li>Seu cadastro, progresso, notas, respostas e histórico serão apagados da plataforma.</li>
        <li>Seus certificados serão removidos e os links públicos deixarão de validar. Cópias já baixadas ou compartilhadas não são apagadas dos dispositivos de outras pessoas.</li>
        <li>Todas as sessões desta conta serão encerradas. Sua conta no Google ou GitHub e contas criadas com outro provedor não serão excluídas.</li>
        <li>Se entrar novamente, uma nova conta será criada, sem recuperar os dados anteriores.</li>
      </ul>
      <label htmlFor="delete-account-word" className="mt-5 block text-sm font-medium">Digite <strong className="font-mono text-signal-red">EXCLUIR</strong> para confirmar</label>
      <input id="delete-account-word" autoFocus autoComplete="off" spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} aria-describedby={error ? 'delete-account-error' : undefined} className="mt-2 min-h-12 w-full max-w-sm rounded-lg border border-tactical-line bg-tactical-bg px-4 font-mono text-sm focus:border-signal-red focus:outline-none focus:ring-1 focus:ring-signal-red disabled:opacity-50" />
      {error && <p id="delete-account-error" role="alert" className="mt-3 text-sm leading-6 text-signal-red">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={cancel} disabled={pending} className="btn-ghost min-h-11">Manter minha conta</button>
        <button type="submit" disabled={pending || confirmation.trim() !== 'EXCLUIR'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal-red px-4 py-3 text-sm font-semibold text-tactical-bg transition-colors enabled:hover:bg-signal-red/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-red disabled:cursor-not-allowed disabled:opacity-40">{pending ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Excluindo conta…</> : 'Excluir conta permanentemente'}</button>
      </div>
    </form>}
  </section>;
}
