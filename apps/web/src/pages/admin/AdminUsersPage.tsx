import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, Users } from 'lucide-react';
import type { AdminStage, AdminUsersResponse, AdminUserSummary } from '@jack-academy/contracts';
import { useAdminResource } from '../../hooks/useAdminResource';
import { AdminFeedback, AdminPagination, AdminUserStatus, adminDate, percent } from '../../components/admin/AdminUi';

const stages: {value:AdminStage;label:string}[] = [{value:'all',label:'Todos os usuários'},{value:'not_started',label:'Sem início registrado'},{value:'started',label:'Iniciaram o aprendizado'},{value:'completed',label:'Concluíram a trilha'},{value:'certified',label:'Emitiram certificado'}];

export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').slice(0,120);
  const stage = stages.some(item=>item.value===params.get('stage')) ? params.get('stage')! : 'all';
  const page = Math.max(1,Math.min(100000,Number.parseInt(params.get('page') ?? '1',10) || 1));
  const [search, setSearch] = useState(query);
  useEffect(()=>setSearch(query),[query]);
  const resource = useAdminResource<AdminUsersResponse>(`admin/users?${new URLSearchParams({q:query,stage,page:String(page),pageSize:'20'})}`);
  const {data,loading,error,reload}=resource;
  const update=(next: {q?:string;stage?:string;page?:number})=>setParams({q:next.q ?? query,stage:next.stage ?? stage,page:String(next.page ?? 1)});
  const submit=(event:FormEvent)=>{event.preventDefault();update({q:search.trim()});};
  const userLink=(user:AdminUserSummary)=><Link to={`/admin/usuarios/${user.id}`} state={{listSearch:params.toString()}} aria-label={`Ver usuário ${user.name}`} className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-medium text-k8s-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400">Ver detalhes<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>;

  return <>
    <header><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Usuários</h1><p className="mt-3 text-sm leading-6 text-tactical-dim">Encontre uma conta e acompanhe o que ela já fez na plataforma.</p></header>
    <div className="my-7 grid gap-4 rounded-xl border border-tactical-border bg-tactical-surface p-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={submit}><label htmlFor="admin-user-search" className="mb-2 block text-xs text-tactical-label">Buscar por nome ou e-mail</label><div className="flex gap-2"><input id="admin-user-search" type="search" maxLength={120} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome ou e-mail do usuário" className="min-h-12 min-w-0 flex-1 rounded-lg border border-tactical-line bg-tactical-bg px-3 text-sm focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400" /><button type="submit" aria-label="Buscar usuários" className="btn-primary min-h-12"><Search aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Buscar</span></button></div></form>
      <div><label htmlFor="admin-user-stage" className="mb-2 block text-xs text-tactical-label">Etapa de aprendizado</label><select id="admin-user-stage" value={stage} onChange={event=>update({stage:event.target.value})} className="min-h-12 w-full rounded-lg border border-tactical-line bg-tactical-bg px-3 text-sm focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400">{stages.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    </div>
    <AdminFeedback loading={loading} error={error} reload={reload} />
    {data && <>
      <p className="mb-4 text-sm text-tactical-dim">{data.total} {data.total === 1 ? 'usuário encontrado' : 'usuários encontrados'}</p>
      {data.users.length ? <>
        <div className="hidden overflow-x-auto rounded-xl border border-tactical-border md:block"><table className="w-full text-left text-sm"><thead className="border-b border-tactical-border bg-tactical-surface text-xs text-tactical-label"><tr>{['Usuário','Trilha','Prova','Etapa','Última atividade',''].map((label,index)=><th key={index} scope="col" className="whitespace-nowrap px-4 py-4 font-medium">{label || <span className="sr-only">Ações</span>}</th>)}</tr></thead><tbody className="divide-y divide-tactical-border">{data.users.map(user=><tr key={user.id} className="hover:bg-tactical-surface/70"><td className="max-w-64 px-4 py-4"><p className="break-words font-medium">{user.name}</p><p className="mt-1 break-all text-xs text-tactical-label">{user.email ?? 'E-mail não informado'}</p><p className="mt-2 text-[11px] text-tactical-label">Cadastro: {adminDate(user.createdAt)}</p></td><td className="whitespace-nowrap px-4 py-4"><p>{user.completedLessons}/{data.totalLessons} lições</p><div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-tactical-raised"><div style={{width:`${user.completedLessons/data.totalLessons*100}%`}} className="h-full rounded-full bg-signal-green" /></div></td><td className="px-4 py-4 font-mono text-xs">{percent(user.examBest)}</td><td className="px-4 py-4"><AdminUserStatus user={user} /></td><td className="whitespace-nowrap px-4 py-4 text-xs text-tactical-label">{adminDate(user.lastActivityAt,true)}</td><td className="whitespace-nowrap px-4 py-4">{userLink(user)}</td></tr>)}</tbody></table></div>
        <div className="space-y-4 md:hidden">{data.users.map(user=><article key={user.id} className="rounded-xl border border-tactical-border bg-tactical-surface p-5"><h2 className="break-words font-semibold">{user.name}</h2><p className="mt-2 break-all text-xs text-tactical-label">{user.email ?? 'E-mail não informado'}</p><div className="mt-3"><AdminUserStatus user={user} /></div><dl className="mt-5 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-tactical-label">Trilha</dt><dd className="mt-1">{user.completedLessons}/{data.totalLessons} lições</dd></div><div><dt className="text-tactical-label">Melhor nota na prova</dt><dd className="mt-1">{percent(user.examBest)}</dd></div><div><dt className="text-tactical-label">Cadastro</dt><dd className="mt-1">{adminDate(user.createdAt)}</dd></div><div><dt className="text-tactical-label">Última atividade</dt><dd className="mt-1">{adminDate(user.lastActivityAt,true)}</dd></div></dl><div className="mt-4 border-t border-tactical-border pt-2">{userLink(user)}</div></article>)}</div>
      </> : <div className="rounded-xl border border-dashed border-tactical-line p-8 text-center"><Users aria-hidden="true" className="mx-auto h-8 w-8 text-tactical-label" /><h2 className="mt-4 text-lg font-semibold">Nenhum usuário nesta seleção</h2><p className="mt-2 text-sm text-tactical-dim">Ajuste a busca ou a etapa para encontrar outras contas.</p><button type="button" onClick={()=>{setSearch('');update({q:'',stage:'all'});}} className="btn-ghost mt-5 min-h-11">Limpar filtros</button></div>}
      <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={value=>update({page:value})} />
    </>}
  </>;
}
