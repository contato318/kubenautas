import { useState } from 'react';
import { Badge, MetricBox, SimFrame, Tone } from './kit';

/**
 * Memória num nó: QoS, OOMKilled e despejo pelo kubelet.
 * - QoS: Guaranteed (request = limit > 0), BestEffort (nada definido), senão Burstable;
 * - uso acima do limit → o kernel mata o container (OOMKilled);
 * - sob pressão de memória o kubelet despeja Pods nesta ordem: primeiro quem usa mais que o request,
 *   depois menor prioridade, depois quem mais excede o request.
 */

export const NODE_MEMORY = 4096; // Mi
export const EVICTION_HARD = 100; // memory.available<100Mi

export interface MemPod {
  name: string;
  request: number;
  limit: number; // 0 = sem limit
  usage: number;
  priority: number;
}

export type Qos = 'Guaranteed' | 'Burstable' | 'BestEffort';

export function qosClass(p: MemPod): Qos {
  if (p.request === 0 && p.limit === 0) return 'BestEffort';
  if (p.limit > 0 && p.request === p.limit) return 'Guaranteed';
  return 'Burstable';
}

/** Ordem de despejo do kubelet (primeiro = despejado primeiro). */
export function evictionOrder(pods: MemPod[]): MemPod[] {
  return [...pods].sort((a, b) => {
    const aOver = a.usage > a.request ? 0 : 1;
    const bOver = b.usage > b.request ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.usage - b.request - (a.usage - a.request);
  });
}

export interface NodeOutcome {
  pending: string[];
  oomKilled: string[];
  evicted: string[];
  pressure: boolean;
  usage: number;
}

export function simulateNode(pods: MemPod[]): NodeOutcome {
  // Agendamento por requests
  let requested = 0;
  const scheduled: MemPod[] = [];
  const pending: string[] = [];
  for (const p of pods) {
    if (requested + p.request <= NODE_MEMORY) {
      requested += p.request;
      scheduled.push(p);
    } else pending.push(p.name);
  }
  // Limit estourado: OOMKilled pelo kernel (o container reinicia e volta a crescer)
  const oomKilled = scheduled.filter((p) => p.limit > 0 && p.usage > p.limit).map((p) => p.name);
  const running = scheduled.filter((p) => !oomKilled.includes(p.name));
  let usage = running.reduce((a, p) => a + p.usage, 0);
  const pressure = NODE_MEMORY - usage < EVICTION_HARD;
  const evicted: string[] = [];
  if (pressure) {
    for (const p of evictionOrder(running)) {
      if (NODE_MEMORY - usage >= EVICTION_HARD) break;
      evicted.push(p.name);
      usage -= p.usage;
    }
  }
  return { pending, oomKilled, evicted, pressure, usage };
}

const INITIAL: MemPod[] = [
  { name: 'api', request: 1024, limit: 1024, usage: 800, priority: 0 },
  { name: 'worker', request: 512, limit: 2048, usage: 1200, priority: 0 },
  { name: 'cache', request: 0, limit: 0, usage: 600, priority: 0 },
  { name: 'batch', request: 256, limit: 0, usage: 900, priority: 0 },
];

const qosTone: Record<Qos, Tone> = { Guaranteed: 'green', Burstable: 'amber', BestEffort: 'red' };

export default function QosSim() {
  const [pods, setPods] = useState<MemPod[]>(INITIAL);
  const outcome = simulateNode(pods);
  const order = evictionOrder(pods);
  const set = (i: number, patch: Partial<MemPod>) => setPods((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const pct = Math.min(100, (outcome.usage / NODE_MEMORY) * 100);

  const statusOf = (p: MemPod): { text: string; tone: Tone } => {
    if (outcome.pending.includes(p.name)) return { text: 'Pending', tone: 'dim' };
    if (outcome.oomKilled.includes(p.name)) return { text: 'OOMKilled', tone: 'red' };
    if (outcome.evicted.includes(p.name)) return { text: 'Evicted', tone: 'red' };
    return { text: 'Running', tone: 'green' };
  };

  const num = (value: number, onChange: (v: number) => void) => (
    <input type="number" min={0} step={64} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className="w-20 rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" />
  );

  return (
    <SimFrame
      title={`node/worker-1 · memória ${NODE_MEMORY}Mi · eviction-hard memory.available<${EVICTION_HARD}Mi`}
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => set(2, { usage: 1400 })}>Cache cresce</button>
          <button className="btn-ghost px-2 py-1" onClick={() => set(1, { usage: 2300 })}>Worker vaza memória</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setPods(INITIAL)}>Reset</button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left">
              {['Pod', 'request (Mi)', 'limit (Mi, 0 = sem)', 'uso (Mi)', 'prioridade', 'QoS', 'status'].map((h) => (
                <th key={h} className="label px-2 py-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pods.map((p, i) => {
              const st = statusOf(p);
              const invalid = p.limit > 0 && p.limit < p.request;
              return (
                <tr key={p.name} className="border-t border-tactical-border">
                  <td className="px-2 py-1.5 font-mono">{p.name}</td>
                  <td className="px-2 py-1.5">{num(p.request, (v) => set(i, { request: v }))}</td>
                  <td className="px-2 py-1.5">{num(p.limit, (v) => set(i, { limit: v }))}{invalid && <div className="text-[10px] text-signal-red">limit menor que request: a API rejeita</div>}</td>
                  <td className="px-2 py-1.5">{num(p.usage, (v) => set(i, { usage: v }))}</td>
                  <td className="px-2 py-1.5">
                    <select className="rounded border border-tactical-border bg-tactical-bg px-1 py-1 font-mono text-xs" value={p.priority} onChange={(e) => set(i, { priority: Number(e.target.value) })}>
                      <option value={0}>0 (padrão)</option>
                      <option value={1000}>1000 (alta)</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><Badge tone={qosTone[qosClass(p)]}>{qosClass(p)}</Badge></td>
                  <td className="px-2 py-1.5"><Badge tone={st.tone}>{st.text}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricBox label="Uso de memória do nó" value={`${outcome.usage}Mi`} tone={outcome.pressure ? 'text-signal-red' : 'text-signal-green'} />
        <MetricBox label="Livre" value={`${NODE_MEMORY - outcome.usage}Mi`} />
        <MetricBox label="Condição" value={outcome.pressure ? 'MemoryPressure' : 'OK'} tone={outcome.pressure ? 'text-signal-red' : 'text-signal-green'} />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-tactical-raised">
        <div className={`h-full ${outcome.pressure ? 'bg-signal-red' : 'bg-signal-green'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 rounded-md border border-tactical-border bg-black/40 p-3 text-sm">
        <div className="label mb-1">Ordem de despejo se houver pressão de memória</div>
        <ol className="list-decimal space-y-0.5 pl-5 font-mono text-xs text-tactical-dim">
          {order.map((p) => (
            <li key={p.name}>
              {p.name} — {p.usage > p.request ? `usa ${p.usage - p.request}Mi acima do request` : 'dentro do request'} · prioridade {p.priority}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-xs text-tactical-label">
        OOMKilled é o kernel agindo no limit do container; Evicted é o kubelet protegendo o nó. Pods Guaranteed dentro do request são os últimos
        da fila — mas nenhum Pod é imune se o nó ficar sem memória.
      </p>
    </SimFrame>
  );
}
