import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import type { AdminUserSummary } from '@jack-academy/contracts';

export const adminDate = (value: string | null, time = false) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', ...(time ? { timeStyle: 'short' as const } : {}), timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Sem registro';
export const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;

export function AdminFeedback({ loading, error, reload }: { loading: boolean; error: string | null; reload: () => void }) {
  return loading ? <p role="status" className="flex items-center gap-3 rounded-xl border border-tactical-border p-6 text-sm text-tactical-dim"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-k8s-400 motion-reduce:animate-none" />Carregando dados…</p> : error ? <div className="rounded-xl border border-signal-amber/25 p-6"><p role="alert" className="text-sm text-signal-amber">{error}</p><button type="button" onClick={reload} className="btn-ghost mt-4 min-h-11">Tentar novamente</button></div> : null;
}
export function AdminPagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label="Paginação" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-tactical-label"><p>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : 'Nenhum resultado'}</p><div className="flex items-center gap-3"><button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn-ghost min-h-11 px-3"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button><span>Página {page} de {pages}</span><button type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn-ghost min-h-11 px-3"><ArrowRight aria-hidden="true" className="h-4 w-4" /></button></div></nav>;
}
export function AdminUserStatus({ user }: { user: AdminUserSummary }) {
  const label = user.certificateId ? 'Certificado emitido' : user.completed ? 'Trilha concluída' : user.started ? 'Em aprendizado' : 'Sem início';
  const tone = user.certificateId ? 'text-signal-amber bg-signal-amber/10' : user.completed ? 'text-signal-green bg-signal-green/10' : user.started ? 'text-k8s-400 bg-k8s-500/10' : 'text-tactical-label bg-tactical-raised';
  return <span className={`inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
