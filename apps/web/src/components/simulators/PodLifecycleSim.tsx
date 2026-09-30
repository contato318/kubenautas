import { useState } from 'react';
import { Pause, Play, Wrench } from 'lucide-react';
import { Badge, EventLog, LogEntry, SimFrame, logEntry, pushLog, useInterval, type Tone } from './kit';

type Fault = 'none' | 'liveness' | 'readiness' | 'crash' | 'oom' | 'image' | 'unschedulable';
type Container = 'waiting' | 'starting' | 'running' | 'terminated';

interface State {
  fault: Fault;
  /** simulated seconds */
  t: number;
  scheduled: boolean;
  imagePulled: boolean;
  container: Container;
  status: string;
  ready: boolean;
  restarts: number;
  failures: number;
  imageFailures: number;
  /** seconds remaining before the kubelet retries */
  backoff: number;
  phaseTime: number;
  livenessFails: number;
  readinessFails: number;
  mem: number;
  lastExit?: string;
  log: LogEntry[];
}

const MEM_LIMIT = 256;
const PROBE_PERIOD = 3;
const FAILURE_THRESHOLD = 3;
/** Real backoff is 10s, 20s, 40s… capped at 300s; the simulator runs 5× faster. */
export const lifecycleBackoff = (restarts: number) => Math.min(300, 10 * 2 ** Math.max(0, restarts - 1));

const faults: { id: Fault; label: string; hint: string }[] = [
  { id: 'none', label: 'Saudável', hint: 'Tudo certo: Pod Running e Ready.' },
  { id: 'readiness', label: 'Readiness falhando', hint: 'A app está viva mas não consegue atender (ex.: cache aquecendo). Sai do Service, NÃO reinicia.' },
  { id: 'liveness', label: 'Deadlock (liveness)', hint: 'O processo trava. A liveness falha 3× seguidas e o kubelet reinicia o container.' },
  { id: 'crash', label: 'Crash no boot', hint: 'Variável de ambiente faltando: o processo sai com código 1 logo ao iniciar.' },
  { id: 'oom', label: 'Vazamento de memória', hint: `Uso de memória cresce até o limit (${MEM_LIMIT}Mi) → OOMKilled (exit 137).` },
  { id: 'image', label: 'Tag de imagem errada', hint: 'nginx:1.99 não existe → ErrImagePull / ImagePullBackOff.' },
  { id: 'unschedulable', label: 'Request gigante', hint: 'O Pod pede 64 CPUs: nenhum nó cabe → Pending.' },
];

export const initialLifecycle = (fault: Fault = 'none'): State => ({
  fault,
  t: 0,
  scheduled: false,
  imagePulled: false,
  container: 'waiting',
  status: 'Pending',
  ready: false,
  restarts: 0,
  failures: 0,
  imageFailures: 0,
  backoff: 0,
  phaseTime: 0,
  livenessFails: 0,
  readinessFails: 0,
  mem: 40,
  log: [logEntry(`$ kubectl apply -f pod.yaml   (cenário: ${faults.find((f) => f.id === fault)!.label})`, 'blue')],
});

