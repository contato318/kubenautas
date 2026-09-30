import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/**
 * Autorização RBAC: somente permissiva (não existe deny).
 * - RoleBinding concede permissões apenas no próprio namespace (mesmo apontando para uma ClusterRole);
 * - ClusterRoleBinding concede em todos os namespaces e em recursos de escopo de cluster;
 * - recursos de cluster (nodes) só podem ser concedidos por ClusterRoleBinding.
 */

export type Verb = 'get' | 'list' | 'create' | 'update' | 'delete';
export type Resource = 'pods' | 'deployments' | 'secrets' | 'configmaps' | 'nodes';

export interface Role {
  kind: 'Role' | 'ClusterRole';
  name: string;
  namespace?: string;
  rules: { resources: Resource[]; verbs: Verb[] }[];
}

export interface Subject {
  id: string;
  label: string;
  /** como aparece no --as */
  as: string;
  groups: string[];
}

export interface Binding {
  id: string;
  kind: 'RoleBinding' | 'ClusterRoleBinding';
  name: string;
  namespace?: string;
  roleRef: { kind: 'Role' | 'ClusterRole'; name: string };
  subjects: string[]; // "user:ana", "group:sre", "sa:loja/ci-deployer"
}

export const CLUSTER_SCOPED: Resource[] = ['nodes'];
const READ: Verb[] = ['get', 'list'];

export const ROLES: Role[] = [
  { kind: 'Role', name: 'pod-reader', namespace: 'loja', rules: [{ resources: ['pods'], verbs: READ }] },
  { kind: 'Role', name: 'deployer', namespace: 'loja', rules: [{ resources: ['deployments'], verbs: ['get', 'list', 'create', 'update'] }, { resources: ['pods'], verbs: READ }] },
  { kind: 'ClusterRole', name: 'view', rules: [{ resources: ['pods', 'deployments', 'configmaps'], verbs: READ }] },
  { kind: 'ClusterRole', name: 'secret-reader', rules: [{ resources: ['secrets'], verbs: READ }] },
  { kind: 'ClusterRole', name: 'node-reader', rules: [{ resources: ['nodes'], verbs: READ }] },
];

export const SUBJECTS: Subject[] = [
  { id: 'user:ana', label: 'Ana (dev)', as: 'ana', groups: ['group:devs'] },
  { id: 'user:bruno', label: 'Bruno (SRE)', as: 'bruno', groups: ['group:sre'] },
  { id: 'sa:loja/ci-deployer', label: 'ServiceAccount loja/ci-deployer', as: 'system:serviceaccount:loja:ci-deployer', groups: [] },
];

export const BINDINGS: Binding[] = [
  { id: 'b1', kind: 'RoleBinding', name: 'ana-pod-reader', namespace: 'loja', roleRef: { kind: 'Role', name: 'pod-reader' }, subjects: ['user:ana'] },
  { id: 'b2', kind: 'RoleBinding', name: 'devs-view', namespace: 'dev', roleRef: { kind: 'ClusterRole', name: 'view' }, subjects: ['group:devs'] },
  { id: 'b3', kind: 'RoleBinding', name: 'ci-deployer', namespace: 'loja', roleRef: { kind: 'Role', name: 'deployer' }, subjects: ['sa:loja/ci-deployer'] },
  { id: 'b4', kind: 'ClusterRoleBinding', name: 'sre-view', roleRef: { kind: 'ClusterRole', name: 'view' }, subjects: ['group:sre'] },
  { id: 'b5', kind: 'ClusterRoleBinding', name: 'sre-nodes', roleRef: { kind: 'ClusterRole', name: 'node-reader' }, subjects: ['group:sre'] },
  { id: 'b6', kind: 'RoleBinding', name: 'sre-secrets', namespace: 'loja', roleRef: { kind: 'ClusterRole', name: 'secret-reader' }, subjects: ['group:sre'] },
];

export interface AuthResult {
  allowed: boolean;
  grantedBy: string[];
}

export function canI(subject: Subject, verb: Verb, resource: Resource, namespace: string, bindings: Binding[]): AuthResult {
  const identities = new Set([subject.id, ...subject.groups]);
  const clusterScoped = CLUSTER_SCOPED.includes(resource);
  const grantedBy = bindings
    .filter((b) => b.subjects.some((s) => identities.has(s)))
    .filter((b) => {
      if (b.kind === 'RoleBinding') {
        if (clusterScoped || b.namespace !== namespace) return false;
      }
      const role = ROLES.find((r) => r.kind === b.roleRef.kind && r.name === b.roleRef.name && (r.kind === 'ClusterRole' || r.namespace === b.namespace));
      return !!role?.rules.some((rule) => rule.resources.includes(resource) && rule.verbs.includes(verb));
    })
    .map((b) => `${b.kind} ${b.namespace ? `${b.namespace}/` : ''}${b.name} → ${b.roleRef.kind} ${b.roleRef.name}`);
  return { allowed: grantedBy.length > 0, grantedBy };
}

