import { useState } from 'react';
import { Badge, Choice, EventLog, SimFrame, Stepper, Toggle, logEntry, pushLog, rid, useInterval, type LogEntry } from './kit';

/** Loop de reconciliação: compara o estado desejado (spec do CR) com o real e age sobre a diferença. */

export interface SiteSpec {
  replicas: number;
  image: string;
}
export interface PodT {
  name: string;
  image: string;
}
export type Action = { kind: 'create'; image: string } | { kind: 'delete'; name: string } | { kind: 'replace'; name: string; image: string };

/** Level-triggered: só o estado atual importa, não o histórico de eventos. */
export function diff(spec: SiteSpec, pods: PodT[]): Action[] {
  const actions: Action[] = [];
  const ordered = [...pods.filter((p) => p.image === spec.image), ...pods.filter((p) => p.image !== spec.image)];
  ordered.slice(spec.replicas).forEach((p) => actions.push({ kind: 'delete', name: p.name }));
  const keep = ordered.slice(0, spec.replicas);
  keep.filter((p) => p.image !== spec.image).forEach((p) => actions.push({ kind: 'replace', name: p.name, image: spec.image }));
  for (let i = keep.length; i < spec.replicas; i++) actions.push({ kind: 'create', image: spec.image });
  return actions;
}

export function applyActions(pods: PodT[], actions: Action[], newName: () => string): PodT[] {
  let out = [...pods];
  for (const a of actions) {
    if (a.kind === 'delete') out = out.filter((p) => p.name !== a.name);
    else if (a.kind === 'replace') out = out.map((p) => (p.name === a.name ? { name: newName(), image: a.image } : p));
    else out.push({ name: newName(), image: a.image });
  }
  return out;
}

const describe = (a: Action) =>
  a.kind === 'create' ? `criar Pod (${a.image})` : a.kind === 'delete' ? `apagar ${a.name} (excedente)` : `substituir ${a.name} → ${a.image}`;

const IMAGES = ['nginx:1.26', 'nginx:1.27'];
const podName = () => `site-${rid()}`;

export default function OpReconcileSim() {
  const [spec, setSpec] = useState<SiteSpec>({ replicas: 3, image: 'nginx:1.26' });
  const [pods, setPods] = useState<PodT[]>([{ name: podName(), image: 'nginx:1.26' }]);
  const [running, setRunning] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([logEntry('operador iniciado: watch em sites.web.exemplo.com', 'cyan')]);
  const pending = diff(spec, pods);

  const reconcile = () => {
    const acts = diff(spec, pods);
    if (!acts.length) return;
    setPods((p) => applyActions(p, acts, podName));
    setLog((l) => pushLog(l, logEntry(`reconcile site/loja: ${acts.map(describe).join(', ')}`, 'green')));
  };
  useInterval(reconcile, running ? 1500 : null);

  const change = (s: SiteSpec) => {
    setSpec(s);
    setLog((l) => pushLog(l, logEntry(running ? `evento MODIFIED: spec = ${s.replicas} × ${s.image}` : `spec alterada para ${s.replicas} × ${s.image} — operador parado, evento não observado`, running ? 'blue' : 'amber')));
  };
  const drift = () => {
    if (!pods.length) return;
    setPods((p) => p.slice(1));
    setLog((l) => pushLog(l, logEntry(`alguém apagou ${pods[0].name} manualmente (drift)`, 'red')));
  };
  const tamper = () => {
    if (!pods.length) return;
    const other = IMAGES.find((i) => i !== pods[0].image)!;
    setPods((p) => p.map((x, i) => (i === 0 ? { ...x, image: other } : x)));
    setLog((l) => pushLog(l, logEntry(`alguém trocou a imagem de ${pods[0].name} para ${other} à mão`, 'red')));
  };

  return (
    <SimFrame title="Site loja · spec (desejado) × mundo real" toolbar={<Badge tone={running ? 'green' : 'red'}>{running ? 'operador rodando' : 'operador parado'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <div className="label">spec do CR (estado desejado)</div>
          <Stepper label="replicas" value={spec.replicas} min={0} max={6} onChange={(n) => change({ ...spec, replicas: n })} />
          <Choice label="image" value={spec.image} onChange={(v) => change({ ...spec, image: v })} options={IMAGES.map((i) => ({ value: i, label: i }))} />
          <Toggle checked={running} onChange={setRunning}><span className="text-xs">Operador rodando (reconcilia a cada 1,5 s)</span></Toggle>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={drift}>Apagar um Pod à mão</button>
            <button className="btn-ghost" onClick={tamper}>Mexer na imagem de um Pod</button>
            <button className="btn-primary" disabled={running || !pending.length} onClick={reconcile}>Reconciliar uma vez</button>
          </div>
        </div>
        <div>
          <div className="label mb-2">Pods reais ({pods.length})</div>
          <div className="flex min-h-[3rem] flex-wrap gap-2">
            {pods.map((p) => (
              <div key={p.name} className={`rounded border px-2 py-1 font-mono text-xs ${p.image === spec.image ? 'border-signal-green/60 text-signal-green' : 'border-signal-amber/60 text-signal-amber'}`}>
                {p.name}<div className="text-[10px] text-tactical-label">{p.image}</div>
              </div>
            ))}
          </div>
          <div className="label mb-1 mt-4">Diferença que o próximo reconcile vai corrigir</div>
          <ul className="mb-3 space-y-1 font-mono text-xs">
            {pending.length === 0 ? <li className="text-signal-green">nenhuma — estado real = estado desejado</li> : pending.map((a, i) => <li key={i} className="text-signal-amber">→ {describe(a)}</li>)}
          </ul>
          <EventLog entries={log} title="log do operador" height="h-40" />
          <p className="mt-3 text-xs text-tactical-label">
            Pare o operador, mude a spec várias vezes e apague Pods. Ao religar, ele não precisa dos eventos perdidos: compara o estado atual com o desejado
            e converge. Isso é ser <strong>level-triggered</strong> — e é por isso que o reconcile deve ser idempotente.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