export function stepLifecycle(prev: State): State {
  const s: State = { ...prev, t: prev.t + 1, phaseTime: prev.phaseTime + 1 };
  const add = (text: string, tone?: Tone) => (s.log = pushLog(s.log, logEntry(`${String(s.t).padStart(3, ' ')}s  ${text}`, tone)));

  // 1. Scheduling
  if (!s.scheduled) {
    if (s.fault === 'unschedulable') {
      if (s.t === 1 || s.t % 10 === 0) add('Warning FailedScheduling: 0/3 nodes are available: 3 Insufficient cpu.', 'amber');
      s.status = 'Pending';
      return s;
    }
    s.scheduled = true;
    add('Normal Scheduled: Successfully assigned default/web to worker-2', 'cyan');
    s.status = 'ContainerCreating';
    return s;
  }

  // 2. Image pull (with backoff)
  if (!s.imagePulled) {
    if (s.backoff > 0) {
      s.backoff -= 1;
      s.status = 'ImagePullBackOff';
      if (s.backoff > 0) return s;
    }
    if (s.fault === 'image') {
      add('Warning Failed: Failed to pull image "nginx:1.99": manifest unknown', 'red');
      s.status = 'ErrImagePull';
      s.imageFailures += 1;
      s.backoff = lifecycleBackoff(s.imageFailures);
      return s;
    }
    s.imagePulled = true;
    add('Normal Pulled: Successfully pulled image "nginx:1.27"', 'green');
  }

  // 3. Container restart backoff
  if (s.container === 'terminated') {
    if (s.backoff > 0) {
      s.backoff -= 1;
      s.status = 'CrashLoopBackOff';
      if (s.backoff > 0) return s;
    }
    s.container = 'waiting';
  }

  if (s.container === 'waiting') {
    if (s.lastExit) s.restarts += 1;
    add('Normal Started: Started container web', 'green');
    s.container = 'starting';
    s.phaseTime = 0;
    s.mem = 40;
    s.livenessFails = 0;
    s.readinessFails = 0;
    s.status = 'Running';
    return s;
  }

  const kill = (reason: string, exit: string, tone: Tone = 'red') => {
    s.container = 'terminated';
    s.ready = false;
    s.failures += 1;
    s.lastExit = exit;
    s.status = reason;
    s.backoff = lifecycleBackoff(s.failures);
    add(`Warning BackOff: Back-off restarting failed container (próxima tentativa em ${s.backoff}s)`, tone);
  };

  // Ten minutes of healthy execution reset crash backoff, not restartCount.
  if (s.phaseTime >= 600) s.failures = 0;

  // 4. Running container behaviour
  if (s.fault === 'crash' && s.phaseTime >= 2) {
    add('container saiu: Error: env DATABASE_URL is required (exit code 1)', 'red');
    kill('Error', 'Error (exit 1)');
    return s;
  }

  if (s.fault === 'oom') {
    s.mem = Math.min(MEM_LIMIT, s.mem + 36);
    if (s.mem >= MEM_LIMIT) {
      add(`container excedeu o limit de memória (${MEM_LIMIT}Mi) → OOMKilled (exit code 137)`, 'red');
      kill('OOMKilled', 'OOMKilled (exit 137)');
      return s;
    }
  } else {
    s.mem = Math.min(80, s.mem + 4);
  }

  if (s.container === 'starting' && s.phaseTime >= 2) s.container = 'running';

  // 5. Probes
  if (s.container === 'running' && s.phaseTime % PROBE_PERIOD === 0) {
    if (s.fault === 'liveness') {
      s.livenessFails += 1;
      add(`Warning Unhealthy: Liveness probe failed: Get "http://10.244.1.7:8080/healthz": context deadline exceeded (${s.livenessFails}/${FAILURE_THRESHOLD})`, 'amber');
      if (s.livenessFails >= FAILURE_THRESHOLD) {
        add('Normal Killing: Container web failed liveness probe, will be restarted', 'red');
        kill('CrashLoopBackOff', 'Terminated (liveness; saída depende da aplicação)');
        return s;
      }
    } else {
      s.livenessFails = 0;
    }

    const readinessOk = s.fault !== 'readiness' && s.fault !== 'liveness';
    if (readinessOk) {
      s.readinessFails = 0;
      if (!s.ready) add('readinessProbe OK → Pod adicionado aos endpoints do Service', 'green');
      s.ready = true;
    } else {
      s.readinessFails += 1;
      if (s.fault === 'readiness') add(`Warning Unhealthy: Readiness probe failed: HTTP probe failed with statuscode: 503 (${Math.min(s.readinessFails, FAILURE_THRESHOLD)}/${FAILURE_THRESHOLD})`, 'amber');
      if (s.readinessFails >= FAILURE_THRESHOLD && s.ready) {
        add('Pod removido dos endpoints do Service (continua rodando, sem restart)', 'amber');
        s.ready = false;
      }
    }
  }
  if (s.container === 'running' || s.container === 'starting') s.status = 'Running';
  return s;
}

const statusTone = (st: string): Tone =>
  st === 'Running' ? 'green' : st === 'Pending' || st === 'ContainerCreating' ? 'amber' : 'red';

