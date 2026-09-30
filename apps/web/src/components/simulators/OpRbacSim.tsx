import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle, type Tone } from './kit';

/** Operator em produção: permissões mínimas do Kopf, modo de escopo, réplicas e peering. */

export type Perm = 'cr-watch' | 'cr-patch' | 'status-patch' | 'children' | 'events' | 'namespaces' | 'crds' | 'peering';
export const PERMS: { id: Perm; label: string; rule: string }[] = [
  { id: 'cr-watch', label: 'databases: list, watch', rule: '- apiGroups: [db.exemplo.com]\n  resources: [databases]\n  verbs: [list, watch]' },
  { id: 'cr-patch', label: 'databases: patch', rule: '- apiGroups: [db.exemplo.com]\n  resources: [databases]\n  verbs: [patch]' },
  { id: 'status-patch', label: 'databases/status: patch', rule: '- apiGroups: [db.exemplo.com]\n  resources: [databases/status]\n  verbs: [patch]' },
  { id: 'children', label: 'deployments, services, secrets: create, get, patch', rule: '- apiGroups: [apps, ""]\n  resources: [deployments, services, secrets]\n  verbs: [create, get, list, patch]' },
  { id: 'events', label: 'events: create', rule: '- apiGroups: [""]\n  resources: [events]\n  verbs: [create]' },
  { id: 'namespaces', label: 'namespaces: list, watch (cluster)', rule: '- apiGroups: [""]\n  resources: [namespaces]\n  verbs: [list, watch]' },
  { id: 'crds', label: 'customresourcedefinitions: list, watch', rule: '- apiGroups: [apiextensions.k8s.io]\n  resources: [customresourcedefinitions]\n  verbs: [list, watch]' },
  { id: 'peering', label: 'kopfpeerings / clusterkopfpeerings', rule: '- apiGroups: [kopf.dev]\n  resources: [kopfpeerings, clusterkopfpeerings]\n  verbs: [get, list, watch, patch]' },
];

export interface OperatorCfg {
  granted: Set<Perm>;
  scope: 'cluster' | 'namespace';
  replicas: 1 | 2;
  distinctPriorities?: boolean;
  peering: 'installed' | 'absent' | 'standalone';
}
export interface OperatorResult {
  logs: { tone: Tone; text: string }[];
  healthy: boolean;
  duplicates: boolean;
}

const SA = 'system:serviceaccount:db-system:db-operator';
const forbidden = (verb: string, res: string, group: string, where: string) => `${res} is forbidden: User "${SA}" cannot ${verb} resource "${res.replace(/\.[^/]*/, '')}" in API group "${group}" ${where}`;

