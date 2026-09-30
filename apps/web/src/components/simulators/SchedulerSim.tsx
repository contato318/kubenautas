import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge, SimFrame, rid } from './kit';

interface Node {
  name: string;
  cpu: number; // millicores allocatable
  mem: number; // MiB allocatable
  taint?: string;
}

interface PodTemplate {
  kind: string;
  cpu: number;
  mem: number;
  tolerates?: string;
  emoji: string;
}

interface Pod extends PodTemplate {
  name: string;
  node: string | null;
  reason?: string;
}

type Strategy = 'LeastAllocated' | 'MostAllocated';

interface Decision {
  pod: string;
  lines: { text: string; ok: boolean | null }[];
}

const templates: PodTemplate[] = [
  { kind: 'api', cpu: 250, mem: 256, emoji: '🟦' },
  { kind: 'worker', cpu: 500, mem: 1024, emoji: '🟩' },
  { kind: 'db', cpu: 1500, mem: 3072, emoji: '🟧' },
  { kind: 'ml', cpu: 1000, mem: 2048, tolerates: 'gpu', emoji: '🟪' },
];

const initialNodes = (): Node[] => [
  { name: 'worker-1', cpu: 2000, mem: 4096 },
  { name: 'worker-2', cpu: 2000, mem: 4096 },
  { name: 'gpu-1', cpu: 4000, mem: 8192, taint: 'gpu' },
];

const used = (pods: Pod[], node: string) =>
  pods.filter((p) => p.node === node).reduce((a, p) => ({ cpu: a.cpu + p.cpu, mem: a.mem + p.mem }), { cpu: 0, mem: 0 });

