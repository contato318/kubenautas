import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Ações de um invasor dentro do container × controles de runtime: prevenido, detectado ou despercebido. */

export type Control = 'distroless' | 'readOnlyRoot' | 'noAutomount' | 'egressPolicy' | 'seccomp' | 'dropCaps' | 'falco';
export const CONTROLS: { id: Control; label: string }[] = [
  { id: 'distroless', label: 'Imagem sem shell (distroless)' },
  { id: 'readOnlyRoot', label: 'readOnlyRootFilesystem: true' },
  { id: 'noAutomount', label: 'Sem token de ServiceAccount montado' },
  { id: 'egressPolicy', label: 'NetworkPolicy de egress restritiva' },
  { id: 'seccomp', label: 'seccompProfile: RuntimeDefault' },
  { id: 'dropCaps', label: 'capabilities.drop: [ALL]' },
  { id: 'falco', label: 'Falco com regras padrão' },
];

export type ActionId = 'shell' | 'write-bin' | 'token' | 'metadata' | 'miner' | 'escape';
export const ACTIONS: { id: ActionId; label: string; prevent: Control[]; detect?: string }[] = [
  { id: 'shell', label: 'Abrir /bin/sh pelo RCE', prevent: ['distroless'], detect: 'Terminal shell in container' },
  { id: 'write-bin', label: 'Gravar um binário em /usr/local/bin', prevent: ['readOnlyRoot'], detect: 'Write below binary dir' },
  { id: 'token', label: 'Ler o token da ServiceAccount', prevent: ['noAutomount'] },
  { id: 'metadata', label: 'curl http://169.254.169.254/ (credenciais da nuvem)', prevent: ['egressPolicy'], detect: 'Contact cloud metadata service from container' },
  { id: 'miner', label: 'Baixar um minerador de um destino externo bloqueado', prevent: ['egressPolicy'], detect: 'Drop and execute new binary in container' },
  { id: 'escape', label: 'mount/unshare para escapar para o host', prevent: ['dropCaps', 'seccomp'], detect: 'Change namespace privileges via unshare' },
];

export type Outcome = 'prevented' | 'detected' | 'unnoticed';
export function runtimeOutcome(a: ActionId, c: Set<Control>): { outcome: Outcome; by: string[] } {
  const act = ACTIONS.find((x) => x.id === a)!;
  const prev = act.prevent.filter((p) => c.has(p));
  if (prev.length) return { outcome: 'prevented', by: prev.map((p) => CONTROLS.find((x) => x.id === p)!.label) };
  if (act.detect && c.has('falco')) return { outcome: 'detected', by: [`Falco: ${act.detect}`] };
  return { outcome: 'unnoticed', by: [] };
}

export default function HdRuntimeSim() {
  const [c, setC] = useState<Set<Control>>(new Set(['falco']));
  const toggle = (k: Control, v: boolean) => setC((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const res = ACTIONS.map((a) => ({ a, ...runtimeOutcome(a.id, c) }));
  const unnoticed = res.filter((r) => r.outcome === 'unnoticed').length;

  return (
    <SimFrame title="pod loja/api comprometido · runtime" toolbar={<Badge tone={unnoticed ? 'red' : 'green'}>{`${unnoticed} ações despercebidas`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          <div className="label">Controles</div>
          {CONTROLS.map((x) => <Toggle key={x.id} checked={c.has(x.id)} onChange={(v) => toggle(x.id, v)}><span className="text-xs">{x.label}</span></Toggle>)}
        </div>
        <ul className="min-w-0 space-y-2">
          {res.map((r) => (
            <li key={r.a.id} className="rounded-md border border-tactical-border p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{r.a.label}</span>
                <Badge tone={r.outcome === 'prevented' ? 'green' : r.outcome === 'detected' ? 'cyan' : 'red'}>{r.outcome === 'prevented' ? 'prevenido' : r.outcome === 'detected' ? 'detectado' : 'despercebido'}</Badge>
              </div>
              {r.by.length > 0 && <div className="mt-1 text-xs text-tactical-dim">{r.by.join(' · ')}</div>}
            </li>
          ))}
          <li className="text-xs text-tactical-label">Prevenção reduz o que o invasor consegue fazer; detecção depende das regras habilitadas e da coleta de eventos. Rootfs somente leitura não impede execução em memória ou em volumes graváveis. Os nomes das regras seguem o conjunto padrão do Falco (algumas vêm desabilitadas e precisam ser ativadas).</li>
        </ul>
      </div>
    </SimFrame>
  );
}
