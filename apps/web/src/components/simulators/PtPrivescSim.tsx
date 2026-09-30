import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/** Encontra o caminho de escalada de um ponto de partida até cluster-admin, dado o cenário do cluster. */

export type Start = 'anon' | 'ns-token-min' | 'ns-create-pods' | 'ns-exec' | 'dev-user';
export interface ClusterState {
  podSecurity: 'restricted' | 'baseline' | 'none';
  privilegedSaInNs: boolean;     // existe uma SA com cluster-admin e Pod usando essa SA no namespace
  nodeMetadataOpen: boolean;     // metadata da nuvem alcançável do Pod
  editBoundToDevs: boolean;      // devs têm edit (inclui exec) em prod
}
export interface Hop {
  from: string;
  action: string;
  to: string;
  requiresFix: string;
}

export function findPath(start: Start, s: ClusterState): { hops: Hop[]; reachedAdmin: boolean } {
  const hops: Hop[] = [];
  let node = start === 'anon' ? 'acesso anônimo' : start === 'dev-user' ? 'usuário dev' : 'token de SA no namespace';

  const canCreate = start === 'ns-create-pods' || (start === 'dev-user' && s.editBoundToDevs);
  const canExec = start === 'ns-exec' || (start === 'dev-user' && s.editBoundToDevs);
  if ((canCreate || canExec) && s.privilegedSaInNs) {
    hops.push({ from: node, action: canCreate ? 'cria Pod usando a SA com cluster-admin do namespace (mesmo com PSS restricted)' : 'exec em um Pod existente que usa a SA com cluster-admin', to: 'token de SA privilegiada', requiresFix: 'Restringir criação/exec e remover cluster-admin da SA' });
    hops.push({ from: 'token de SA privilegiada', action: 'usa as permissões cluster-admin explicitamente concedidas à SA deste cenário', to: 'cluster-admin', requiresFix: 'RBAC de menor privilégio' });
    return { hops, reachedAdmin: true };
  }
  if (canCreate && s.podSecurity === 'none') {
    hops.push({ from: node, action: 'cria Pod privilegiado com hostPath: /', to: 'acesso ao nó', requiresFix: 'Pod Security Admission (baseline/restricted)' });
    node = 'acesso ao nó';
    if (s.nodeMetadataOpen) hops.push({ from: node, action: 'obtém credenciais da identidade do nó no metadata', to: 'permissões IAM do nó', requiresFix: 'Menor privilégio na identidade do nó; proteção do metadata no host' });
  }
  return { hops, reachedAdmin: false };
}

const STARTS: { value: Start; label: string }[] = [
  { value: 'anon', label: 'Acesso anônimo' },
  { value: 'ns-token-min', label: 'Token de SA mínimo' },
  { value: 'ns-create-pods', label: 'Token que cria Pods' },
  { value: 'ns-exec', label: 'Token com pods/exec' },
  { value: 'dev-user', label: 'Usuário dev' },
];

export default function PtPrivescSim() {
  const [start, setStart] = useState<Start>('ns-create-pods');
  const [s, setS] = useState<ClusterState>({ podSecurity: 'none', privilegedSaInNs: true, nodeMetadataOpen: true, editBoundToDevs: true });
  const set = (p: Partial<ClusterState>) => setS((x) => ({ ...x, ...p }));
  const r = findPath(start, s);

  return (
    <SimFrame title="caminho de escalada de privilégio" toolbar={<Badge tone={r.reachedAdmin ? 'red' : r.hops.length ? 'amber' : 'green'}>{r.reachedAdmin ? 'chega a cluster-admin' : r.hops.length ? 'escala parcial' : 'sem caminho'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Choice label="Ponto de partida" value={start} onChange={setStart} options={STARTS} />
          <Choice label="Pod Security no namespace" value={s.podSecurity} onChange={(v) => set({ podSecurity: v })} options={[{ value: 'none', label: 'nenhum' }, { value: 'baseline', label: 'baseline' }, { value: 'restricted', label: 'restricted' }]} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={s.privilegedSaInNs} onChange={(e) => set({ privilegedSaInNs: e.target.checked })} /> SA com cluster-admin e Pod usando essa SA no namespace</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={s.nodeMetadataOpen} onChange={(e) => set({ nodeMetadataOpen: e.target.checked })} /> metadata da nuvem alcançável do Pod</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={s.editBoundToDevs} onChange={(e) => set({ editBoundToDevs: e.target.checked })} /> devs com edit/admin em produção</label>
        </div>
        <div className="min-w-0">
          {r.hops.length === 0 ? <div className="text-sm text-signal-green">Deste ponto de partida, os controles atuais interrompem a escalada.</div> : (
            <ol className="space-y-2">
              {r.hops.map((h, i) => (
                <li key={i} className="rounded-md border border-signal-red/50 bg-signal-red/5 p-2 text-sm">
                  <div className="font-mono text-[11px] text-tactical-label">{h.from} → {h.to}</div>
                  <div className="mt-1">{h.action}</div>
                  <div className="mt-1 text-xs text-signal-cyan">corrigido por: {h.requiresFix}</div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-tactical-label">PSS restricted bloqueia Pods privilegiados, mas não impede escolher uma SA do namespace ao criar Pods. Acesso ao nó ou a uma identidade de nuvem não implica cluster-admin; o alcance depende de RBAC, Node authorizer e IAM.</p>
        </div>
      </div>
    </SimFrame>
  );
}
