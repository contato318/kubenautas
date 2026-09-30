import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, Stepper, logEntry, pushLog, rid, useInterval } from './kit';

/**
 * Cluster Autoscaler simplificado (um node group):
 * - scale up: Pods Pending que caberiam num nó novo disparam nós, até o máximo do grupo;
 *   Pods que não caberiam nem num nó vazio NÃO disparam scale up;
 * - scale down: nó com requests abaixo de 50% por alguns ciclos, cujos Pods cabem nos outros nós, é removido —
 *   a menos que tenha Pod com safe-to-evict: "false" (ou abaixo do mínimo do grupo).
 * Tudo é baseado em requests, nunca no uso real.
 */

export const NODE_ALLOCATABLE = 3800; // millicores
export const PROVISION_TICKS = 4;
export const SCALE_DOWN_AFTER = 5;
export const UTIL_THRESHOLD = 0.5;

export interface CaNode {
  name: string;
  ready: boolean;
  provisionLeft: number;
  idle: number;
}

export interface CaPod {
  name: string;
  node: string | null;
}

export interface CaState {
  t: number;
  minNodes: number;
  maxNodes: number;
  replicas: number;
  podCpu: number;
  safeToEvict: boolean;
  nodes: CaNode[];
  pods: CaPod[];
  log: LogEntry[];
}

export const initialCa = (): CaState => ({
  t: 0,
  minNodes: 1,
  maxNodes: 6,
  replicas: 4,
  podCpu: 1000,
  safeToEvict: true,
  nodes: [
    { name: 'node-a', ready: true, provisionLeft: 0, idle: 0 },
    { name: 'node-b', ready: true, provisionLeft: 0, idle: 0 },
  ],
  pods: [],
  log: [logEntry('node group: min=1 max=6 · 3800m CPU por nó', 'blue')],
});

const used = (pods: CaPod[], node: string, cpu: number) => pods.filter((p) => p.node === node).length * cpu;

export function stepCa(s: CaState): CaState {
  const t = s.t + 1;
  let log = s.log;
  let nodes = s.nodes.map((n) => {
    if (n.ready) return n;
    const left = n.provisionLeft - 1;
    if (left <= 0) {
      log = pushLog(log, logEntry(`${n.name} Ready e disponível para agendamento`, 'green'));
      return { ...n, ready: true, provisionLeft: 0 };
    }
    return { ...n, provisionLeft: left };
  });

  // Deployment
  let pods = [...s.pods];
  while (pods.length < s.replicas) pods.push({ name: `app-${rid()}`, node: null });
  if (pods.length > s.replicas) {
    const pending = pods.filter((p) => !p.node);
    const remove = new Set([...pending, ...pods.filter((p) => p.node).reverse()].slice(0, pods.length - s.replicas).map((p) => p.name));
    pods = pods.filter((p) => !remove.has(p.name));
  }

  // Scheduler (first fit, somente requests)
  pods = pods.map((p) => {
    if (p.node) return p;
    const target = nodes.find((n) => n.ready && used(pods, n.name, s.podCpu) + s.podCpu <= NODE_ALLOCATABLE);
    if (!target) return p;
    const placed = { ...p, node: target.name };
    pods = pods.map((x) => (x.name === p.name ? placed : x));
    return placed;
  });

  const pending = pods.filter((p) => !p.node);
  const provisioning = nodes.filter((n) => !n.ready);
  const perNode = Math.floor(NODE_ALLOCATABLE / s.podCpu);

  // Scale up
  if (pending.length) {
    if (perNode === 0) {
      if (t % 3 === 0) log = pushLog(log, logEntry(`NotTriggerScaleUp: pod com ${s.podCpu}m não caberia nem em um nó novo (${NODE_ALLOCATABLE}m)`, 'red'));
    } else {
      const coming = provisioning.length * perNode;
      const needed = Math.ceil(Math.max(0, pending.length - coming) / perNode);
      const room = s.maxNodes - nodes.length;
      const add = Math.min(needed, room);
      for (let i = 0; i < add; i++) {
        const name = `node-${rid(4)}`;
        nodes = [...nodes, { name, ready: false, provisionLeft: PROVISION_TICKS, idle: 0 }];
        log = pushLog(log, logEntry(`TriggeredScaleUp: ${pending.length} Pod(s) Pending → criando ${name}`, 'amber'));
      }
      if (needed > room && t % 3 === 0) log = pushLog(log, logEntry(`max-nodes-total atingido (${s.maxNodes}): ${pending.length} Pod(s) continuam Pending`, 'red'));
    }
  }

  // Scale down (um nó por ciclo, só com o cluster estável)
  if (!pending.length && !nodes.some((n) => !n.ready)) {
    nodes = nodes.map((n) => ({ ...n, idle: used(pods, n.name, s.podCpu) / NODE_ALLOCATABLE < UTIL_THRESHOLD ? n.idle + 1 : 0 }));
    const candidate = nodes.filter((n) => n.idle >= SCALE_DOWN_AFTER).sort((a, b) => used(pods, a.name, s.podCpu) - used(pods, b.name, s.podCpu))[0];
    if (candidate && nodes.length > s.minNodes) {
      const moving = pods.filter((p) => p.node === candidate.name);
      const freeElsewhere = nodes.filter((n) => n.name !== candidate.name).reduce((a, n) => a + Math.floor((NODE_ALLOCATABLE - used(pods, n.name, s.podCpu)) / s.podCpu), 0);
      if (moving.length && !s.safeToEvict) {
        if (t % 4 === 0) log = pushLog(log, logEntry(`${candidate.name} subutilizado, mas tem Pod com safe-to-evict: "false" — scale down bloqueado`, 'red'));
      } else if (freeElsewhere >= moving.length) {
        nodes = nodes.filter((n) => n.name !== candidate.name);
        pods = pods.map((p) => (p.node === candidate.name ? { name: `app-${rid()}`, node: null } : p));
        log = pushLog(log, logEntry(`ScaleDown: ${candidate.name} removido (${moving.length} Pod(s) removidos; substitutos aguardam agendamento)`, 'cyan'));
      }
    }
  }

  return { ...s, t, nodes, pods, log };
}

