import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Com um token em mãos, o avaliador enumera o que pode fazer (kubectl auth can-i --list) e o próximo passo. */

export type Perm = 'get-pods' | 'list-secrets' | 'create-pods' | 'pods-exec' | 'get-nodes' | 'list-crb' | 'create-token' | 'get-configmaps';
export const PERMS: { id: Perm; canI: string; label: string }[] = [
  { id: 'get-pods', canI: 'get pods', label: 'get/list pods' },
  { id: 'get-configmaps', canI: 'get configmaps', label: 'get configmaps' },
  { id: 'list-secrets', canI: 'list secrets', label: 'list secrets' },
  { id: 'create-pods', canI: 'create pods', label: 'create pods' },
  { id: 'pods-exec', canI: 'create pods/exec', label: 'create pods/exec' },
  { id: 'create-token', canI: 'create serviceaccounts/token', label: 'create serviceaccounts/token' },
  { id: 'get-nodes', canI: 'get nodes', label: 'get nodes' },
  { id: 'list-crb', canI: 'list clusterrolebindings', label: 'list clusterrolebindings' },
];
export interface EnumStep {
  perm: Perm;
  finding: string;
  next: string;
  weight: number;
}
const MAP: Record<Perm, Omit<EnumStep, 'perm'>> = {
  'get-pods': { finding: 'Inventário de workloads, imagens e specs (env em texto pode conter segredos)', next: 'Mapear alvos e versões vulneráveis', weight: 1 },
  'get-configmaps': { finding: 'ConfigMaps podem conter URLs internas, tokens e configs sensíveis', next: 'Procurar credenciais em configs', weight: 2 },
  'list-secrets': { finding: 'Conteúdo de todos os Secrets do escopo', next: 'Documentar exposição crítica; validar impacto com o mínimo de dados', weight: 5 },
  'create-pods': { finding: 'Pode montar qualquer Secret e usar qualquer ServiceAccount do namespace', next: 'Verificar se Pod Security limita privilégios', weight: 4 },
  'pods-exec': { finding: 'Shell em Pods de terceiros, com os tokens e Secrets deles', next: 'Avaliar alcance a Pods com SAs privilegiadas', weight: 4 },
  'create-token': { finding: 'Emite tokens para outras ServiceAccounts do namespace', next: 'Mapear SAs mais privilegiadas do namespace', weight: 4 },
  'get-nodes': { finding: 'Topologia dos nós e labels (zonas, GPU, dedicados)', next: 'Identificar nós com workloads sensíveis', weight: 1 },
  'list-crb': { finding: 'Mapa completo de quem tem o quê no cluster', next: 'Encontrar identidades com cluster-admin', weight: 2 },
};

export function enumerate(perms: Set<Perm>): { steps: EnumStep[]; reach: 'baixo' | 'médio' | 'alto' } {
  const steps = [...perms].map((p) => ({ perm: p, ...MAP[p] })).sort((a, b) => b.weight - a.weight);
  const total = steps.reduce((a, s) => a + s.weight, 0);
  const reach = total >= 8 ? 'alto' : total >= 4 ? 'médio' : 'baixo';
  return { steps, reach };
}

export default function PtEnumSim() {
  const [perms, setPerms] = useState<Set<Perm>>(new Set(['get-pods', 'get-configmaps']));
  const toggle = (k: Perm, v: boolean) => setPerms((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const r = enumerate(perms);

  return (
    <SimFrame title="$ kubectl auth can-i --list · enumeração com o token obtido" toolbar={<Badge tone={r.reach === 'alto' ? 'red' : r.reach === 'médio' ? 'amber' : 'green'}>{`alcance ${r.reach}`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-1.5">
          <div className="label">Permissões do token</div>
          {PERMS.map((p) => <Toggle key={p.id} checked={perms.has(p.id)} onChange={(v) => toggle(p.id, v)}><span className="font-mono text-[11px]">{p.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          {r.steps.length === 0 ? <div className="text-sm text-tactical-label">Token sem permissões úteis: só descoberta básica.</div> : (
            <ol className="space-y-2">
              {r.steps.map((s) => (
                <li key={s.perm} className="rounded-md border border-tactical-border p-2 text-sm">
                  <div className="font-mono text-[11px] text-tactical-label">can-i {PERMS.find((p) => p.id === s.perm)!.canI} → yes</div>
                  <div className="mt-1">{s.finding}</div>
                  <div className="mt-1 text-xs text-signal-cyan">próximo passo da avaliação: {s.next}</div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-tactical-label">Enumeração é metódica: a partir do que o token permite, o avaliador mapeia o alcance sem causar dano. Cada linha vira uma recomendação de reduzir a permissão correspondente.</p>
        </div>
      </div>
    </SimFrame>
  );
}
