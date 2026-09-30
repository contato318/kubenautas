import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/** Encontra o caminho de escalada de um ponto de partida até cluster-admin, dado o cenário do cluster. */

export type Start = 'anon' | 'ns-token-min' | 'ns-create-pods' | 'ns-exec' | 'dev-user';
export interface ClusterState {
  podSecurity: 'restricted' | 'baseline' | 'none';
  privilegedSaInNs: boolean;     // existe uma SA muito privilegiada no namespace
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

  if (start === 'dev-user' && s.editBoundToDevs) {
    hops.push({ from: node, action: 'usa "edit" para exec em um Pod com SA privilegiada', to: 'token de SA privilegiada', requiresFix: 'Remover edit/admin genéricos de produção' });
    node = 'token de SA privilegiada';
  }
  if ((start === 'ns-create-pods' || node === 'token de SA no namespace') && s.podSecurity === 'none') {
    hops.push({ from: node, action: 'cria Pod privilegiado com hostPath: / e hostPID', to: 'acesso ao nó', requiresFix: 'Pod Security Admission (baseline/restricted)' });
    node = 'acesso ao nó';
  }
  if (start === 'ns-exec' && s.privilegedSaInNs) {
    hops.push({ from: node, action: 'exec num Pod cuja SA tem permissões amplas', to: 'token de SA privilegiada', requiresFix: 'Menor privilégio nas SAs; sem exec em prod' });
    node = 'token de SA privilegiada';
  }
  if (node === 'token de SA privilegiada' && s.privilegedSaInNs) {
    hops.push({ from: node, action: 'a SA tem list secrets / create clusterrolebindings', to: 'cluster-admin', requiresFix: 'RBAC de menor privilégio na SA' });
    node = 'cluster-admin';
  }
  if (node === 'acesso ao nó' && s.nodeMetadataOpen) {
    hops.push({ from: node, action: 'lê credenciais do nó no metadata da nuvem', to: 'conta de nuvem', requiresFix: 'IMDSv2 hop limit 1 + identidade por workload' });
    node = 'conta de nuvem';
  }
  if (node === 'acesso ao nó') {
    hops.push({ from: node, action: 'lê o kubeconfig/credenciais do kubelet no host', to: 'cluster-admin', requiresFix: 'NodeRestriction; isolar cargas sensíveis' });
    node = 'cluster-admin';
  }
  return { hops, reachedAdmin: node === 'cluster-admin' || node === 'conta de nuvem' };
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
    <SimFrame title="caminho de escalada de privilégio" toolbar={<Badge tone={r.reachedAdmin ? 'red' : r.hops.length ? 'amber' : 'green'}>{r.reachedAdmin ? 'chega a admin/nuvem' : r.hops.length ? 'escala parcial' : 'sem caminho'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Choice label="Ponto de partida" value={start} onChange={setStart} options={STARTS} />
          <Choice label="Pod Security no namespace" value={s.podSecurity} onChange={(v) => set({ podSecurity: v })} options={[{ value: 'none', label: 'nenhum' }, { value: 'baseline', label: 'baseline' }, { value: 'restricted', label: 'restricted' }]} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={s.privilegedSaInNs} onChange={(e) => set({ privilegedSaInNs: e.target.checked })} /> SA muito privilegiada no namespace</label>
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
          <p className="mt-3 text-xs text-tactical-label">Cada salto é uma recomendação no relatório. Ligue "restricted" no Pod Security ou remova a SA privilegiada e veja o caminho se romper.</p>
        </div>
      </div>
    </SimFrame>
  );
}
