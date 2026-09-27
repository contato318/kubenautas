import { useState } from 'react';
import { Badge, EventLog, SimFrame, Toggle, logEntry, pushLog, type LogEntry, type Tone } from './kit';

/** metadata.generation × status.observedGeneration, condições e o subrecurso /status. */

export interface StatusState {
  generation: number;
  observedGeneration: number | null;
  specVersion: number;
  runningVersion: number;
  ready: 'True' | 'False' | 'Unknown';
  reason: string;
  label: number;
}
export interface StatusCfg {
  statusSubresource: boolean;
  writesObservedGeneration: boolean;
}
export type StatusAction = 'edit-spec' | 'edit-label' | 'reconcile-ok' | 'reconcile-fail' | 'status-via-main';

export const INITIAL: StatusState = { generation: 1, observedGeneration: 1, specVersion: 1, runningVersion: 1, ready: 'True', reason: 'Deployed', label: 0 };

/** Aplica uma ação e devolve o novo estado e as mensagens para o log. */
export function step(s: StatusState, a: StatusAction, cfg: StatusCfg): { state: StatusState; notes: string[] } {
  const n = { ...s };
  const notes: string[] = [];
  const statusWrite = (apply: () => void) => {
    apply();
    if (cfg.writesObservedGeneration) n.observedGeneration = s.generation;
    if (!cfg.statusSubresource) {
      n.generation += 1;
      notes.push(`sem subrecurso status, a escrita do status também incrementou generation (${s.generation} → ${n.generation})`);
    }
  };
  switch (a) {
    case 'edit-spec':
      n.specVersion += 1;
      n.generation += 1;
      notes.push(`spec.version = ${n.specVersion} → generation ${n.generation}`);
      break;
    case 'edit-label':
      n.label += 1;
      notes.push('mudança em metadata (label): generation não muda');
      break;
    case 'reconcile-ok':
      statusWrite(() => {
        n.runningVersion = s.specVersion;
        n.ready = 'True';
        n.reason = 'Deployed';
      });
      notes.unshift(`operador aplicou a versão ${s.specVersion}: Ready=True (Deployed)`);
      break;
    case 'reconcile-fail':
      statusWrite(() => {
        n.ready = 'False';
        n.reason = 'MigrationFailed';
      });
      notes.unshift(`operador falhou ao aplicar a versão ${s.specVersion}: Ready=False (MigrationFailed)`);
      break;
    case 'status-via-main':
      if (cfg.statusSubresource) {
        notes.push('PATCH no endpoint principal com .status: o API server IGNORA o status (só /status altera). Nada mudou.');
      } else {
        n.ready = 'True';
        n.reason = 'Deployed';
        if (cfg.writesObservedGeneration) n.observedGeneration = s.generation;
        n.generation += 1;
        notes.push('PATCH no endpoint principal: status gravado, e generation incrementou junto');
      }
      break;
  }
  return { state: n, notes };
}

/** O que um `kubectl wait --for=condition=Ready` (ou um pipeline) conclui. */
export function health(s: StatusState, cfg: StatusCfg): { text: string; tone: Tone; trustworthy: boolean } {
  if (!cfg.writesObservedGeneration) {
    return s.ready === 'True'
      ? { text: 'Ready=True — mas sem observedGeneration não há como saber se é da spec atual ou de uma anterior', tone: 'red', trustworthy: false }
      : { text: `Ready=False (${s.reason}) — de qual geração? Sem observedGeneration, impossível dizer`, tone: 'amber', trustworthy: false };
  }
  const fresh = s.observedGeneration !== null && s.observedGeneration >= s.generation;
  if (!fresh) {
    if (s.ready === 'True')
      return { text: `Ready=True, mas de uma geração anterior (observedGeneration ${s.observedGeneration ?? '—'} < generation ${s.generation}): o pipeline acharia que o deploy terminou`, tone: 'red', trustworthy: false };
    return { text: 'Em progresso: o operador ainda não observou a última spec', tone: 'amber', trustworthy: false };
  }
  return s.ready === 'True'
    ? { text: 'Current: a última spec foi processada e está pronta', tone: 'green', trustworthy: true }
    : { text: `Falhou na geração atual (${s.reason})`, tone: 'red', trustworthy: true };
}

export default function OpStatusSim() {
  const [cfg, setCfg] = useState<StatusCfg>({ statusSubresource: true, writesObservedGeneration: false });
  const [s, setS] = useState<StatusState>(INITIAL);
  const [log, setLog] = useState<LogEntry[]>([]);
  const h = health(s, cfg);

  const run = (a: StatusAction) => {
    const r = step(s, a, cfg);
    setS(r.state);
    setLog((l) => pushLog(l, ...r.notes.map((t) => logEntry(t, t.includes('IGNORA') || t.includes('também incrementou') ? 'amber' : 'dim'))));
  };

  const yaml = `metadata:
  name: pedidos
  generation: ${s.generation}
spec:
  version: ${s.specVersion}
status:${cfg.writesObservedGeneration ? `\n  observedGeneration: ${s.observedGeneration}` : ''}
  conditions:
    - type: Ready
      status: "${s.ready}"
      reason: ${s.reason}${cfg.writesObservedGeneration ? `\n      observedGeneration: ${s.observedGeneration}` : ''}`;

  return (
    <SimFrame title="Database pedidos · generation, observedGeneration e condições" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => { setS(INITIAL); setLog([]); }}>reset</button>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Toggle checked={cfg.statusSubresource} onChange={(v) => setCfg({ ...cfg, statusSubresource: v })}><span className="text-xs">CRD com <code>subresources.status</code></span></Toggle>
          <Toggle checked={cfg.writesObservedGeneration} onChange={(v) => setCfg({ ...cfg, writesObservedGeneration: v })}><span className="text-xs">Operador grava <code>observedGeneration</code></span></Toggle>
          <div className="label pt-2">Ações</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => run('edit-spec')}>Editar a spec</button>
            <button className="btn-ghost" onClick={() => run('edit-label')}>Mudar um label</button>
            <button className="btn-ghost" onClick={() => run('reconcile-ok')}>Operador reconcilia (ok)</button>
            <button className="btn-ghost" onClick={() => run('reconcile-fail')}>Operador reconcilia (falha)</button>
            <button className="btn-ghost" onClick={() => run('status-via-main')}>PATCH do status sem /status</button>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-3 font-mono text-xs">
            <span>generation <Badge tone="blue">{s.generation}</Badge></span>
            <span>observedGeneration <Badge tone={s.observedGeneration === s.generation ? 'green' : 'amber'}>{cfg.writesObservedGeneration ? s.observedGeneration : '—'}</Badge></span>
            <span>rodando: v{s.runningVersion}</span>
          </div>
          <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${h.tone === 'green' ? 'border-signal-green/60 text-signal-green' : h.tone === 'red' ? 'border-signal-red/60 text-signal-red' : 'border-signal-amber/60 text-signal-amber'}`}>
            <span className="font-mono text-xs">kubectl wait --for=condition=Ready →</span> {h.text}
          </div>
          <pre className="mb-3 overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{yaml}</pre>
          <EventLog entries={log} title="o que aconteceu" height="h-32" />
        </div>
      </div>
    </SimFrame>
  );
}
