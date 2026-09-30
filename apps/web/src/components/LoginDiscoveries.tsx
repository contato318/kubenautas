import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Lightbulb, Pause, Play } from 'lucide-react';

const ROTATION_SECONDS = 8;
const discoveries = [
  {
    title: 'Pode derrubar o Pod.',
    description: 'No simulador de self-healing, você provoca uma falha e acompanha o cluster criando uma nova réplica. É errando que se aprende.',
  },
  {
    title: 'Seu terminal já está pronto.',
    description: 'Experimente comandos kubectl em um cluster simulado, direto no navegador. Você começa a praticar sem instalar nada.',
  },
  {
    title: 'O diagnóstico vem antes da solução.',
    description: 'Nos estudos de caso, investigue os sintomas e escolha uma hipótese. Depois, descubra a causa, a correção e como prevenir a falha.',
  },
];

const controlClassName = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-blue-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400';

export default function LoginDiscoveries() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible');
  const section = useRef<HTMLElement>(null);
  const animation = useRef<{ stop: () => void } | null>(null);
  const inView = useInView(section, { amount: 0.5 });
  const reducedMotion = useReducedMotion();
  const progress = useMotionValue(0);
  const playing = !paused && pageVisible && inView && !reducedMotion;

  const changeDiscovery = useCallback((direction: number) => {
    animation.current?.stop();
    progress.set(0);
    setActiveIndex((index) => (index + direction + discoveries.length) % discoveries.length);
  }, [progress]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (!playing) return;
    // Use the same animation for the timer and its indicator, including pause/resume.
    const playback = animate(progress, 1, {
      duration: ROTATION_SECONDS * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => changeDiscovery(1),
    });
    animation.current = playback;
    return () => playback.stop();
  }, [playing, activeIndex, progress, changeDiscovery]);

  return (
    <section
      ref={section}
      aria-label="Curiosidades da plataforma"
      aria-roledescription="carrossel"
      onFocusCapture={(event) => {
        // Keyboard navigation stops rotation until the user chooses to resume it.
        if (!(event.target as HTMLElement).closest('[data-rotation-control]')) setPaused(true);
      }}
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0b162b]/80"
    >
      <div className="p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-[#ffd166]"><Lightbulb aria-hidden="true" className="h-4 w-4" />Você sabia?</p>
          <div className="-mr-2 ml-auto flex shrink-0 items-center">
            {!reducedMotion && (
              <button
                type="button"
                data-rotation-control
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? 'Retomar rotação automática' : 'Pausar rotação automática'}
                title={paused ? 'Retomar rotação automática' : 'Pausar rotação automática'}
                className={controlClassName}
              >
                {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
              </button>
            )}
            <button type="button" onClick={() => changeDiscovery(-1)} aria-label="Curiosidade anterior" className={controlClassName}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <span aria-hidden="true" className="min-w-8 text-center font-mono text-[10px] text-blue-200/70">0{activeIndex + 1}/0{discoveries.length}</span>
            <button type="button" onClick={() => changeDiscovery(1)} aria-label="Próxima curiosidade" className={controlClassName}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
        <div aria-live={playing ? 'off' : 'polite'} aria-atomic="true" className="grid overflow-hidden">
          {discoveries.map((discovery, index) => (
            <motion.div
              key={discovery.title}
              role="group"
              aria-roledescription="curiosidade"
              aria-label={`${index + 1} de ${discoveries.length}`}
              aria-hidden={index !== activeIndex}
              initial={false}
              animate={{ opacity: index === activeIndex ? 1 : 0, y: reducedMotion || index === activeIndex ? 0 : 12 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ pointerEvents: index === activeIndex ? 'auto' : 'none' }}
              className="min-w-0 [grid-area:1/1]"
            >
              <h3 className="text-sm font-semibold text-white">{discovery.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-blue-100/75">{discovery.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
      {!reducedMotion && <div aria-hidden="true" className="h-0.5 bg-white/5"><motion.div style={{ scaleX: progress }} className="h-full origin-left bg-gradient-to-r from-k8s-400 to-[#ffd166]" /></div>}
    </section>
  );
}
