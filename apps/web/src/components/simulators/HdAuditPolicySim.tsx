import { useState } from 'react';
import { Badge, SimFrame } from './kit';

/** Política de auditoria do API server: regras avaliadas em ordem, a primeira que casa define o nível. */

export type AuditLevel = 'None' | 'Metadata' | 'Request' | 'RequestResponse';
export interface AuditRule {
  level: AuditLevel;
  users?: string[];
  verbs?: string[];
  resources?: string[];
  nonResource?: boolean;
  note: string;
}
export interface AuditReq {
  id: string;
  label: string;
  user: string;
  verb: string;
  resource?: string;
  nonResource?: boolean;
  sensitive?: boolean; // corpo contém dados secretos
  securityRelevant?: boolean;
}

export const REQUESTS: AuditReq[] = [
  { id: 'get-secret', label: 'kubectl get secret db-credentials -o yaml', user: 'maria', verb: 'get', resource: 'secrets', sensitive: true, securityRelevant: true },
  { id: 'exec', label: 'kubectl exec -it api-7d9f -- sh', user: 'joao', verb: 'create', resource: 'pods/exec', securityRelevant: true },
  { id: 'create-crb', label: 'kubectl create clusterrolebinding x --clusterrole=cluster-admin', user: 'joao', verb: 'create', resource: 'clusterrolebindings', securityRelevant: true },
  { id: 'delete-ns', label: 'kubectl delete namespace loja', user: 'ci', verb: 'delete', resource: 'namespaces', securityRelevant: true },
  { id: 'patch-cm', label: 'kubectl patch configmap app-config', user: 'ci', verb: 'patch', resource: 'configmaps' },
  { id: 'list-pods', label: 'kubectl get pods (a cada 2 s, por um dashboard)', user: 'grafana', verb: 'list', resource: 'pods' },
  { id: 'kube-proxy', label: 'watch endpointslices (kube-proxy)', user: 'system:kube-proxy', verb: 'watch', resource: 'endpointslices' },
  { id: 'healthz', label: 'GET /healthz', user: 'system:anonymous', verb: 'get', nonResource: true },
];

export const POLICIES: Record<string, AuditRule[]> = {
  Recomendada: [
    { level: 'None', users: ['system:kube-proxy'], verbs: ['watch'], resources: ['endpointslices', 'services'], note: 'ruído de componentes do sistema' },
    { level: 'None', nonResource: true, note: '/healthz, /readyz, /livez, /version' },
    { level: 'Metadata', resources: ['secrets', 'configmaps', 'tokenreviews'], note: 'nunca registre o corpo de Secrets' },
    { level: 'RequestResponse', resources: ['pods/exec', 'pods/attach', 'pods/portforward', 'clusterrolebindings', 'rolebindings', 'clusterroles', 'roles'], note: 'ações sensíveis com detalhes' },
    { level: 'Request', verbs: ['create', 'update', 'patch', 'delete', 'deletecollection'], note: 'toda escrita com o corpo da requisição' },
    { level: 'Metadata', note: 'todo o resto: quem, o quê, quando' },
  ],
  'Tudo RequestResponse': [{ level: 'RequestResponse', note: 'registra tudo, inclusive o conteúdo dos Secrets' }],
  'Ordem errada': [
    { level: 'Metadata', note: 'regra genérica primeiro…' },
    { level: 'None', resources: ['secrets'], note: '…estas nunca são avaliadas' },
    { level: 'RequestResponse', resources: ['pods/exec'], note: '' },
  ],
  'Ruído zero': [
    { level: 'None', verbs: ['get', 'list', 'watch'], note: 'descarta todas as leituras' },
    { level: 'Metadata', note: '' },
  ],
};

export function matches(r: AuditRule, q: AuditReq): boolean {
  if (r.nonResource !== undefined && !!q.nonResource !== r.nonResource) return false;
  if (r.users?.length && !r.users.includes(q.user)) return false;
  if (r.verbs?.length && !r.verbs.includes(q.verb)) return false;
  if (r.resources?.length && (!q.resource || !r.resources.includes(q.resource))) return false;
  return true;
}

export function auditLevel(rules: AuditRule[], q: AuditReq): { level: AuditLevel; rule: number; warning?: string } {
  const i = rules.findIndex((r) => matches(r, q));
  const level: AuditLevel = i === -1 ? 'None' : rules[i].level;
  let warning: string | undefined;
  if (q.sensitive && (level === 'RequestResponse' || (level === 'Request' && ['create', 'update', 'patch'].includes(q.verb)))) warning = 'o conteúdo do Secret vai parar no log de auditoria';
  else if (q.securityRelevant && level === 'None') warning = 'ação sensível sem nenhum registro';
  return { level, rule: i, warning };
}

export default function HdAuditPolicySim() {
  const [name, setName] = useState('Ordem errada');
  const rules = POLICIES[name];

  return (
    <SimFrame title="audit-policy.yaml · primeira regra que casa vence">
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.keys(POLICIES).map((k) => <button key={k} className={`rounded border px-2 py-1 text-xs ${k === name ? 'border-k8s-500 bg-k8s-500/10 text-white' : 'border-tactical-border text-tactical-dim'}`} onClick={() => setName(k)}>{k}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <ol className="space-y-1">
          {rules.map((r, i) => (
            <li key={i} className="rounded border border-tactical-border p-2 font-mono text-[11px]">
              <span className="text-tactical-label">#{i + 1}</span> level: <span className="text-signal-cyan">{r.level}</span>
              {r.users && <div>users: [{r.users.join(', ')}]</div>}
              {r.verbs && <div>verbs: [{r.verbs.join(', ')}]</div>}
              {r.resources && <div>resources: [{r.resources.join(', ')}]</div>}
              {r.nonResource && <div>nonResourceURLs: ["/healthz*", …]</div>}
              {r.note && <div className="text-tactical-label"># {r.note}</div>}
            </li>
          ))}
        </ol>
        <ul className="min-w-0 space-y-1">
          {REQUESTS.map((q) => {
            const a = auditLevel(rules, q);
            return (
              <li key={q.id} className="rounded border border-tactical-border p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">{q.label} <span className="text-tactical-label">({q.user})</span></span>
                  <span className="flex items-center gap-1"><span className="text-tactical-label">{a.rule >= 0 ? `regra #${a.rule + 1}` : 'nenhuma regra'}</span><Badge tone={a.level === 'None' ? 'dim' : a.level === 'Metadata' ? 'blue' : 'cyan'}>{a.level}</Badge></span>
                </div>
                {a.warning && <div className="mt-1 text-signal-red">⚠ {a.warning}</div>}
              </li>
            );
          })}
        </ul>
      </div>
    </SimFrame>
  );
}
