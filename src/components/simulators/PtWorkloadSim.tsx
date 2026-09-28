import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Avaliação do "blast radius" de um workload: quais campos ampliam o que um comprometimento alcança. */

export interface WorkloadCfg {
  privileged: boolean;
  hostPidNet: boolean;
  hostPathRoot: boolean;
  runAsRoot: boolean;
  tokenMounted: boolean;
  saPrivileged: boolean;
  capsExtra: boolean;
  writableRoot: boolean;
}
export interface Impact {
  label: string;
  present: boolean;
  detail: string;
}

export function assessWorkload(c: WorkloadCfg): { impacts: Impact[]; radius: 'container' | 'nó' | 'cluster' } {
  const impacts: Impact[] = [
    { label: 'Acesso ao host (nó)', present: c.privileged || c.hostPathRoot || c.hostPidNet, detail: 'privileged, hostPath: / ou namespaces do host dão acesso ao nó' },
    { label: 'Token do cluster utilizável', present: c.tokenMounted, detail: 'token da ServiceAccount montado no container' },
    { label: 'Escalada via ServiceAccount', present: c.tokenMounted && c.saPrivileged, detail: 'a SA do Pod tem permissões amplas na API' },
    { label: 'Root no container', present: c.runAsRoot, detail: 'facilita alterar o container e usar binários privilegiados' },
    { label: 'Capabilities perigosas', present: c.capsExtra, detail: 'SYS_ADMIN/NET_ADMIN ampliam o que o processo faz no kernel' },
    { label: 'Persistência no container', present: c.writableRoot, detail: 'rootfs gravável permite instalar ferramentas e persistir' },
  ];
  const nodeAccess = c.privileged || c.hostPathRoot || c.hostPidNet;
  const clusterAccess = (c.tokenMounted && c.saPrivileged) || nodeAccess;
  return { impacts, radius: clusterAccess ? 'cluster' : c.tokenMounted || c.runAsRoot ? 'nó' : 'container' };
}

const PRESETS: Record<string, WorkloadCfg> = {
  'Pod endurecido': { privileged: false, hostPidNet: false, hostPathRoot: false, runAsRoot: false, tokenMounted: false, saPrivileged: false, capsExtra: false, writableRoot: false },
  'Pod comum': { privileged: false, hostPidNet: false, hostPathRoot: false, runAsRoot: true, tokenMounted: true, saPrivileged: false, capsExtra: false, writableRoot: true },
  'Pod "debug"': { privileged: true, hostPidNet: true, hostPathRoot: true, runAsRoot: true, tokenMounted: true, saPrivileged: true, capsExtra: true, writableRoot: true },
};

export default function PtWorkloadSim() {
  const [c, setC] = useState<WorkloadCfg>(PRESETS['Pod comum']);
  const set = (p: Partial<WorkloadCfg>) => setC((x) => ({ ...x, ...p }));
  const r = assessWorkload(c);
  const T = (k: keyof WorkloadCfg, label: string) => <Toggle checked={c[k]} onChange={(v) => set({ [k]: v } as Partial<WorkloadCfg>)}><span className="font-mono text-[11px]">{label}</span></Toggle>;

  return (
    <SimFrame title="avaliação de workload · alcance de um comprometimento" toolbar={<Badge tone={r.radius === 'cluster' ? 'red' : r.radius === 'nó' ? 'amber' : 'green'}>{`alcança: ${r.radius}`}</Badge>}>
      <div className="mb-3 flex flex-wrap gap-2">{Object.keys(PRESETS).map((k) => <button key={k} className="btn-ghost px-2 py-1 text-xs" onClick={() => setC(PRESETS[k])}>{k}</button>)}</div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          {T('privileged', 'privileged: true')}
          {T('hostPidNet', 'hostPID / hostNetwork')}
          {T('hostPathRoot', 'volume hostPath: /')}
          {T('capsExtra', 'capabilities SYS_ADMIN/NET_ADMIN')}
          {T('runAsRoot', 'runAsUser: 0')}
          {T('writableRoot', 'rootfs gravável')}
          {T('tokenMounted', 'token de SA montado')}
          {T('saPrivileged', 'SA do Pod é privilegiada')}
        </div>
        <ul className="min-w-0 space-y-2">
          {r.impacts.map((i) => (
            <li key={i.label} className={`rounded-md border p-2 text-sm ${i.present ? 'border-signal-red/50 bg-signal-red/5' : 'border-tactical-border opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span>{i.label}</span><Badge tone={i.present ? 'red' : 'dim'}>{i.present ? 'presente' : 'ausente'}</Badge></div>
              <div className="mt-1 text-xs text-tactical-dim">{i.detail}</div>
            </li>
          ))}
          <li className="text-xs text-tactical-label">O relatório classifica o achado pelo alcance: um Pod que só compromete a si mesmo é bem menos grave que um que dá o nó ou o cluster.</li>
        </ul>
      </div>
    </SimFrame>
  );
}
