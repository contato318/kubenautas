import { useRef } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, ChevronDown, FlaskConical, LayoutGrid, Network, Package, Radar, Search, SearchX, ShieldCheck, Workflow, Wrench, X, type LucideIcon } from 'lucide-react';
import { searchSimulators, simulatorCategories, simulatorCategory } from './simulators/catalog';
import { simulators } from './simulators/registry';
import { NavigationHighlight } from './NavigationMotion';

export const categoryIcons: Record<string, LucideIcon> = {
  todos: LayoutGrid, cluster: Boxes, rede: Network, helm: Package,
  diagnostico: Wrench, operators: Workflow, seguranca: ShieldCheck, pentest: Radar,
};

interface Props {
  categoryId: string;
  query: string;
  search: string;
  onFilter: (categoryId: string, query: string) => void;
}

export default function SimulatorCatalog({ categoryId, query, search, onFilter }: Props) {
  const reducedMotion = useReducedMotion();
  const catalogStart = useRef<HTMLDivElement>(null);
  const category = simulatorCategories.find((item) => item.id === categoryId);
  const results = searchSimulators(categoryId, query);
  const categories = [
    { id: 'todos', title: 'Todos os temas', count: simulators.length },
    ...simulatorCategories.map((item) => ({ ...item, count: item.simulatorIds.length })),
  ];
  const CategoryIcon = categoryIcons[categoryId] ?? LayoutGrid;
  const changeCategory = (id: string) => {
    onFilter(id, query);
    const top = catalogStart.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 96) {
      window.scrollTo({ top: window.scrollY + top - 96, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
      <motion.aside layoutScroll className="hidden rounded-2xl border border-tactical-border bg-tactical-surface p-3 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
        <h2 className="label px-3 pb-3 pt-2">Explore por tema</h2>
        <div role="group" aria-label="Categorias dos simuladores" className="space-y-1">
          <LayoutGroup id="simulator-categories">
            {categories.map((item) => {
              const Icon = categoryIcons[item.id];
              const selected = categoryId === item.id;
              return (
                <button key={item.id} type="button" aria-pressed={selected} aria-controls="simulator-results" onClick={() => changeCategory(item.id)} className={`relative isolate flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${selected ? 'font-medium text-k8s-400' : 'text-tactical-dim hover:bg-tactical-raised hover:text-white'}`}>
                  {selected && <NavigationHighlight />}
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  <span className={`font-mono text-[11px] ${selected ? 'text-k8s-400' : 'text-tactical-label'}`}>{item.count}</span>
                </button>
              );
            })}
          </LayoutGroup>
        </div>
        <div className="mx-3 mt-4 border-t border-tactical-border pb-2 pt-4">
          <p className="flex items-center gap-2 text-xs font-medium text-tactical-dim"><FlaskConical aria-hidden="true" className="h-4 w-4 text-k8s-400" />Aprenda experimentando</p>
          <p className="mt-2 text-xs leading-5 text-tactical-label">Altere parâmetros e observe os efeitos. Cada laboratório roda direto no navegador.</p>
        </div>
      </motion.aside>

      <div ref={catalogStart} className="min-w-0">
        <div className="mb-5 lg:hidden">
          <label htmlFor="simulator-category" className="mb-2 block text-xs font-medium text-tactical-dim">Escolha um tema</label>
          <div className="relative">
            <CategoryIcon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-k8s-400" />
            <select id="simulator-category" value={categoryId} onChange={(event) => changeCategory(event.target.value)} className="min-h-12 w-full appearance-none rounded-xl border border-tactical-line bg-tactical-surface py-3 pl-11 pr-10 text-sm text-tactical-text focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400">
              {categories.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.count})</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tactical-label" />
          </div>
        </div>

        <div className="relative">
          <label htmlFor="simulator-search" className="sr-only">Buscar simuladores</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-tactical-label" />
          <input id="simulator-search" type="search" value={query} onChange={(event) => onFilter(categoryId, event.target.value)} placeholder={category ? 'Buscar neste tema…' : 'Buscar simuladores…'} className="min-h-12 w-full rounded-xl border border-tactical-line bg-tactical-surface py-3 pl-12 pr-12 text-sm text-white placeholder:text-tactical-label focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400 [&::-webkit-search-cancel-button]:appearance-none" />
          {query && <button type="button" aria-label="Limpar busca" onClick={() => onFilter(categoryId, '')} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-tactical-label hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400"><X aria-hidden="true" className="h-4 w-4" /></button>}
        </div>

        <div className="mb-5 mt-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="simulator-category-title" className="text-xl font-semibold">{category?.title ?? 'Todos os simuladores'}</h2>
            <p role="status" aria-live="polite" className="text-xs text-tactical-label">{results.length} {results.length === 1 ? 'simulador disponível' : 'simuladores disponíveis'}</p>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-tactical-dim">{category?.description ?? 'Encontre o laboratório para o que você quer aprender ou use a busca para chegar direto ao assunto.'}</p>
        </div>

        <motion.div key={categoryId} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }} id="simulator-results" aria-labelledby="simulator-category-title">
          {results.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((simulator) => {
                const group = simulatorCategory(simulator.id)!;
                return (
                  <li key={simulator.id} className="min-w-0">
                    <Link to={{ pathname: `/simuladores/${simulator.id}`, search }} aria-label={`Abrir simulador: ${simulator.title}`} aria-describedby={`simulator-description-${simulator.id}`} className="group flex h-full flex-col rounded-xl border border-tactical-border bg-tactical-surface p-5 transition-[background-color,border-color,transform] hover:border-k8s-400/60 hover:bg-[#111b2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-k8s-400 motion-safe:hover:-translate-y-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl border border-tactical-line bg-tactical-raised text-xl">{simulator.emoji}</span>
                        {simulator.id === 'terminal' ? <span className="rounded-full bg-k8s-500/15 px-2.5 py-1 text-[10px] font-medium text-k8s-400">Comece por aqui</span> : categoryId === 'todos' && <span className="text-[10px] text-tactical-label">{group.title}</span>}
                      </div>
                      <h3 className="mt-5 text-base font-semibold leading-6 text-tactical-text transition-colors group-hover:text-white">{simulator.title}</h3>
                      <p id={`simulator-description-${simulator.id}`} className="mb-5 mt-2 text-sm leading-6 text-tactical-dim">{simulator.description}</p>
                      <span className="mt-auto flex items-center justify-between gap-2 border-t border-tactical-border pt-4 text-xs font-medium text-k8s-400">Abrir laboratório<ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-tactical-line px-5 py-12 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-8 w-8 text-tactical-label" />
              <h3 className="mt-4 text-lg font-medium">Nenhum simulador encontrado</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-tactical-dim">Tente outro termo{category ? ' ou amplie a busca para todos os temas' : ''}.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {category && <button type="button" onClick={() => changeCategory('todos')} className="btn-primary min-h-11">Buscar em todos os temas</button>}
                <button type="button" onClick={() => onFilter(categoryId, '')} className="btn-ghost min-h-11">Limpar busca</button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
