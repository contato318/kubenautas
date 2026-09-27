import { useState } from 'react';
import { Pause, Play, Plus, Server, Skull } from 'lucide-react';
import { Badge, EventLog, LogEntry, SimFrame, Stepper, logEntry, pushLog, rid, useInterval, type Tone } from './kit';

type Phase = 'Pending' | 'ContainerCreating' | 'Running' | 'Terminating' | 'Unknown';

interface Pod {
  name: string;
  node: string | null;
  phase: Phase;
  /** ticks spent in the current phase */
  t: number;
}

interface Node {
  name: string;
  ready: boolean;
  /** ticks since the node went NotReady */
  downFor: number;
}

interface State {
  desired: number;
  pods: Pod[];
  nodes: Node[];
  log: LogEntry[];
}

const RS = 'web-6f7c9d';
/** Ticks a node must be NotReady before its Pods are evicted (real default: 5 min). */
const EVICTION_TICKS = 5;

const phaseTone: Record<Phase, Tone> = {
  Pending: 'amber',
  ContainerCreating: 'cyan',
  Running: 'green',
  Terminating: 'red',
  Unknown: 'dim',
};

function initial(): State {
  const nodes = ['worker-1', 'worker-2', 'worker-3'].map((name) => ({ name, ready: true, downFor: 0 }));
  const pods: Pod[] = nodes.map((n) => ({ name: `${RS}-${rid()}`, node: n.name, phase: 'Running', t: 0 }));
  return { desired: 3, pods, nodes, log: [logEntry('Deployment web criado com 3 réplicas', 'blue')] };
}

function step(s: State): State {
  let log = s.log;
  const add = (text: string, tone?: Tone) => (log = pushLog(log, logEntry(text, tone)));
  const readyNodes = new Set(s.nodes.filter((n) => n.ready).map((n) => n.name));

  // Node controller: time out unreachable nodes.
  const nodes = s.nodes.map((n) => (n.ready ? n : { ...n, downFor: n.downFor + 1 }));

  // Kubelet / lifecycle progression.
  let pods: Pod[] = [];
  for (const p of s.pods) {
    const t = p.t + 1;
    if (p.phase === 'Terminating') {
      if (t >= 2) add(`pod ${p.name} removido`, 'dim');
      else pods.push({ ...p, t });
      continue;
    }
    if (p.node && !readyNodes.has(p.node)) {
      const node = nodes.find((n) => n.name === p.node)!;
      if (node.downFor >= EVICTION_TICKS) {
        add(`node-controller: ${p.node} NotReady há muito tempo → pod ${p.name} marcado para remoção`, 'red');
        pods.push({ ...p, phase: 'Terminating', t: 0 });
      } else {
        if (p.phase !== 'Unknown') add(`pod ${p.name}: nó ${p.node} parou de responder → status Unknown`, 'amber');
        pods.push({ ...p, phase: 'Unknown', t });
      }
      continue;
    }
    if (p.phase === 'Unknown') {
      add(`kubelet@${p.node} voltou a reportar → ${p.name} Running`, 'green');
      pods.push({ ...p, phase: 'Running', t: 0 });
      continue;
    }
    if (p.phase === 'ContainerCreating' && t >= 2) {
      add(`kubelet@${p.node}: container iniciado → ${p.name} Running`, 'green');
      pods.push({ ...p, phase: 'Running', t: 0 });
      continue;
    }
    pods.push({ ...p, t });
  }

  // ReplicaSet controller: count Pods not being deleted.
  const live = pods.filter((p) => p.phase !== 'Terminating');
  if (live.length < s.desired) {
    const missing = s.desired - live.length;
    add(`replicaset-controller: tenho ${live.length}, quero ${s.desired} → criando ${missing} pod(s)`, 'blue');
    for (let i = 0; i < missing; i++) pods.push({ name: `${RS}-${rid()}`, node: null, phase: 'Pending', t: 0 });
  } else if (live.length > s.desired) {
    const extra = live.length - s.desired;
    add(`replicaset-controller: tenho ${live.length}, quero ${s.desired} → removendo ${extra} pod(s)`, 'blue');
    // Delete the least valuable first: pending, then unknown, then creating, then running.
    const rank: Record<Phase, number> = { Pending: 0, Unknown: 1, ContainerCreating: 2, Running: 3, Terminating: 4 };
    const victims = new Set([...live].sort((a, b) => rank[a.phase] - rank[b.phase]).slice(0, extra).map((p) => p.name));
    pods = pods.map((p) => (victims.has(p.name) ? { ...p, phase: 'Terminating' as Phase, t: 0 } : p));
  }

  // Scheduler: bind Pending Pods to the ready node with the fewest Pods.
  const candidates = nodes.filter((n) => n.ready);
  const load = new Map(nodes.map((n) => [n.name, pods.filter((x) => x.node === n.name && x.phase !== 'Terminating').length]));
  pods = pods.map((p) => {
    if (p.phase !== 'Pending' || p.t < 1) return p;
    if (candidates.length === 0) {
      if (p.t === 1) add(`scheduler: 0/${nodes.length} nodes are available → ${p.name} continua Pending`, 'amber');
      return p;
    }
    const target = [...candidates].sort((a, b) => load.get(a.name)! - load.get(b.name)!)[0];
    load.set(target.name, load.get(target.name)! + 1);
    add(`scheduler: ${p.name} → ${target.name}`, 'cyan');
    return { ...p, node: target.name, phase: 'ContainerCreating', t: 0 };
  });

  return { ...s, nodes, pods, log };
}

