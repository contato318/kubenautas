import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, Stepper, logEntry, pushLog, rid, useInterval } from './kit';

/**
 * kubectl drain = cordon + eviction de cada Pod do nó, respeitando o PodDisruptionBudget:
 * uma eviction só é aceita se, depois dela, ainda restarem pelo menos minAvailable Pods saudáveis.
 * Pods removidos são recriados pelo ReplicaSet em nós não cordonados.
 */

export const READY_AFTER = 2; // ticks até o Pod novo ficar Ready

export interface DNode {
  name: string;
  cordoned: boolean;
  draining: boolean;
}

export interface DPod {
  name: string;
  node: string | null;
  age: number;
}

export interface DrainState {
  t: number;
  nodes: DNode[];
  pods: DPod[];
  replicas: number;
  /** null = sem PDB */
  minAvailable: number | null;
  log: LogEntry[];
}

export const isReady = (p: DPod) => p.node !== null && p.age >= READY_AFTER;

export const initialDrain = (): DrainState => ({
  t: 0,
  nodes: ['node-1', 'node-2', 'node-3'].map((name) => ({ name, cordoned: false, draining: false })),
  pods: ['node-1', 'node-2', 'node-3'].map((node) => ({ name: `web-${rid()}`, node, age: 99 })),
  replicas: 3,
  minAvailable: 2,
  log: [logEntry('Deployment web: 3 réplicas · PDB minAvailable=2', 'blue')],
});

/** A eviction é permitida pelo PDB? */
export function evictionAllowed(s: Pick<DrainState, 'pods' | 'minAvailable'>, pod: DPod) {
  if (s.minAvailable === null) return true;
  const healthy = s.pods.filter(isReady).length;
  const after = healthy - (isReady(pod) ? 1 : 0);
  return after >= s.minAvailable;
}

export function stepDrain(s: DrainState): DrainState {
  const t = s.t + 1;
  let log = s.log;
  let pods = s.pods.map((p) => (p.node ? { ...p, age: p.age + 1 } : p));
  const nodes = s.nodes.map((n) => ({ ...n }));

  // ReplicaSet
  while (pods.length < s.replicas) pods.push({ name: `web-${rid()}`, node: null, age: 0 });
  if (pods.length > s.replicas) pods = pods.slice(0, s.replicas);

  // Scheduler: nó não cordonado com menos Pods
  pods = pods.map((p) => {
    if (p.node) return p;
    const target = nodes
      .filter((n) => !n.cordoned)
      .sort((a, b) => pods.filter((x) => x.node === a.name).length - pods.filter((x) => x.node === b.name).length)[0];
    if (!target) return p;
    log = pushLog(log, logEntry(`${p.name} agendado em ${target.name}`, 'cyan'));
    return { ...p, node: target.name, age: 0 };
  });
  if (pods.some((p) => !p.node) && t % 3 === 0) log = pushLog(log, logEntry('Pods Pending: nenhum nó disponível (todos cordonados)', 'red'));

  // Evictions: uma tentativa por nó em drain a cada tick
  for (const n of nodes.filter((x) => x.draining)) {
    const victim = pods.find((p) => p.node === n.name);
    if (!victim) {
      n.draining = false;
      log = pushLog(log, logEntry(`node/${n.name} drained ✔ pronto para manutenção`, 'green'));
      continue;
    }
    if (evictionAllowed({ pods, minAvailable: s.minAvailable }, victim)) {
      pods = pods.filter((p) => p.name !== victim.name);
      log = pushLog(log, logEntry(`evicting pod ${victim.name} (${n.name})`, 'amber'));
    } else if (t % 2 === 0) {
      const healthy = pods.filter(isReady).length;
      log = pushLog(log, logEntry(`error when evicting ${victim.name}: Cannot evict pod as it would violate the pod's disruption budget (saudáveis ${healthy}, minAvailable ${s.minAvailable}) — tentando de novo`, 'red'));
    }
  }

  return { ...s, t, pods, nodes, log };
}

export default function DrainPdbSim() {
  const [s, setS] = useState<DrainState>(initialDrain);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(stepDrain), running ? 900 : null);

  const act = (name: string, patch: Partial<DNode>, msg: string) =>
    setS((st) => ({ ...st, nodes: st.nodes.map((n) => (n.name === name ? { ...n, ...patch } : n)), log: pushLog(st.log, logEntry(msg, 'blue')) }));

  const healthy = s.pods.filter(isReady).length;
  const allowed = s.minAvailable === null ? '∞' : Math.max(0, healthy - s.minAvailable);

  return (
    <SimFrame
      title="kubectl drain · policy/v1 PodDisruptionBudget"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initialDrain())}>Reset</button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Stepper label="Réplicas" value={s.replicas} min={1} max={6} onChange={(v) => setS((st) => ({ ...st, replicas: v }))} />
            <Choice
              label="PDB"
              value={s.minAvailable === null ? 'none' : String(s.minAvailable)}
              onChange={(v) => setS((st) => ({ ...st, minAvailable: v === 'none' ? null : Number(v), log: pushLog(st.log, logEntry(`PDB agora: ${v === 'none' ? 'nenhum' : `minAvailable=${v}`}`, 'blue')) }))}
              options={[{ value: 'none', label: 'sem PDB' }, ...[1, 2, 3, 4].map((n) => ({ value: String(n), label: `minAvailable: ${n}` }))]}
            />
            <div className="font-mono text-xs text-tactical-dim">
              saudáveis: <span className="text-signal-green">{healthy}</span> · disruptionsAllowed: <span className="text-signal-amber">{allowed}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {s.nodes.map((n) => (
              <div key={n.name} className={`rounded-md border p-3 ${n.cordoned ? 'border-signal-amber/50 bg-signal-amber/5' : 'border-tactical-border'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm">{n.name}</span>
                  {n.draining ? <Badge tone="amber">draining</Badge> : n.cordoned ? <Badge tone="amber">SchedulingDisabled</Badge> : <Badge tone="green">Ready</Badge>}
                </div>
                <div className="flex min-h-[44px] flex-wrap gap-1.5">
                  {s.pods.filter((p) => p.node === n.name).map((p) => (
                    <span key={p.name} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${isReady(p) ? 'border-signal-green/60 text-signal-green' : 'animate-pulse border-signal-cyan/60 text-signal-cyan'}`}>{p.name}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  {!n.cordoned ? (
                    <button className="btn-ghost px-2 py-1" onClick={() => act(n.name, { cordoned: true, draining: true }, `$ kubectl drain ${n.name} --ignore-daemonsets`)}>Drain</button>
                  ) : (
                    <button className="btn-ghost px-2 py-1" onClick={() => act(n.name, { cordoned: false, draining: false }, `$ kubectl uncordon ${n.name}`)}>Uncordon</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {s.pods.some((p) => !p.node) && (
            <div className="mt-3 font-mono text-xs text-signal-red">Pending: {s.pods.filter((p) => !p.node).map((p) => p.name).join(', ')}</div>
          )}
          <p className="mt-4 text-xs text-tactical-label">
            Experimente: com minAvailable 2, drene um nó e veja o substituto subir antes da próxima eviction. Com minAvailable 3 e 3 réplicas, o drain
            trava para sempre — até você aumentar as réplicas ou relaxar o PDB. Drene os três nós para ver os Pods ficarem Pending.
          </p>
        </div>
        <EventLog entries={s.log} height="h-96" />
      </div>
    </SimFrame>
  );
}
