import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/** Avaliação de segmentação: a partir de um Pod comprometido, o que o avaliador alcança na rede? */

export type Position = 'web' | 'loja' | 'kube-system';
export type Target = 'db-pagamentos' | 'api-interna' | 'metadata' | 'internet' | 'apiserver';
export interface NetPosture {
  defaultDeny: boolean;
  metadataBlocked: boolean;
  egressRestricted: boolean;
  nsIsolation: boolean;      // namespaces isolados entre si
}
export const TARGETS: { id: Target; label: string; sensitive: boolean }[] = [
  { id: 'db-pagamentos', label: 'Banco de pagamentos (ns pagamentos)', sensitive: true },
  { id: 'api-interna', label: 'API interna (mesmo ns)', sensitive: false },
  { id: 'metadata', label: 'Metadata da nuvem (169.254.169.254)', sensitive: true },
  { id: 'internet', label: 'Internet (saída)', sensitive: false },
  { id: 'apiserver', label: 'API server (kubernetes.default)', sensitive: false },
];

export function reachable(pos: Position, t: Target, n: NetPosture): boolean {
  switch (t) {
    case 'api-interna': return true; // mesmo namespace quase sempre alcançável
    case 'apiserver': return true;   // ClusterIP do apiserver costuma ser alcançável
    case 'metadata': return !n.metadataBlocked;
    case 'internet': return !n.egressRestricted;
    case 'db-pagamentos': {
      if (pos === 'kube-system') return true;
      if (!n.defaultDeny && !n.nsIsolation) return true;
      return false; // segmentado
    }
  }
}

export default function PtLateralSim() {
  const [pos, setPos] = useState<Position>('web');
  const [n, setN] = useState<NetPosture>({ defaultDeny: false, metadataBlocked: false, egressRestricted: false, nsIsolation: false });
  const set = (p: Partial<NetPosture>) => setN((x) => ({ ...x, ...p }));
  const results = TARGETS.map((t) => ({ t, reach: reachable(pos, t.id, n) }));
  const badReach = results.filter((r) => r.reach && r.t.sensitive).length;

  return (
    <SimFrame title="movimento lateral · o que se alcança de um Pod comprometido" toolbar={<Badge tone={badReach ? 'red' : 'green'}>{badReach ? `${badReach} alvos sensíveis alcançáveis` : 'alvos sensíveis isolados'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Choice label="Pod comprometido em" value={pos} onChange={setPos} options={[{ value: 'web', label: 'ns web (frontend)' }, { value: 'loja', label: 'ns loja' }, { value: 'kube-system', label: 'ns kube-system' }]} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={n.defaultDeny} onChange={(e) => set({ defaultDeny: e.target.checked })} /> default-deny nos namespaces</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={n.nsIsolation} onChange={(e) => set({ nsIsolation: e.target.checked })} /> isolamento entre namespaces</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={n.metadataBlocked} onChange={(e) => set({ metadataBlocked: e.target.checked })} /> metadata bloqueado</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#326ce5]" checked={n.egressRestricted} onChange={(e) => set({ egressRestricted: e.target.checked })} /> egress restrito</label>
        </div>
        <ul className="min-w-0 space-y-1">
          {results.map((r) => (
            <li key={r.t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-tactical-border px-3 py-1.5 text-sm">
              <span>{r.t.label}{r.t.sensitive && <span className="ml-1 text-signal-amber">(sensível)</span>}</span>
              <Badge tone={r.reach ? (r.t.sensitive ? 'red' : 'amber') : 'green'}>{r.reach ? 'alcançável' : 'bloqueado'}</Badge>
            </li>
          ))}
          <li className="text-xs text-tactical-label">O API server e serviços do mesmo namespace quase sempre são alcançáveis; a segmentação existe para conter o resto. Note que um Pod em kube-system costuma ter alcance amplo — por isso é um alvo de alto valor.</li>
        </ul>
      </div>
    </SimFrame>
  );
}
