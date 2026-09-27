import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, Stepper, logEntry, pushLog, useInterval } from './kit';

/**
 * StatefulSet web com volumeClaimTemplates "data":
 * - OrderedReady: cria web-N só quando web-0..web-(N-1) estão Ready; remove do maior ordinal para o menor, um por vez;
 * - Parallel: cria e remove todos de uma vez;
 * - o Pod recriado mantém nome, DNS e PVC; PVCs não são apagados ao reduzir réplicas.
 */

export const STS_READY_AFTER = 3;

export interface StsPod {
  ordinal: number;
  age: number;
}

export interface StsState {
  t: number;
  replicas: number;
  policy: 'OrderedReady' | 'Parallel';
  pods: StsPod[];
  pvcs: number[];
  log: LogEntry[];
}

export const stsReady = (p: StsPod) => p.age >= STS_READY_AFTER;

export const initialSts = (): StsState => ({ t: 0, replicas: 3, policy: 'OrderedReady', pods: [], pvcs: [], log: [logEntry('statefulset/web criado com replicas=3', 'blue')] });

export function stepSts(s: StsState): StsState {
  const t = s.t + 1;
  let log = s.log;
  let pods = s.pods.map((p) => ({ ...p, age: p.age + 1 })).sort((a, b) => a.ordinal - b.ordinal);
  let pvcs = [...s.pvcs];

  const allReady = pods.every(stsReady);
  const extra = pods.filter((p) => p.ordinal >= s.replicas).sort((a, b) => b.ordinal - a.ordinal);

  // Scale down
  if (extra.length) {
    const toRemove = s.policy === 'Parallel' ? extra : allReady ? [extra[0]] : [];
    for (const p of toRemove) {
      pods = pods.filter((x) => x.ordinal !== p.ordinal);
      log = pushLog(log, logEntry(`web-${p.ordinal} terminado (PVC data-web-${p.ordinal} preservado)`, 'amber'));
    }
  } else {
    // Scale up / recriação
    const present = new Set(pods.map((p) => p.ordinal));
    const missing = Array.from({ length: s.replicas }, (_, i) => i).filter((i) => !present.has(i));
    const toCreate =
      s.policy === 'Parallel'
        ? missing
        : missing.slice(0, 1).filter((ord) => pods.filter((p) => p.ordinal < ord).every(stsReady) && pods.filter((p) => p.ordinal < ord).length === ord);
    for (const ord of toCreate) {
      if (!pvcs.includes(ord)) {
        pvcs = [...pvcs, ord].sort((a, b) => a - b);
        log = pushLog(log, logEntry(`pvc/data-web-${ord} criado`, 'cyan'));
      } else {
        log = pushLog(log, logEntry(`pvc/data-web-${ord} já existe: reaproveitado`, 'green'));
      }
      pods = [...pods, { ordinal: ord, age: 0 }].sort((a, b) => a.ordinal - b.ordinal);
      log = pushLog(log, logEntry(`web-${ord} criado`, 'blue'));
    }
    if (s.policy === 'OrderedReady' && missing.length && toCreate.length === 0 && t % 3 === 0) {
      log = pushLog(log, logEntry(`aguardando web-${missing[0] - 1 >= 0 ? missing[0] - 1 : 0} ficar Ready para criar web-${missing[0]}`, 'dim'));
    }
  }

  return { ...s, t, pods, pvcs, log };
}

export default function StatefulSetSim() {
  const [s, setS] = useState<StsState>(initialSts);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(stepSts), running ? 800 : null);

  const kill = (ord: number) =>
    setS((st) => ({ ...st, pods: st.pods.filter((p) => p.ordinal !== ord), log: pushLog(st.log, logEntry(`$ kubectl delete pod web-${ord}`, 'red')) }));

  return (
    <SimFrame
      title="apps/v1 · StatefulSet web · serviceName: web (headless)"
      toolbar={
        <>
          <button className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initialSts())}>Reset</button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Stepper label="replicas" value={s.replicas} min={0} max={6} onChange={(v) => setS((st) => ({ ...st, replicas: v, log: pushLog(st.log, logEntry(`$ kubectl scale sts web --replicas=${v}`, 'blue')) }))} />
            <Choice label="podManagementPolicy" value={s.policy} onChange={(v) => setS((st) => ({ ...st, policy: v }))} options={[{ value: 'OrderedReady', label: 'OrderedReady' }, { value: 'Parallel', label: 'Parallel' }]} />
          </div>

          <div className="label mb-2">Pods (clique em um Pod para deletá-lo)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: Math.max(s.replicas, ...s.pods.map((p) => p.ordinal + 1), 1) }, (_, ord) => {
              const pod = s.pods.find((p) => p.ordinal === ord);
              return (
                <button
                  key={ord}
                  disabled={!pod}
                  onClick={() => pod && kill(ord)}
                  className={`rounded-md border p-3 text-left transition-colors ${pod ? (stsReady(pod) ? 'border-signal-green/60 bg-signal-green/5 hover:bg-signal-red/10' : 'border-signal-cyan/60 bg-signal-cyan/5') : 'border-dashed border-tactical-line opacity-60'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">web-{ord}</span>
                    {pod ? <Badge tone={stsReady(pod) ? 'green' : 'cyan'}>{stsReady(pod) ? 'Ready' : 'Starting'}</Badge> : <Badge tone="dim">{ord < s.replicas ? 'aguardando' : 'removido'}</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-tactical-label">web-{ord}.web.loja.svc.cluster.local</div>
                  <div className="mt-1 font-mono text-[10px] text-signal-amber">{s.pvcs.includes(ord) ? `pvc/data-web-${ord}` : 'sem PVC'}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 font-mono text-xs text-tactical-dim">PVCs existentes: {s.pvcs.length ? s.pvcs.map((o) => `data-web-${o}`).join(', ') : 'nenhum'}</div>
          <p className="mt-3 text-xs text-tactical-label">
            Reduza para 1 réplica e volte para 3: os PVCs data-web-1 e data-web-2 continuam lá e são reaproveitados. Delete o web-1: ele volta com o
            mesmo nome, DNS e disco. Compare OrderedReady com Parallel ao escalar de 0 para 5.
          </p>
        </div>
        <EventLog entries={s.log} height="h-96" />
      </div>
    </SimFrame>
  );
}
