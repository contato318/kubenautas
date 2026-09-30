import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Onde procurar dados sensíveis numa avaliação — e como fechar cada esconderijo. */

export type Spot = 'envLiteral' | 'configmaps' | 'mountedSecrets' | 'imageLayers' | 'gitInImage' | 'nodeMetadata' | 'etcdReadable';
export const SPOTS: { id: Spot; label: string; how: string; fix: string }[] = [
  { id: 'envLiteral', label: 'env com valores literais na spec do Pod', how: 'kubectl get pod -o yaml | grep -i -A1 env', fix: 'Usar Secret montado como arquivo, nunca valores em texto na spec' },
  { id: 'configmaps', label: 'Credenciais em ConfigMaps', how: 'kubectl get configmaps -o yaml', fix: 'Mover credenciais para Secrets/cofre; ConfigMap não é para segredo' },
  { id: 'mountedSecrets', label: 'Secrets montados em Pods acessíveis', how: 'ler o arquivo em /var/run/secrets/... do Pod alcançado', fix: 'Menor privilégio: só monta o Secret quem precisa' },
  { id: 'imageLayers', label: 'Segredos embutidos em camadas da imagem', how: 'docker history / extrair camadas da imagem', fix: 'RUN --mount=type=secret; scan de segredos no CI' },
  { id: 'gitInImage', label: 'Diretório .git ou .env dentro da imagem', how: 'listar /app dentro do container', fix: '.dockerignore com .git e .env' },
  { id: 'nodeMetadata', label: 'Credenciais do nó no metadata da nuvem', how: 'a partir do nó, consultar o endpoint de metadata', fix: 'IMDSv2 hop limit 1; identidade por workload' },
  { id: 'etcdReadable', label: 'etcd/snapshots legíveis sem criptografia', how: 'ler snapshot do etcd', fix: 'Criptografia em repouso (KMS) e backups restritos' },
];

export function loot(open: Set<Spot>): { found: typeof SPOTS; count: number } {
  const found = SPOTS.filter((s) => open.has(s.id));
  return { found, count: found.length };
}

export default function PtLootSim() {
  const [open, setOpen] = useState<Set<Spot>>(new Set(['envLiteral', 'configmaps']));
  const toggle = (k: Spot, v: boolean) => setOpen((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const r = loot(open);

  return (
    <SimFrame title="descoberta de dados sensíveis · esconderijos comuns" toolbar={<Badge tone={r.count > 2 ? 'red' : r.count ? 'amber' : 'green'}>{`${r.count} fontes expostas`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <div className="label">Presente neste cluster</div>
          {SPOTS.map((s) => <Toggle key={s.id} checked={open.has(s.id)} onChange={(v) => toggle(s.id, v)}><span className="text-xs">{s.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          {r.found.length === 0 ? <div className="text-sm text-signal-green">Nenhum esconderijo comum exposto neste cenário.</div> : (
            <ul className="space-y-2">
              {r.found.map((s) => (
                <li key={s.id} className="rounded-md border border-tactical-border p-2 text-sm">
                  <div className="font-semibold">{s.label}</div>
                  <div className="mt-1 font-mono text-[11px] text-signal-cyan">como avaliar: {s.how}</div>
                  <div className="mt-1 text-xs text-tactical-dim">correção: {s.fix}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-tactical-label">Numa avaliação, comprove a exposição com o mínimo necessário (nome do Secret, hash) — nunca copie dados reais de clientes. Cada esconderijo vira uma recomendação concreta.</p>
        </div>
      </div>
    </SimFrame>
  );
}
