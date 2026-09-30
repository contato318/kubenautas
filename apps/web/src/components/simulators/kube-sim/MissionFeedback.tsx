import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Mission, MissionTask } from './session';

type Completion = { id: number; title: string; mission: string; step: number; total: number };
const ease = [0.22, 1, 0.36, 1] as const;
const particles = [
  { x: -24, y: -15 }, { x: -9, y: -27 }, { x: 18, y: -22 },
  { x: 27, y: 4 }, { x: 11, y: 26 }, { x: -22, y: 19 },
];

export function useObjectiveCompletion(done: boolean[][], missions: Mission[]) {
  const previous = useRef(done);
  const sequence = useRef(0);
  const [queue, setQueue] = useState<Completion[]>([]);
  // Cluster ticks publish fresh arrays. Only actual objective changes matter.
  const signature = done.map((tasks) => tasks.map(Number).join('')).join('|');
  useEffect(() => {
    const before = previous.current;
    previous.current = done;
    const reset = before.some((tasks, m) => tasks.some((complete, t) => complete && !done[m]?.[t]));
    if (reset) { setQueue([]); return; }
    const additions: Completion[] = [];
    done.forEach((tasks, m) => tasks.forEach((complete, t) => {
      if (complete && !before[m]?.[t]) additions.push({ id: ++sequence.current, title: missions[m].tasks[t].text, mission: missions[m].title, step: t + 1, total: tasks.length });
    }));
    if (additions.length) setQueue((items) => [...items, ...additions]);
  }, [signature, done, missions]);
  const active = queue[0];
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setQueue((items) => items.filter((item) => item.id !== active.id)), 3400);
    return () => window.clearTimeout(timer);
  }, [active?.id]);
  return active;
}

function CheckMark({ done, large = false, entrance = false }: { done: boolean; large?: boolean; entrance?: boolean }) {
  const reduced = useReducedMotion();
  return <motion.svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={large ? 'h-6 w-6' : 'h-4 w-4'} initial={entrance && !reduced ? { rotate: -18, scale: 0.65 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
    <motion.path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={entrance && !reduced ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.38, delay: reduced ? 0 : 0.12, ease }} />
  </motion.svg>;
}

function CompletionBurst() {
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <motion.span className="absolute inset-0 rounded-full border border-signal-green/70" initial={{ opacity: 0.8, scale: 0.6 }} animate={{ opacity: 0, scale: 2.1 }} transition={{ duration: 0.75, ease: 'easeOut' }} />
    {particles.map((particle, index) => <motion.span key={index} className={`absolute h-1 w-1 rounded-full ${index % 2 ? 'bg-k8s-400' : 'bg-signal-green'}`} initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }} animate={{ x: particle.x, y: particle.y, opacity: [0, 1, 0], scale: [0.3, 1, 0.3] }} transition={{ duration: 0.75, delay: index * 0.035, ease: 'easeOut' }} />)}
  </span>;
}