export default function ClusterAutoscalerSim() {
  const [s, setS] = useState<CaState>(initialCa);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(stepCa), running ? 800 : null);
  const set = (patch: Partial<CaState>) => setS((st) => ({ ...st, ...patch }));
  const pending = s.pods.filter((p) => !p.node);

  return (
    <SimFrame
      title="cluster-autoscaler · node group workers"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initialCa())}>Reset</button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Stepper label="Réplicas" value={s.replicas} min={0} max={30} onChange={(v) => set({ replicas: v })} />
            <Choice label="requests.cpu por Pod" value={String(s.podCpu)} onChange={(v) => set({ podCpu: Number(v) })} options={[500, 1000, 2000, 4000].map((n) => ({ value: String(n), label: `${n}m` }))} />
            <Stepper label="max nós" value={s.maxNodes} min={1} max={8} onChange={(v) => set({ maxNodes: v })} />
            <label className="flex items-center gap-2 text-sm text-tactical-dim">
              <input type="checkbox" className="accent-[#326ce5]" checked={!s.safeToEvict} onChange={(e) => set({ safeToEvict: !e.target.checked })} /> Pods com safe-to-evict: "false"
            </label>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button className="btn-ghost px-2 py-1" onClick={() => set({ replicas: 18 })}>Pico de carga (18)</button>
            <button className="btn-ghost px-2 py-1" onClick={() => set({ replicas: 3 })}>Fim do pico (3)</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.nodes.map((n) => {
              const u = used(s.pods, n.name, s.podCpu);
              return (
                <div key={n.name} className={`rounded-md border p-3 ${n.ready ? 'border-tactical-border' : 'animate-pulse border-signal-amber/60'}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-sm">{n.name}</span>
                    {n.ready ? <Badge tone={n.idle > 0 ? 'amber' : 'green'}>{n.idle > 0 ? `ocioso ${n.idle}/${SCALE_DOWN_AFTER}` : 'Ready'}</Badge> : <Badge tone="amber">provisionando {n.provisionLeft}</Badge>}
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-tactical-raised">
                    <div className="h-full bg-k8s-500" style={{ width: `${(u / NODE_ALLOCATABLE) * 100}%` }} />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-tactical-label">requests {u}m / {NODE_ALLOCATABLE}m</div>
                </div>
              );
            })}
          </div>
          <div className={`mt-3 font-mono text-xs ${pending.length ? 'text-signal-red' : 'text-signal-green'}`}>
            {pending.length ? `${pending.length} Pod(s) Pending` : 'todos os Pods agendados'} · {s.nodes.length} nó(s)
          </div>
          <p className="mt-3 text-xs text-tactical-label">
            O autoscaler olha requests, não uso real: Pods sem requests nunca disparam nós. Com 4000m por Pod nada acontece — nem um nó novo comportaria o
            Pod. Marque safe-to-evict: "false" e veja o scale down travar depois do pico.
          </p>
        </div>
        <EventLog entries={s.log} height="h-96" />
      </div>
    </SimFrame>
  );
}
