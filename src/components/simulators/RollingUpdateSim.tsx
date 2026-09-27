import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Badge, EventLog, LogEntry, SimFrame, logEntry, pushLog, rid, useInterval, type Tone } from './kit';

type Version = 'v1' | 'v2' | 'v3-bug';
type Phase = 'Starting' | 'Ready' | 'ImagePullBackOff' | 'Terminating';

interface Pod {
  name: string;
  version: Version;
  phase: Phase;
  t: number;
}

interface State {
  replicas: number;
  maxSurge: number;
  maxUnavailable: number;
  target: Version;
  history: Version[];
  pods: Pod[];
  log: LogEntry[];
}

const versionColor: Record<Version, string> = { v1: 'bg-k8s-500', v2: 'bg-signal-green', 'v3-bug': 'bg-signal-red' };
const phaseTone: Record<Phase, Tone> = { Starting: 'cyan', Ready: 'green', ImagePullBackOff: 'red', Terminating: 'dim' };

const newPod = (version: Version): Pod => ({ name: `web-${version.replace('-bug', 'b')}-${rid()}`, version, phase: 'Starting', t: 0 });

function initial(): State {
  return {
    replicas: 4,
    maxSurge: 1,
    maxUnavailable: 0,
    target: 'v1',
    history: ['v1'],
    pods: Array.from({ length: 4 }, () => ({ ...newPod('v1'), phase: 'Ready' as Phase })),
    log: [logEntry('Deployment web rodando v1 (revisão 1)', 'blue')],
  };
}

function step(s: State): State {
  let log = s.log;
  const add = (text: string, tone?: Tone) => (log = pushLog(log, logEntry(text, tone)));

  // Kubelet: advance Pod phases.
  let pods: Pod[] = [];
  for (const p of s.pods) {
    const t = p.t + 1;
    if (p.phase === 'Terminating') continue; // removed after one tick
    if (p.phase === 'Starting' && t >= 2) {
      if (p.version === 'v3-bug') {
        add(`kubelet: Failed to pull image "web:v3-bug": not found → ${p.name}`, 'red');
        pods.push({ ...p, phase: 'ImagePullBackOff', t: 0 });
      } else {
        add(`readinessProbe OK → ${p.name} Ready`, 'green');
        pods.push({ ...p, phase: 'Ready', t: 0 });
      }
      continue;
    }
    pods.push({ ...p, t });
  }

  // Deployment controller: one reconciliation pass.
  const active = pods.filter((p) => p.phase !== 'Terminating');
  const newPods = active.filter((p) => p.version === s.target);
  const oldPods = active.filter((p) => p.version !== s.target);
  const maxTotal = s.replicas + s.maxSurge;
  const minAvailable = s.replicas - s.maxUnavailable;

  // Scale up the new ReplicaSet within the surge budget.
  const canCreate = Math.min(s.replicas - newPods.length, maxTotal - active.length);
  for (let i = 0; i < canCreate; i++) pods.push(newPod(s.target));
  if (canCreate > 0) add(`deployment-controller: escalando ReplicaSet ${s.target} para ${newPods.length + canCreate}`, 'blue');

  // Scale down: unhealthy old Pods can always go; healthy ones only above minAvailable.
  const terminate = new Set<string>();
  oldPods.filter((p) => p.phase !== 'Ready').forEach((p) => terminate.add(p.name));
  const available = active.filter((p) => p.phase === 'Ready').length;
  const removableReady = Math.max(0, available - minAvailable);
  oldPods
    .filter((p) => p.phase === 'Ready')
    .slice(0, removableReady)
    .forEach((p) => terminate.add(p.name));
  // Excess new Pods (e.g. replicas reduced).
  const newExcess = newPods.length - s.replicas;
  if (newExcess > 0) newPods.slice(0, newExcess).forEach((p) => terminate.add(p.name));

  if (terminate.size > 0) {
    add(`deployment-controller: removendo ${terminate.size} pod(s) antigo(s)`, 'amber');
    pods = pods.map((p) => (terminate.has(p.name) ? { ...p, phase: 'Terminating', t: 0 } : p));
  }

  return { ...s, pods, log };
}