export const MissionTaskCard = memo(function MissionTaskCard({ task, index, done, onSuggest }: { task: MissionTask; index: number; done: boolean; onSuggest: (command: string) => void }) {
  const reduced = useReducedMotion();
  const wasDone = useRef(done);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const completed = done && !wasDone.current;
    wasDone.current = done;
    setFresh(completed);
    if (!completed) return;
    const timer = window.setTimeout(() => setFresh(false), 1100);
    return () => window.clearTimeout(timer);
  }, [done]);
  return <motion.li layout={reduced ? false : 'position'} data-objective-state={done ? 'complete' : 'pending'} initial={false} animate={{ backgroundColor: done ? 'rgba(52,211,153,0.055)' : 'rgba(52,211,153,0)', borderColor: done ? 'rgba(52,211,153,0.3)' : '#26262b', boxShadow: fresh && !reduced ? ['0 0 0 0 rgba(52,211,153,0)', '0 0 24px 0 rgba(52,211,153,0.18)', '0 0 0 0 rgba(52,211,153,0)'] : '0 0 0 0 rgba(52,211,153,0)' }} transition={{ duration: reduced ? 0 : 0.7, ease }} className="relative rounded-lg border p-3">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      {fresh && !reduced && <motion.div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-signal-green/15 to-transparent" initial={{ x: '0%', skewX: -20 }} animate={{ x: '400%' }} transition={{ duration: 0.85, ease }} />}
    </div>
    <div className="relative flex items-start gap-2.5">
      <motion.span aria-hidden="true" initial={false} animate={{ backgroundColor: done ? 'rgba(52,211,153,0.15)' : '#16161a', color: done ? '#34d399' : '#5b8def', scale: fresh && !reduced ? [1, 1.2, 1] : 1 }} transition={{ duration: reduced ? 0 : 0.45, ease }} className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px]">
        {fresh && !reduced && <CompletionBurst />}
        <span className="absolute"><CheckMark done={done} /></span>
        {!done && <span>{String(index + 1).padStart(2, '0')}</span>}
      </motion.span>
      <div className="min-w-0 flex-1">
        <AnimatePresence initial={false}>
          {done && <motion.p key="complete-label" aria-hidden="true" initial={reduced ? false : { opacity: 0, height: 0, y: 5 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : 0.24 }} className="mb-1 overflow-hidden font-mono text-[8px] uppercase tracking-[0.13em] text-signal-green">Objetivo concluído</motion.p>}
        </AnimatePresence>
        <p className="text-xs leading-5">{done && <span className="sr-only">Concluído: </span>}{task.text}</p>
      </div>
    </div>
    <AnimatePresence initial={false}>
      {!done && <motion.div key="task-help" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease }} className="overflow-hidden">
        <div className="mt-2 space-y-2 pl-[34px]">
          <details><summary className="cursor-pointer text-[10px] text-signal-amber">Dica</summary><p className="mt-2 text-[11px] leading-5 text-tactical-dim">{task.hint}</p></details>
          <details><summary className="cursor-pointer text-[10px] text-k8s-400">Ver solução</summary><pre className="my-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-tactical-bg p-2 font-mono text-[10px] leading-5 text-tactical-dim">{task.sol}</pre><button type="button" onClick={() => onSuggest(task.sol)} className="rounded-md border border-tactical-border px-3 py-2 text-[11px] text-tactical-dim hover:border-k8s-400 hover:text-k8s-400" aria-label={`Inserir solução: ${task.text}`}>Inserir no terminal</button></details>
        </div>
      </motion.div>}
    </AnimatePresence>
  </motion.li>;
});

export function ObjectiveProgress({ complete, total }: { complete: number; total: number }) {
  const reduced = useReducedMotion();
  return <div aria-hidden="true" className="mb-4 h-1 overflow-hidden rounded-full bg-tactical-border"><motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-k8s-400 to-signal-green" initial={false} animate={{ scaleX: complete / total }} transition={{ duration: reduced ? 0 : 0.6, ease }} /></div>;
}

export function CompletionNotice({ completion }: { completion?: Completion }) {
  const reduced = useReducedMotion();
  return <div role="status" aria-label="Objetivo concluído" className="pointer-events-none absolute inset-x-3 top-28 z-20 sm:left-auto sm:right-5 sm:w-[360px]" aria-live="polite" aria-atomic="true">
    <AnimatePresence mode="wait">
      {completion && <motion.div key={completion.id} data-completion-id={completion.id} initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.96, filter: 'blur(5px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: reduced ? 0 : 0.35, ease }} className="relative overflow-hidden rounded-xl border border-signal-green/35 bg-[#0d1b18]/95 p-4 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-signal-green/25 bg-signal-green/10 text-signal-green">
            {!reduced && <CompletionBurst />}
            <CheckMark done large entrance />
          </div>
          <div className="min-w-0 flex-1"><p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-signal-green">Objetivo concluído</p><p className="text-[13px] font-medium leading-5 text-white">{completion.title}</p><p className="mt-1.5 text-[10px] text-tactical-label">{completion.mission} <span aria-hidden="true">·</span> {completion.step}/{completion.total}</p></div>
        </div>
        {!reduced && <motion.div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-k8s-400 to-signal-green" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 3.4, ease: 'linear' }} />}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