function schedule(pod: Pod, nodes: Node[], pods: Pod[], strategy: Strategy): { node: string | null; decision: Decision; reason?: string } {
  const lines: Decision['lines'] = [{ text: `Pod ${pod.name} pede cpu=${pod.cpu}m, memory=${pod.mem}Mi${pod.tolerates ? `, tolera ${pod.tolerates}` : ''}`, ok: null }];
  const feasible: Node[] = [];
  const reasons: Record<string, number> = {};
  const bump = (r: string) => (reasons[r] = (reasons[r] ?? 0) + 1);

  lines.push({ text: '— Filtragem —', ok: null });
  for (const n of nodes) {
    const u = used(pods, n.name);
    if (n.taint && pod.tolerates !== n.taint) {
      lines.push({ text: `${n.name}: taint dedicated=${n.taint}:NoSchedule não tolerado`, ok: false });
      bump('had untolerated taint');
    } else if (u.cpu + pod.cpu > n.cpu) {
      lines.push({ text: `${n.name}: CPU insuficiente (${n.cpu - u.cpu}m livres)`, ok: false });
      bump('Insufficient cpu');
    } else if (u.mem + pod.mem > n.mem) {
      lines.push({ text: `${n.name}: memória insuficiente (${n.mem - u.mem}Mi livres)`, ok: false });
      bump('Insufficient memory');
    } else {
      lines.push({ text: `${n.name}: cabe`, ok: true });
      feasible.push(n);
    }
  }

  if (feasible.length === 0) {
    const reason = `0/${nodes.length} nodes are available: ${Object.entries(reasons).map(([r, c]) => `${c} ${r}`).join(', ')}.`;
    lines.push({ text: reason, ok: false });
    return { node: null, decision: { pod: pod.name, lines }, reason };
  }

  lines.push({ text: `— Pontuação (${strategy}) —`, ok: null });
  const scored = feasible.map((n) => {
    const u = used(pods, n.name);
    const cpuFrac = (u.cpu + pod.cpu) / n.cpu;
    const memFrac = (u.mem + pod.mem) / n.mem;
    const alloc = (cpuFrac + memFrac) / 2;
    const score = Math.round((strategy === 'LeastAllocated' ? 1 - alloc : alloc) * 100);
    lines.push({ text: `${n.name}: score ${score}`, ok: null });
    return { n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  lines.push({ text: `✔ Vencedor: ${scored[0].n.name}`, ok: true });
  return { node: scored[0].n.name, decision: { pod: pod.name, lines } };
}

export default function SchedulerSim() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [pods, setPods] = useState<Pod[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('LeastAllocated');
  const [decision, setDecision] = useState<Decision | null>(null);

  const create = (t: PodTemplate) => {
    const pod: Pod = { ...t, name: `${t.kind}-${rid(4)}`, node: null };
    const r = schedule(pod, nodes, pods, strategy);
    setPods([...pods, { ...pod, node: r.node, reason: r.reason }]);
    setDecision(r.decision);
  };

  /** Re-run the scheduler for Pending Pods, e.g. after capacity is freed. */
  const retryPending = (list: Pod[], nodeList: Node[]) => {
    let next = list;
    for (const p of list.filter((x) => !x.node)) {
      const r = schedule(p, nodeList, next, strategy);
      next = next.map((x) => (x.name === p.name ? { ...x, node: r.node, reason: r.reason } : x));
      if (r.node) setDecision(r.decision);
    }
    return next;
  };

  const remove = (name: string) => setPods(retryPending(pods.filter((p) => p.name !== name), nodes));

  const addNode = () => {
    const next = [...nodes, { name: `worker-${nodes.length}`, cpu: 2000, mem: 4096 }];
    setNodes(next);
    setPods(retryPending(pods, next));
  };

  const pending = pods.filter((p) => !p.node);

  return (
    <SimFrame
      title="kube-scheduler"
      toolbar={
        <button className="btn-ghost px-2 py-1" onClick={() => { setNodes(initialNodes()); setPods([]); setDecision(null); }}>
          Reset
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="label mr-1">Criar pod:</span>
        {templates.map((t) => (
          <button key={t.kind} className="btn-ghost px-3 py-1.5 normal-case" onClick={() => create(t)}>
            {t.emoji} {t.kind} <span className="text-tactical-label">{t.cpu}m/{t.mem >= 1024 ? `${t.mem / 1024}Gi` : `${t.mem}Mi`}{t.tolerates ? ' +toleration' : ''}</span>
          </button>
        ))}
        <button className="btn-ghost px-3 py-1.5" onClick={addNode}>
          <Plus className="h-3.5 w-3.5" /> Nó (cluster autoscaler)
        </button>
        <label className="ml-auto flex items-center gap-2">
          <span className="label">Estratégia</span>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} className="rounded border border-tactical-line bg-tactical-raised px-2 py-1 font-mono text-xs">
            <option value="LeastAllocated">LeastAllocated (espalhar)</option>
            <option value="MostAllocated">MostAllocated (bin packing)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="grid gap-3 md:grid-cols-3">
            {nodes.map((n) => {
              const u = used(pods, n.name);
              return (
                <div key={n.name} className="rounded-md border border-tactical-line bg-tactical-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-sm">{n.name}</span>
                    {n.taint && <Badge tone="amber">taint: {n.taint}</Badge>}
                  </div>
                  <Bar label="CPU" used={u.cpu} total={n.cpu} unit="m" />
                  <Bar label="MEM" used={u.mem} total={n.mem} unit="Mi" />
                  <div className="mt-3 flex min-h-[40px] flex-wrap gap-1.5">
                    {pods.filter((p) => p.node === n.name).map((p) => (
                      <PodTag key={p.name} pod={p} onRemove={() => remove(p.name)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {pending.length > 0 && (
            <div className="mt-3 rounded-md border border-dashed border-signal-amber/60 p-3">
              <div className="label mb-2 text-signal-amber">Pending</div>
              {pending.map((p) => (
                <div key={p.name} className="mb-1 flex items-center gap-2 font-mono text-xs">
                  <PodTag pod={p} onRemove={() => remove(p.name)} />
                  <span className="text-signal-amber">{p.reason}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-tactical-label">Clique no ✕ de um Pod para removê-lo — o scheduler tenta encaixar os Pending novamente.</p>
        </div>

        <div className="rounded-md border border-tactical-border bg-black/50 p-3 font-mono text-xs leading-5">
          <div className="label mb-2">Última decisão</div>
          {!decision && <div className="text-tactical-label">Crie um Pod para ver o raciocínio do scheduler.</div>}
          {decision?.lines.map((l, i) => (
            <div key={i} className={l.ok === true ? 'text-signal-green' : l.ok === false ? 'text-signal-red' : 'text-tactical-dim'}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </SimFrame>
  );
}

function Bar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const pct = Math.min(100, (used / total) * 100);
  const color = pct > 85 ? 'bg-signal-red' : pct > 60 ? 'bg-signal-amber' : 'bg-signal-green';
  return (
    <div className="mb-1.5">
      <div className="flex justify-between font-mono text-[10px] text-tactical-label">
        <span>{label}</span>
        <span>{used}/{total}{unit}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-tactical-raised">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PodTag({ pod, onRemove }: { pod: Pod; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-tactical-line bg-tactical-surface px-1.5 py-0.5 font-mono text-[10px]">
      {pod.emoji} {pod.name}
      <button onClick={onRemove} title="Remover">
        <X className="h-3 w-3 text-tactical-label hover:text-signal-red" />
      </button>
    </span>
  );
}