export default function RollingUpdateSim() {
  const [s, setS] = useState<State>(initial);
  useInterval(() => setS(step), 1100);

  const deploy = (v: Version) =>
    setS((st) =>
      st.target === v
        ? st
        : {
            ...st,
            target: v,
            history: [...st.history, v],
            log: pushLog(st.log, logEntry(`$ kubectl set image deployment/web web=web:${v}  (revisão ${st.history.length + 1})`, 'blue')),
          },
    );

  const undo = () =>
    setS((st) => {
      if (st.history.length < 2) return st;
      const prev = st.history[st.history.length - 2];
      return {
        ...st,
        target: prev,
        history: [...st.history, prev],
        log: pushLog(st.log, logEntry(`$ kubectl rollout undo deployment/web  → volta para ${prev}`, 'amber')),
      };
    });

  const active = s.pods.filter((p) => p.phase !== 'Terminating');
  const updated = active.filter((p) => p.version === s.target);
  const updatedReady = updated.filter((p) => p.phase === 'Ready').length;
  const available = active.filter((p) => p.phase === 'Ready').length;
  const done = updatedReady === s.replicas && active.length === s.replicas;
  const stuck = updated.some((p) => p.phase === 'ImagePullBackOff');
  const invalid = s.maxSurge === 0 && s.maxUnavailable === 0;

  return (
    <SimFrame title="rollout · deployment/web" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setS(initial())}>Reset</button>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="label mr-1">Deploy:</span>
            {(['v1', 'v2', 'v3-bug'] as Version[]).map((v) => (
              <button key={v} className={`btn-ghost px-3 py-1 ${s.target === v ? 'border-k8s-500 text-white' : ''}`} disabled={invalid} onClick={() => deploy(v)}>
                <span className={`h-2 w-2 rounded-full ${versionColor[v]}`} /> web:{v}
              </button>
            ))}
            <button className="btn-ghost px-3 py-1" onClick={undo} disabled={s.history.length < 2}>
              <Undo2 className="h-3.5 w-3.5" /> rollout undo
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Select label="replicas" value={s.replicas} options={[2, 3, 4, 5, 6]} onChange={(n) => setS((st) => ({ ...st, replicas: n }))} />
            <Select label="maxSurge" value={s.maxSurge} options={[0, 1, 2, 3]} onChange={(n) => setS((st) => ({ ...st, maxSurge: n }))} />
            <Select label="maxUnavailable" value={s.maxUnavailable} options={[0, 1, 2, 3]} onChange={(n) => setS((st) => ({ ...st, maxUnavailable: n }))} />
          </div>
          {invalid && <p className="mb-3 text-sm text-signal-red">maxSurge e maxUnavailable não podem ser 0 ao mesmo tempo — o rollout nunca progrediria.</p>}

          <div className="rounded-md border border-tactical-line bg-tactical-bg p-4">
            <div className="mb-3 flex flex-wrap gap-4 font-mono text-xs">
              <span>total: <b>{active.length}</b> (máx {s.replicas + s.maxSurge})</span>
              <span>disponíveis: <b className={available < s.replicas - s.maxUnavailable ? 'text-signal-red' : 'text-signal-green'}>{available}</b> (mín {s.replicas - s.maxUnavailable})</span>
              <span>atualizados: <b>{updated.length}</b></span>
            </div>
            <div className="flex min-h-[72px] flex-wrap gap-2">
              {s.pods.map((p) => (
                <div key={p.name} className={`rounded border border-tactical-line bg-tactical-surface px-2 py-1.5 font-mono text-[11px] transition-opacity ${p.phase === 'Terminating' ? 'opacity-30' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${versionColor[p.version]}`} />
                    {p.version}
                  </div>
                  <Badge tone={phaseTone[p.phase]}>{p.phase}</Badge>
                </div>
              ))}
            </div>
            <div className={`mt-3 font-mono text-xs ${done ? 'text-signal-green' : stuck ? 'text-signal-red' : 'text-signal-amber'}`}>
              {done
                ? `deployment "web" successfully rolled out (${s.target})`
                : stuck
                  ? `Waiting for deployment "web" rollout to finish: ${updatedReady} of ${s.replicas} updated replicas are available... (travado: ImagePullBackOff — faça rollback!)`
                  : `Waiting for deployment "web" rollout to finish: ${updatedReady} of ${s.replicas} updated replicas are available...`}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-tactical-border bg-black/50 p-3 font-mono text-xs">
            <div className="label mb-2">rollout history</div>
            {s.history.map((v, i) => (
              <div key={i} className={i === s.history.length - 1 ? 'text-white' : 'text-tactical-label'}>
                {i + 1}&nbsp;&nbsp; web:{v} {i === s.history.length - 1 && '← atual'}
              </div>
            ))}
          </div>
          <EventLog entries={s.log} height="h-64" />
        </div>
      </div>
    </SimFrame>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="rounded border border-tactical-line bg-tactical-raised px-2 py-1.5 font-mono text-sm">
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
