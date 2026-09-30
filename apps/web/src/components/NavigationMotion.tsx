import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;

// Each navigation uses a LayoutGroup so its indicator only moves within that menu.
export function NavigationHighlight() {
  const reducedMotion = useReducedMotion();
  return <motion.span
    aria-hidden="true"
    layoutId={reducedMotion ? undefined : 'active-option'}
    initial={false}
    transition={{ duration: reducedMotion ? 0 : 0.3, ease }}
    className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-k8s-500/15"
  />;
}

export function AnimatedCollapse({ open, id, labelledBy, className, children }: {
  open: boolean;
  id: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Closing content leaves keyboard navigation immediately, including during the exit.
    if (content.current) content.current.inert = !open;
  }, [open]);
  return <motion.div
    id={id}
    role={labelledBy ? 'region' : undefined}
    aria-labelledby={labelledBy}
    aria-hidden={!open}
    ref={content}
    initial={false}
    animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
    transition={{ height: { duration: reducedMotion ? 0 : 0.3, ease }, opacity: { duration: reducedMotion ? 0 : 0.18 } }}
    style={{ pointerEvents: open ? 'auto' : 'none' }}
    className={`overflow-hidden ${className ?? ''}`}
  >{children}</motion.div>;
}
