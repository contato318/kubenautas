import { useState } from 'react';
import { Badge, Choice, RangeField, SimFrame, Tone } from './kit';

/**
 * Linha do tempo de um nó com problema (valores padrão, simplificados):
 * - sem heartbeat por node-monitor-grace-period (~40 s): Ready=Unknown e taints unreachable (NoSchedule e NoExecute);
 * - Pods toleram unreachable/not-ready por 300 s (tolerationSeconds padrão) e depois são despejados;
 * - Pods de StatefulSet ficam Terminating até o nó confirmar ou ser removido (não há réplica duplicada);
 * - runtime travado: o kubelet vê o PLEG parado por 3 min e reporta Ready=False;
 * - disco cheio: DiskPressure, taint NoSchedule e despejo pelo próprio kubelet (o nó continua Ready).
 */

export type Failure = 'kubelet' | 'network' | 'containerd' | 'disk';
export const GRACE = 40;
export const TOLERATION = 300;
export const PLEG = 180;

export interface Snapshot {
  ready: 'True' | 'Unknown' | 'False';
  reason: string;
  diskPressure: boolean;
  taints: string[];
  pods: { name: string; owner: 'Deployment' | 'StatefulSet'; status: string; tone: Tone }[];
  events: string[];
}

export function snapshot(f: Failure, t: number): Snapshot {
  const events: string[] = [`t=0s  ${{ kubelet: 'systemctl stop kubelet (ou kubelet travou)', network: 'nó perde conectividade com o control plane', containerd: 'containerd deixa de responder', disk: 'aplicação começa a encher o disco do nó' }[f]}`];
  const pods = (web: [string, Tone], db: [string, Tone]) => [
    { name: 'web-7d9f-x2k', owner: 'Deployment' as const, status: web[0], tone: web[1] },
    { name: 'db-0', owner: 'StatefulSet' as const, status: db[0], tone: db[1] },
  ];

  if (f === 'disk') {
    const pressure = t >= 30;
    if (pressure) events.push('t=30s  NodeHasDiskPressure · taint node.kubernetes.io/disk-pressure:NoSchedule', 't=35s  kubelet: FreeDiskSpaceFailed → coleta de imagens não usadas');
    const evicted = t >= 60;
    if (evicted) events.push('t=60s  Evicted: The node was low on resource: ephemeral-storage', 't=62s  ReplicaSet cria web-7d9f-k8m em outro nó; StatefulSet recria db-0 (em outro nó, se o volume permitir)');
    return {
      ready: 'True', reason: 'KubeletReady', diskPressure: pressure, taints: pressure ? ['node.kubernetes.io/disk-pressure:NoSchedule'] : [],
      pods: evicted ? pods(['Evicted (substituído em outro nó)', 'amber'], ['Evicted (recriado)', 'amber']) : pods(['Running', 'green'], ['Running', 'green']),
      events,
    };
  }

  const detect = f === 'containerd' ? PLEG : GRACE;
  const unknown = f !== 'containerd';
  if (t < detect) {
    return { ready: 'True', reason: f === 'containerd' ? 'KubeletReady (PLEG ainda dentro do limite)' : 'KubeletReady (último heartbeat envelhecendo)', diskPressure: false, taints: [], pods: pods(['Running', 'green'], ['Running', 'green']), events };
  }
  const taintKey = unknown ? 'node.kubernetes.io/unreachable' : 'node.kubernetes.io/not-ready';
  events.push(unknown ? `t=${detect}s  NodeNotReady: Kubelet stopped posting node status (Ready=Unknown)` : `t=${detect}s  NodeNotReady: PLEG is not healthy: pleg was last seen active 3m0s ago (Ready=False)`);
  events.push(`t=${detect}s  taints ${taintKey}:NoSchedule e :NoExecute adicionados`);
  const evict = t >= detect + TOLERATION;
  if (evict) {
    events.push(`t=${detect + TOLERATION}s  taint-eviction: Pods do nó marcados para remoção (tolerationSeconds=300 esgotado)`);
    events.push(`t=${detect + TOLERATION + 2}s  ReplicaSet cria web-7d9f-p4q em outro nó`);
    events.push(`t=${detect + TOLERATION + 2}s  db-0 fica Terminating: o kubelet não confirma e o StatefulSet não cria outro db-0`);
  }
  return {
    ready: unknown ? 'Unknown' : 'False',
    reason: unknown ? 'NodeStatusUnknown' : 'KubeletNotReady',
    diskPressure: false,
    taints: [`${taintKey}:NoSchedule`, `${taintKey}:NoExecute`],
    pods: evict
      ? pods(['Terminating (substituto Running em outro nó)', 'amber'], ['Terminating — preso até o nó voltar ou ser removido', 'red'])
      : pods([unknown ? 'Running (status desatualizado: o nó não reporta)' : 'Running', 'amber'], [unknown ? 'Running (status desatualizado)' : 'Running', 'amber']),
    events,
  };
}

export default function TsNodeSim() {
  const [f, setF] = useState<Failure>('kubelet');
  const [t, setT] = useState(60);
  const s = snapshot(f, t);

  return (
    <SimFrame title="node/worker-2 · o que o cluster enxerga ao longo do tempo">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Choice label="Falha" value={f} onChange={setF} options={[
            { value: 'kubelet', label: 'kubelet parou' },
            { value: 'network', label: 'Nó perdeu a rede' },
            { value: 'containerd', label: 'containerd travou' },
            { value: 'disk', label: 'Disco do nó cheio' },
          ]} />
          <RangeField label={`Tempo desde a falha: ${t}s`} min={0} max={600} step={10} value={t} onChange={setT} />
          <div className="rounded-md border border-tactical-border p-3 font-mono text-xs">
            <div>Ready: <Badge tone={s.ready === 'True' ? 'green' : 'red'}>{s.ready}</Badge> <span className="text-tactical-label">{s.reason}</span></div>
            <div className="mt-1">DiskPressure: <Badge tone={s.diskPressure ? 'red' : 'green'}>{String(s.diskPressure)}</Badge></div>
            <div className="mt-2 text-tactical-label">Taints:</div>
            {s.taints.length ? s.taints.map((x) => <div key={x} className="text-signal-amber">{x}</div>) : <div className="text-tactical-dim">nenhum</div>}
          </div>
        </div>
        <div>
          <div className="label mb-2">Pods que estavam no nó</div>
          <div className="space-y-2">
            {s.pods.map((p) => (
              <div key={p.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-tactical-border px-3 py-2 font-mono text-xs">
                <span>{p.name} <span className="text-tactical-label">({p.owner})</span></span>
                <Badge tone={p.tone}>{p.status}</Badge>
              </div>
            ))}
          </div>
          <div className="label mb-1 mt-4">Eventos</div>
          <pre className="whitespace-pre-wrap rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{s.events.join('\n')}</pre>
          <p className="mt-3 text-xs text-tactical-label">
            Com os padrões, um nó perdido leva ~40 s para virar Unknown e mais 5 minutos para os Pods serem despejados — ajuste tolerationSeconds de not-ready/unreachable para reagir
            mais rápido. Os valores exatos variam com a versão e a configuração do cluster.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
