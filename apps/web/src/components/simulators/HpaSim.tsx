import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { EventLog, LogEntry, SimFrame, logEntry, pushLog, useInterval } from './kit';

/** Each Pod requests 200m CPU and burns 1m per req/s: 200 req/s saturates a Pod (100%). */
const RPS_PER_FULL_POD = 200;
const SYNC_EVERY = 3; // ticks between HPA evaluations (real: 15s)
const WINDOW = 8; // scale-down stabilization window in ticks (real: 300s)
const STARTUP = 2; // ticks for a new Pod to become Ready
const TOLERANCE = 0.1;

interface State {
  t: number;
  load: number;
  target: number;
  min: number;
  max: number;
  /** ages (in ticks) of each replica; age < STARTUP means not ready yet */
  pods: number[];
  recommendations: number[];
  history: { util: number; replicas: number; load: number }[];
  lastCalc: string;
  log: LogEntry[];
}

const initial = (): State => ({
  t: 0,
  load: 150,
  target: 50,
  min: 2,
  max: 10,
  pods: [99, 99],
  recommendations: [],
  history: [],
  lastCalc: '',
  log: [logEntry('HPA web: min=2 max=10 alvo CPU=50%', 'blue')],
});

const readyCount = (pods: number[]) => pods.filter((a) => a >= STARTUP).length;
const utilization = (load: number, ready: number) => (ready === 0 ? 0 : Math.round((load / ready / RPS_PER_FULL_POD) * 100));

function step(s: State): State {
  const t = s.t + 1;
  let pods = s.pods.map((a) => a + 1);
  let log = s.log;
  let { recommendations, lastCalc } = s;
  if (t % SYNC_EVERY === 0 && readyCount(pods) > 0) {
    const current = pods.length;
    // Not-yet-ready Pods count as 0% usage, which dampens repeated scale-ups.
    const util = utilization(s.load, current);
    const ratio = util / s.target;
    const withinTolerance = Math.abs(ratio - 1) <= TOLERANCE;
    const raw = withinTolerance ? current : Math.ceil(current * ratio);
    const desired = Math.min(s.max, Math.max(s.min, raw));
    recommendations = [...recommendations, desired].slice(-WINDOW);
    // Scale-down stabilization: never go below the highest recent recommendation.
    const final = desired >= current ? desired : Math.min(current, Math.max(...recommendations));

    lastCalc =
      `ceil(${current} × ${util}% / ${s.target}%) = ${withinTolerance ? `${current} (dentro da tolerância de 10%)` : raw}` +
      ` → limitado a [${s.min}, ${s.max}] = ${desired}` +
      (desired < current ? ` → janela de estabilização: ${final}` : '');

    if (final > current) {
      pods = [...pods, ...Array(final - current).fill(0)];
      log = pushLog(log, logEntry(`HPA: CPU ${util}% > ${s.target}% → escalando ${current} → ${final}`, 'amber'));
    } else if (final < current) {
      pods = pods.slice(0, final);
      log = pushLog(log, logEntry(`HPA: CPU ${util}% < ${s.target}% → reduzindo ${current} → ${final}`, 'cyan'));
    }
  }

  const history = [...s.history, { util: utilization(s.load, readyCount(pods)), replicas: pods.length, load: s.load }].slice(-60);
  return { ...s, t, pods, recommendations, history, lastCalc, log };
}

export default function HpaSim() {
  const [s, setS] = useState<State>(initial);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(step), running ? 800 : null);

  const ready = readyCount(s.pods);
  const util = utilization(s.load, ready);
  const set = (patch: Partial<State>) => setS((st) => ({ ...st, ...patch }));

  return (
    <SimFrame
      title="hpa/web · autoscaling/v2"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initial())}>Reset</button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Slider label={`Carga: ${s.load} req/s`} min={0} max={2000} step={10} value={s.load} onChange={(v) => set({ load: v })} />
            <Slider label={`Alvo de CPU: ${s.target}%`} min={20} max={90} step={5} value={s.target} onChange={(v) => set({ target: v })} />
            <Slider label={`minReplicas: ${s.min}`} min={1} max={5} step={1} value={s.min} onChange={(v) => set({ min: v })} />
            <Slider label={`maxReplicas: ${s.max}`} min={5} max={15} step={1} value={s.max} onChange={(v) => set({ max: v })} />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ['Madrugada', 60],
              ['Normal', 300],
              ['Black Friday', 1800],
            ].map(([l, v]) => (
              <button key={l} className="btn-ghost px-3 py-1" onClick={() => set({ load: v as number })}>{l}</button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-3">
            <Metric label="CPU média" value={`${util}%`} tone={util > s.target * 1.1 ? 'text-signal-red' : util < s.target * 0.9 ? 'text-signal-cyan' : 'text-signal-green'} />
            <Metric label="Réplicas" value={`${s.pods.length}`} tone="text-white" />
            <Metric label="Ready" value={`${ready}`} tone="text-signal-green" />
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {s.pods.map((age, i) => (
              <div key={i} className={`flex h-9 w-9 items-center justify-center rounded border font-mono text-[10px] ${age >= STARTUP ? 'border-signal-green/60 bg-signal-green/10' : 'border-signal-cyan/60 bg-signal-cyan/10 animate-pulse'}`}>
                {age >= STARTUP ? Math.min(999, utilization(s.load, ready)) + '%' : '…'}
              </div>
            ))}
          </div>

          <Chart history={s.history} target={s.target} max={s.max} />
          <div className="mt-3 rounded-md border border-tactical-border bg-black/50 p-3 font-mono text-xs text-signal-amber">
            <div className="label mb-1">Último cálculo do HPA</div>
            {s.lastCalc || 'aguardando primeira avaliação…'}
          </div>
        </div>
        <EventLog entries={s.log} title="Eventos do HPA" height="h-96" />
      </div>
    </SimFrame>
  );
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#326ce5]" />
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-tactical-border bg-tactical-bg p-3">
      <div className="label">{label}</div>
      <div className={`font-mono text-2xl ${tone}`}>{value}</div>
    </div>
  );
}

function Chart({ history, target, max }: { history: State['history']; target: number; max: number }) {
  const W = 600;
  const H = 140;
  const maxUtil = Math.max(100, ...history.map((h) => h.util));
  const x = (i: number) => (i / 59) * W;
  const yU = (u: number) => H - (u / maxUtil) * H;
  const yR = (r: number) => H - (r / (max + 1)) * H;
  const path = (f: (h: State['history'][number]) => number) => history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${f(h).toFixed(1)}`).join(' ');
  return (
    <div className="rounded-md border border-tactical-border bg-tactical-bg p-3">
      <div className="mb-2 flex gap-4 font-mono text-[10px] text-tactical-label">
        <span><span className="text-signal-amber">━</span> CPU %</span>
        <span><span className="text-k8s-400">━</span> réplicas</span>
        <span><span className="text-signal-green">┅</span> alvo</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none">
        <line x1="0" x2={W} y1={yU(target)} y2={yU(target)} stroke="#34d399" strokeDasharray="4 4" strokeWidth="1" />
        <path d={path((h) => yU(h.util))} fill="none" stroke="#d9a441" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={path((h) => yR(h.replicas))} fill="none" stroke="#5b8def" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
