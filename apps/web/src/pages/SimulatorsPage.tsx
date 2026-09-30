import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { FlaskConical } from 'lucide-react';
import { simulators } from '../components/simulators/registry';
import { simulatorCategories } from '../components/simulators/catalog';
import SimulatorCatalog from '../components/SimulatorCatalog';

export default function SimulatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedCategory = searchParams.get('tema');
  const categoryId = requestedCategory === 'todos' || simulatorCategories.some((category) => category.id === requestedCategory)
    ? requestedCategory! : simulatorCategories[0].id;
  const query = searchParams.get('q') ?? '';
  const currentSearch = new URLSearchParams(searchParams);
  currentSearch.set('tema', categoryId);
  const catalogSearch = `?${currentSearch.toString()}`;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const filter = (category: string, text: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tema', category);
    if (text) next.set('q', text); else next.delete('q');
    setSearchParams(next, { replace: true });
  };
  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-tactical-border pb-7">
        <div className="max-w-2xl"><p className="label mb-3">Aprenda fazendo</p><h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none sm:text-4xl">Simuladores</h1><p className="mt-3 text-sm leading-6 text-tactical-dim sm:text-base">Escolha um tema, abra um laboratório e veja o Kubernetes em ação. Seu próximo experimento começa aqui.</p></div>
        <div className="flex items-center gap-4 rounded-xl border border-k8s-400/20 bg-k8s-500/5 px-4 py-3"><FlaskConical aria-hidden="true" className="h-6 w-6 text-k8s-400" /><p className="text-sm"><strong className="font-semibold text-white">{simulators.length} laboratórios</strong><span className="mt-1 block text-xs text-tactical-label">{simulatorCategories.length} temas para explorar</span></p></div>
      </header>
      <SimulatorCatalog categoryId={categoryId} query={query} search={catalogSearch} onFilter={filter} />
    </motion.div>
  );
}