export function checkOperator(c: OperatorCfg): OperatorResult {
  const g = (p: Perm) => c.granted.has(p);
  const logs: OperatorResult['logs'] = [];
  let healthy = true;
  const where = c.scope === 'cluster' ? 'at the cluster scope' : 'in the namespace "loja"';
  logs.push({ tone: 'dim', text: `kopf run operator.py ${c.scope === 'cluster' ? '--all-namespaces' : '--namespace=loja'}${c.peering === 'standalone' ? ' --standalone' : ''}` });

  if (c.scope === 'cluster' && !g('namespaces')) {
    logs.push({ tone: 'red', text: `[ERROR] ${forbidden('list', 'namespaces', '', 'at the cluster scope')}` });
    healthy = false;
  }
  if (!g('crds')) logs.push({ tone: 'amber', text: '[WARNING] sem list/watch em customresourcedefinitions: o Kopf não acompanha CRDs criados/removidos em tempo de execução' });

  let duplicates = false;
  if (c.peering === 'installed') {
    if (!g('peering')) {
      logs.push({ tone: 'red', text: `[ERROR] ${forbidden('watch', 'kopfpeerings.kopf.dev', 'kopf.dev', where)}` });
      healthy = false;
    } else if (c.replicas === 2) {
      if (!c.distinctPriorities) {
        logs.push({ tone: 'amber', text: '[WARNING] réplicas a e b com prioridade 0: ambas pausadas por colisão. Configure prioridades distintas.' });
        return { logs, healthy: false, duplicates: false };
      }
      logs.push({ tone: 'cyan', text: '[INFO] prioridade a=100, b=0: réplica b pausada em favor de a' });
    }
  } else {
    if (c.peering === 'absent') logs.push({ tone: 'amber', text: '[WARNING] Default peering object is not found, falling back to the standalone mode.' });
    if (c.replicas === 2) {
      duplicates = true;
      logs.push({ tone: 'red', text: '[réplicas a e b] ambas ativas: cada evento é tratado duas vezes (handlers concorrentes, recursos externos duplicados)' });
    }
  }

  if (!g('cr-watch')) {
    logs.push({ tone: 'red', text: `[ERROR] ${forbidden('list', 'databases.db.exemplo.com', 'db.exemplo.com', where)}` });
    logs.push({ tone: 'red', text: 'nenhum evento chega aos handlers: o operador parece "vivo", mas não faz nada' });
    return { logs, healthy: false, duplicates };
  }
  logs.push({ tone: 'dim', text: '[INFO] evento: Database loja/pedidos criado' });
  if (!g('cr-patch')) {
    logs.push({ tone: 'red', text: `[ERROR] ${forbidden('patch', 'databases.db.exemplo.com', 'db.exemplo.com', where)} — o Kopf não consegue gravar finalizer nem o progresso nas anotações` });
    return { logs, healthy: false, duplicates };
  }
  if (!g('children')) {
    logs.push({ tone: 'red', text: `[ERROR] Handler 'create_fn' failed with an exception. Will retry. — ${forbidden('create', 'deployments.apps', 'apps', 'in the namespace "loja"')}` });
    healthy = false;
  } else logs.push({ tone: 'green', text: "[INFO] Handler 'create_fn' succeeded." });
  if (!g('status-patch')) {
    logs.push({ tone: 'red', text: `[ERROR] ${forbidden('patch', 'databases.db.exemplo.com/status', 'db.exemplo.com', where)} — o status nunca é atualizado` });
    healthy = false;
  }
  if (!g('events')) logs.push({ tone: 'amber', text: '[WARNING] Failed to post an event: events is forbidden (o operador continua, mas kubectl describe fica sem eventos)' });
  return { logs, healthy: healthy && !duplicates, duplicates };
}

export default function OpRbacSim() {
  const [granted, setGranted] = useState<Set<Perm>>(new Set(['cr-watch', 'cr-patch', 'children', 'events']));
  const [scope, setScope] = useState<OperatorCfg['scope']>('namespace');
  const [replicas, setReplicas] = useState<'1' | '2'>('2');
  const [peering, setPeering] = useState<OperatorCfg['peering']>('absent');
  const [distinctPriorities, setDistinctPriorities] = useState(false);
  const r = checkOperator({ granted, scope, replicas: Number(replicas) as 1 | 2, peering, distinctPriorities });
  const toggle = (p: Perm, v: boolean) => setGranted((s) => { const n = new Set(s); v ? n.add(p) : n.delete(p); return n; });

  return (
    <SimFrame title="deployment/db-operator · logs" toolbar={<Badge tone={r.healthy ? 'green' : 'red'}>{r.healthy ? 'saudável' : r.duplicates ? 'duplicando trabalho' : 'quebrado'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Choice label="escopo" value={scope} onChange={setScope} options={[{ value: 'namespace', label: 'namespace' }, { value: 'cluster', label: 'cluster' }]} />
            <Choice label="réplicas" value={replicas} onChange={setReplicas} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]} />
            <Choice label="peering" value={peering} onChange={setPeering} options={[{ value: 'installed', label: 'CRDs + objeto default presentes' }, { value: 'absent', label: 'sem CRDs' }, { value: 'standalone', label: '--standalone' }]} />
          </div>
          <Toggle checked={distinctPriorities} onChange={setDistinctPriorities}><span className="text-xs">Prioridades distintas: a=100, b=0 (padrão: ambas 0)</span></Toggle>
          <div className="label pt-1">Permissões concedidas à ServiceAccount</div>
          {PERMS.map((p) => <Toggle key={p.id} checked={granted.has(p.id)} onChange={(v) => toggle(p.id, v)}><span className="font-mono text-[11px]">{p.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          <div className="space-y-1 rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5">
            {r.logs.map((l, i) => <div key={i} className={l.tone === 'red' ? 'text-signal-red' : l.tone === 'amber' ? 'text-signal-amber' : l.tone === 'green' ? 'text-signal-green' : l.tone === 'cyan' ? 'text-signal-cyan' : 'text-tactical-dim'}>{l.text}</div>)}
          </div>
          <div className="label mb-1 mt-3">ClusterRole / Role gerado</div>
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{`rules:\n${PERMS.filter((p) => granted.has(p.id)).map((p) => p.rule).join('\n')}`}</pre>
        </div>
      </div>
    </SimFrame>
  );
}
