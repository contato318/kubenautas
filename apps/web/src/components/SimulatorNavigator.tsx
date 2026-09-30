import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Search, SearchX, Terminal, X } from 'lucide-react';
import { categoryIcons } from './SimulatorCatalog';
import { AnimatedCollapse } from './NavigationMotion';
import { searchSimulators, simulatorCategories, simulatorCategory } from './simulators/catalog';
import { simulators } from './simulators/registry';
import type { SimulatorId } from '../types';

export default function SimulatorNavigator({ activeId, search, onNavigate }: { activeId?: SimulatorId; search: string; onNavigate?: () => void }) {
  const navigationId = useId();
  const activeCategory = activeId ? simulatorCategory(activeId)?.id : 'cluster';
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([activeCategory ?? 'cluster']);
  useEffect(() => {
    if (activeCategory) setExpanded((current) => current.includes(activeCategory) ? current : [...current, activeCategory]);
  }, [activeCategory]);
  const results = searchSimulators('todos', query);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="label">Laboratórios</h2><span className="rounded border border-tactical-border px-1.5 py-0.5 font-mono text-[10px] text-tactical-label">{simulators.length}</span></div>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-tactical-border bg-tactical-bg px-3 focus-within:border-k8s-400">
          <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-tactical-label" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar simulador…" aria-label="Buscar simulador no menu" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-tactical-label [&::-webkit-search-cancel-button]:hidden" />
          {query && <button type="button" aria-label="Limpar busca" className="rounded text-tactical-label hover:text-white" onClick={() => setQuery('')}><X aria-hidden="true" className="h-4 w-4" /></button>}
        </div>
      </div>
      <nav aria-label="Escolher simulador" className="lab-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {simulatorCategories.map((category) => {
          const items = category.simulatorIds.flatMap((id) => results.filter((item) => item.id === id));
          if (!items.length) return null;
          const Icon = categoryIcons[category.id];
          const open = !!query.trim() || expanded.includes(category.id);
          return (
            <div key={category.id} className="mb-1">
              <button type="button" aria-expanded={open} aria-controls={`${navigationId}-${category.id}`} onClick={() => setExpanded((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left text-xs font-medium text-tactical-dim hover:bg-tactical-raised hover:text-white">
                <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${category.id === activeCategory ? 'text-k8s-400' : 'text-tactical-label'}`} /><span className="flex-1">{category.title}</span><span className="font-mono text-[10px] text-tactical-label">{items.length}</span><ChevronDown aria-hidden="true" className={`h-3 w-3 text-tactical-label transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
              </button>
              <AnimatedCollapse open={open} id={`${navigationId}-${category.id}`}>
                <ul className="mb-3 ml-4 border-l border-tactical-border pl-2">
                {items.map((item) => <li key={item.id}><Link to={{ pathname: `/simuladores/${item.id}`, search }} onClick={onNavigate} aria-current={item.id === activeId ? 'page' : undefined} className={`my-0.5 flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-xs leading-5 transition-colors ${item.id === activeId ? 'bg-k8s-500/15 font-medium text-k8s-400 ring-1 ring-inset ring-k8s-400/20' : 'text-tactical-dim hover:bg-tactical-raised hover:text-white'}`}>
                  {item.id === 'terminal' ? <Terminal aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <span aria-hidden="true" className={`h-1 w-1 shrink-0 rounded-full ${item.id === activeId ? 'bg-k8s-400' : 'bg-tactical-line'}`} />}<span className="flex-1">{item.title}</span>{item.id === activeId && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-k8s-400" />}
                </Link></li>)}
                </ul>
              </AnimatedCollapse>
            </div>
          );
        })}
        {results.length === 0 && <div role="status" className="px-3 py-8 text-center"><SearchX aria-hidden="true" className="mx-auto mb-3 h-5 w-5 text-tactical-label" /><p className="text-sm text-tactical-dim">Nenhum simulador encontrado.</p><button type="button" onClick={() => setQuery('')} className="mt-3 min-h-11 text-xs text-k8s-400">Limpar busca</button></div>}
      </nav>
      <div className="border-t border-tactical-border p-3"><Link to={{ pathname: '/simuladores', search }} className="flex min-h-11 items-center justify-between rounded-md px-2 text-xs text-tactical-dim hover:bg-tactical-raised hover:text-white">Explorar catálogo<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></div>
    </div>
  );
}