export default function DeploymentSim() {
  const [s, setS] = useState<State>(initial);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(step), running ? 900 : null);

  const killPod = (name: string) =>
    setS((st) => ({
      ...st,
      pods: st.pods.map((p) => (p.name === name && p.phase !== 'Terminating' ? { ...p, phase: 'Terminating', t: 0 } : p)),
      log: pushLog(st.log, logEntry(`$ kubectl delete pod ${name}`, 'red')),
    }));

  const toggleNode = (name: string) =>
    setS((st) => {
      const node = st.nodes.find((n) => n.name === name)!;
      return {
        ...st,
        nodes: st.nodes.map((n) => (n.name === name ? { ...n, ready: !n.ready, downFor: 0 } : n)),
        log: pushLog(st.log, logEntry(node.ready ? `💥 ${name} caiu (NotReady)` : `✅ ${name} voltou (Ready)`, node.ready ? 'red' : 'green')),
      };
    });

  const addNode = () =>
    setS((st) => {
      const name = `worker-${st.nodes.length + 1}`;
      return { ...st, nodes: [...st.nodes, { name, ready: true, downFor: 0 }], log: pushLog(st.log, logEntry(`➕ ${name} entrou no cluster`, 'green')) };
    });

  const setDesired = (n: number) =>
    setS((st) => ({ ...st, desired: n, log: pushLog(st.log, logEntry(`$ kubectl scale deployment web --replicas=${n}`, 'blue')) }));

  const live = s.pods.filter((p) => p.phase !== 'Terminating');
  const ready = s.pods.filter((p) => p.phase === 'Running').length;
  const unscheduled = s.pods.filter((p) => !p.node);

  return (
    <SimFrame
      title="deployment/web · self-healing"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)} title={running ? 'Pausar' : 'Continuar'}>
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initial())}>Reset</button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-6">
        <Stepper label="spec.replicas" value={s.desired} onChange={setDesired} max={12} />
        <div className="font-mono text-sm">
          <span className="label mr-2">READY</span>
          <span className={ready === s.desired && live.length === s.desired ? 'text-signal-green' : 'text-signal-amber'}>
            {ready}/{s.desired}
          </span>
        </div>
        <button className="btn-ghost px-3 py-1" onClick={addNode}>
          <Plus className="h-3.5 w-3.5" /> Adicionar nó
        </button>
        <span className="text-xs text-tactical-label">Dica: clique num Pod para deletá-lo e no ícone de um nó para derrubá-lo.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {s.nodes.map((n) => {
          const pods = s.pods.filter((p) => p.node === n.name);
          return (
            <div key={n.name} className={`rounded-md border p-3 ${n.ready ? 'border-tactical-line bg-tactical-bg' : 'border-signal-red/60 bg-signal-red/5'}`}>
              <div className="mb-3 flex items-center gap-2">
                <button onClick={() => toggleNode(n.name)} title={n.ready ? 'Derrubar nó' : 'Religar nó'} className="rounded p-1 hover:bg-tactical-raised">
                  <Server className={`h-4 w-4 ${n.ready ? 'text-signal-green' : 'text-signal-red'}`} />
                </button>
                <span className="font-mono text-sm">{n.name}</span>
                <span className="ml-auto">
                  <Badge tone={n.ready ? 'green' : 'red'}>{n.ready ? 'Ready' : `NotReady ${Math.min(n.downFor, EVICTION_TICKS)}/${EVICTION_TICKS}`}</Badge>
                </span>
              </div>
              <div className="flex min-h-[64px] flex-wrap gap-2">
                {pods.map((p) => (
                  <PodChip key={p.name} pod={p} onKill={() => killPod(p.name)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-signal-amber/50 p-3">
          <div className="label mb-2">Fila do scheduler (sem nó)</div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((p) => (
              <PodChip key={p.name} pod={p} onKill={() => killPod(p.name)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <EventLog entries={s.log} title="Eventos do controlador" />
      </div>
    </SimFrame>
  );
}

function PodChip({ pod, onKill }: { pod: Pod; onKill: () => void }) {
  return (
    <button
      onClick={onKill}
      disabled={pod.phase === 'Terminating'}
      className={`group relative rounded border border-tactical-line bg-tactical-surface px-2 py-1.5 text-left font-mono text-[11px] transition-all ${
        pod.phase === 'Terminating' ? 'scale-95 opacity-50' : 'hover:border-signal-red'
      }`}
      title="Clique para deletar"
    >
      <div className="text-tactical-text">{pod.name.slice(-11)}</div>
      <Badge tone={phaseTone[pod.phase]}>{pod.phase}</Badge>
      <Skull className="absolute right-1 top-1 hidden h-3 w-3 text-signal-red group-hover:block" />
    </button>
  );
}
