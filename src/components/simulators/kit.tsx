import { ReactNode, useEffect, useRef } from 'react';

export function useInterval(fn: () => void, ms: number | null) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

const alphabet = 'bcdfghjklmnpqrstvwxz2456789';
export const rid = (n = 5) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

export function SimFrame({ title, children, toolbar }: { title: string; children: ReactNode; toolbar?: ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-tactical-border bg-tactical-raised/60 px-4 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-green/70" />
        </span>
        <span className="label">{title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export type Tone = 'green' | 'amber' | 'red' | 'cyan' | 'dim' | 'blue';
export const toneClass: Record<Tone, string> = {
  green: 'border-signal-green/60 bg-signal-green/10 text-signal-green',
  amber: 'border-signal-amber/60 bg-signal-amber/10 text-signal-amber',
  red: 'border-signal-red/60 bg-signal-red/10 text-signal-red',
  cyan: 'border-signal-cyan/60 bg-signal-cyan/10 text-signal-cyan',
  blue: 'border-k8s-400/60 bg-k8s-500/10 text-k8s-400',
  dim: 'border-tactical-line bg-tactical-raised text-tactical-label',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${toneClass[tone]}`}>{children}</span>;
}

export interface LogEntry {
  id: number;
  text: string;
  tone?: Tone;
}

let logSeq = 0;
export const logEntry = (text: string, tone?: Tone): LogEntry => ({ id: ++logSeq, text, tone });

export function EventLog({ entries, title = 'Events', height = 'h-48' }: { entries: LogEntry[]; title?: string; height?: string }) {
  return (
    <div className="rounded-md border border-tactical-border bg-black/50">
      <div className="label border-b border-tactical-border px-3 py-1.5">{title}</div>
      <div className={`${height} overflow-y-auto px-3 py-2 font-mono text-xs leading-5`}>
        {entries.length === 0 && <div className="text-tactical-label">sem eventos…</div>}
        {entries.map((e) => (
          <div key={e.id} className={e.tone ? toneClass[e.tone].split(' ').find((c) => c.startsWith('text-')) : 'text-tactical-dim'}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keeps the newest entries first and caps the list size. */
export const pushLog = (list: LogEntry[], ...items: LogEntry[]) => [...items.reverse(), ...list].slice(0, 60);

export function Stepper({ label, value, onChange, min = 0, max = 10 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">{label}</span>
      <button className="btn-ghost px-2 py-1" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="w-6 text-center font-mono">{value}</span>
      <button className="btn-ghost px-2 py-1" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