const VERBS: Verb[] = ['get', 'list', 'create', 'update', 'delete'];
const RESOURCES: Resource[] = ['pods', 'deployments', 'secrets', 'configmaps', 'nodes'];
const NAMESPACES = ['loja', 'dev', 'prod'];

export default function RbacSim() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(BINDINGS.map((b) => [b.id, true])));
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [verb, setVerb] = useState<Verb>('list');
  const [resource, setResource] = useState<Resource>('pods');
  const [namespace, setNamespace] = useState('loja');

  const active = BINDINGS.filter((b) => enabled[b.id]);
  const subject = SUBJECTS.find((s) => s.id === subjectId)!;
  const clusterScoped = CLUSTER_SCOPED.includes(resource);
  const result = canI(subject, verb, resource, namespace, active);

  return (
    <SimFrame title="rbac.authorization.k8s.io/v1 · kubectl auth can-i">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="label mb-2">Bindings no cluster</div>
          <div className="space-y-2">
            {BINDINGS.map((b) => (
              <Toggle key={b.id} checked={!!enabled[b.id]} onChange={(v) => setEnabled((e) => ({ ...e, [b.id]: v }))}>
                <span className="font-mono text-xs text-k8s-400">
                  {b.kind} {b.namespace ? `${b.namespace}/` : ''}{b.name}
                </span>
                <span className="block text-xs text-tactical-dim">
                  {b.subjects.join(', ')} → {b.roleRef.kind} <strong>{b.roleRef.name}</strong>
                </span>
              </Toggle>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-tactical-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-tactical-dim">
            {ROLES.map((r) => (
              <div key={r.name}>
                <span className="text-signal-cyan">{r.kind}</span> {r.namespace ? `${r.namespace}/` : ''}{r.name}:{' '}
                {r.rules.map((x) => `${x.verbs.join(',')} ${x.resources.join(',')}`).join(' · ')}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-2">Pergunta</div>
          <div className="grid grid-cols-2 gap-3">
            <Choice label="Quem" value={subjectId} onChange={setSubjectId} options={SUBJECTS.map((s) => ({ value: s.id, label: s.label }))} />
            <Choice label="Verbo" value={verb} onChange={setVerb} options={VERBS.map((v) => ({ value: v, label: v }))} />
            <Choice label="Recurso" value={resource} onChange={setResource} options={RESOURCES.map((r) => ({ value: r, label: r }))} />
            <Choice label="Namespace" value={namespace} onChange={setNamespace} options={NAMESPACES.map((n) => ({ value: n, label: n }))} />
          </div>
          <div className="mt-4 rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs">
            <div className="text-tactical-label">
              $ kubectl auth can-i {verb} {resource}
              {clusterScoped ? '' : ` -n ${namespace}`} --as={subject.as}
            </div>
            <div className={`mt-1 text-lg ${result.allowed ? 'text-signal-green' : 'text-signal-red'}`}>{result.allowed ? 'yes' : 'no'}</div>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {result.allowed ? (
              result.grantedBy.map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <Badge tone="green">concede</Badge> <span className="font-mono text-xs">{g}</span>
                </div>
              ))
            ) : (
              <p className="text-tactical-dim">
                Nenhum binding concede <code className="text-signal-amber">{verb} {resource}</code> {clusterScoped ? 'no cluster' : `em ${namespace}`} para essa identidade (nem para os
                grupos dela: {subject.groups.join(', ') || 'nenhum'}). RBAC nega tudo que não foi explicitamente permitido.
              </p>
            )}
          </div>
          {clusterScoped && (
            <p className="mt-3 text-xs text-signal-amber">nodes é um recurso de escopo de cluster: só ClusterRoleBindings podem concedê-lo.</p>
          )}
          <p className="mt-3 text-xs text-tactical-label">
            Experimente: Ana lista pods em dev (via ClusterRole view + RoleBinding) mas não em prod; Bruno lê secrets só em loja, porque a ClusterRole
            secret-reader foi ligada por uma RoleBinding.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