export default function PodLifecycleSim() {
  const [s, setS] = useState<State>(() => initialLifecycle());
  const [running, setRunning] = useState(true);
  useInterval(() => setS(stepLifecycle), running ? 200 : null);

  const setFault = (fault: Fault) => setS(initialLifecycle(fault));
  const fix = () =>
    setS((st) => ({
      ...st,
      fault: 'none',
      log: pushLog(st.log, logEntry(`${String(st.t).padStart(3, ' ')}s  🛠  correção aplicada — aguardando próxima tentativa do kubelet`, 'blue')),
    }));

  const hint = faults.find((f) => f.id === s.fault)!.hint;

  return (
    <SimFrame
      title="pod/web · kubelet"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initialLifecycle(s.fault))}>Recriar Pod</button>
        </>
      }
    >
      <div className="mb-4">
        <div className="label mb-2">Escolha um cenário (recria o Pod)</div>
        <div className="flex flex-wrap gap-2">
          {faults.map((f) => (
            <button key={f.id} className={`btn-ghost px-3 py-1.5 normal-case ${s.fault === f.id ? 'border-k8s-500 text-white' : ''}`} onClick={() => setFault(f.id)}>
              {f.label}
            </button>
          ))}
          <button className="btn-ghost px-3 py-1.5 border-signal-green/60 text-signal-green" disabled={s.fault === 'none'} onClick={fix}>
            <Wrench className="h-3.5 w-3.5" /> Corrigir sem recriar
          </button>
        </div>
        <p className="mt-2 text-sm text-tactical-dim">💡 {hint}</p>
      </div>

      <div className="mb-4 overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs">
        <div className="text-tactical-label">$ kubectl get pod web</div>
        <table className="mt-1">
          <thead>
            <tr className="text-tactical-label">
              {['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'].map((h) => <td key={h} className="pr-8">{h}</td>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-8">web</td>
              <td className={`pr-8 ${s.ready ? 'text-signal-green' : 'text-signal-red'}`}>{s.ready ? '1/1' : '0/1'}</td>
              <td className="pr-8"><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
              <td className="pr-8">{s.restarts}{s.lastExit && <span className="text-tactical-label"> (último: {s.lastExit})</span>}</td>
              <td className="pr-8">{s.t}s</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Light label="Agendado" ok={s.scheduled} />
        <Light label="Imagem" ok={s.imagePulled} bad={s.status.includes('Image')} />
        <Light label="Liveness" ok={s.container === 'running' && s.livenessFails === 0} bad={s.livenessFails > 0} detail={s.livenessFails ? `${s.livenessFails}/${FAILURE_THRESHOLD} falhas` : undefined} />
        <Light label="Readiness" ok={s.ready} bad={s.readinessFails > 0} detail={s.ready ? 'nos endpoints' : 'fora dos endpoints'} />
      </div>

      <div className="mb-4">
        <div className="flex justify-between font-mono text-[10px] text-tactical-label">
          <span>MEMÓRIA</span>
          <span>{s.mem}Mi / limit {MEM_LIMIT}Mi</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-tactical-raised">
          <div className={`h-full transition-all ${s.mem / MEM_LIMIT > 0.8 ? 'bg-signal-red' : 'bg-signal-green'}`} style={{ width: `${(s.mem / MEM_LIMIT) * 100}%` }} />
        </div>
      </div>

      <EventLog entries={s.log} title="$ kubectl describe pod web → Events" height="h-64" />
    </SimFrame>
  );
}

function Light({ label, ok, bad, detail }: { label: string; ok: boolean; bad?: boolean; detail?: string }) {
  const color = ok ? 'bg-signal-green' : bad ? 'bg-signal-red' : 'bg-tactical-line';
  return (
    <div className="flex items-center gap-2 rounded-md border border-tactical-border bg-tactical-bg px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color} ${ok ? 'shadow-[0_0_8px_#34d399]' : ''}`} />
      <div>
        <div className="label">{label}</div>
        {detail && <div className="font-mono text-[10px] text-tactical-dim">{detail}</div>}
      </div>
    </div>
  );
}
