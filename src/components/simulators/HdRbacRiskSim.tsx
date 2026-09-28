import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Análise de risco de permissões RBAC: quais regras "inocentes" permitem escalar privilégio. */

export type RulePerm = 'read-pods' | 'logs' | 'secrets-ns' | 'secrets-cluster' | 'create-pods' | 'deployments' | 'pods-exec' | 'sa-token' | 'escalate-bind' | 'impersonate' | 'nodes-proxy' | 'webhooks' | 'csr-approve' | 'wildcard';
export const RULES: { id: RulePerm; label: string; yaml: string }[] = [
  { id: 'read-pods', label: 'get/list/watch pods', yaml: '{ apiGroups: [""], resources: [pods], verbs: [get, list, watch] }' },
  { id: 'logs', label: 'get pods/log', yaml: '{ apiGroups: [""], resources: [pods/log], verbs: [get] }' },
  { id: 'secrets-ns', label: 'get/list secrets (namespace)', yaml: '{ apiGroups: [""], resources: [secrets], verbs: [get, list] }' },
  { id: 'secrets-cluster', label: 'list secrets (cluster inteiro, ClusterRole)', yaml: '{ apiGroups: [""], resources: [secrets], verbs: [list] }   # ClusterRoleBinding' },
  { id: 'create-pods', label: 'create pods', yaml: '{ apiGroups: [""], resources: [pods], verbs: [create] }' },
  { id: 'deployments', label: 'create/update deployments', yaml: '{ apiGroups: [apps], resources: [deployments], verbs: [create, update, patch] }' },
  { id: 'pods-exec', label: 'create pods/exec', yaml: '{ apiGroups: [""], resources: [pods/exec], verbs: [create] }' },
  { id: 'sa-token', label: 'create serviceaccounts/token', yaml: '{ apiGroups: [""], resources: [serviceaccounts/token], verbs: [create] }' },
  { id: 'escalate-bind', label: 'escalate/bind em roles', yaml: '{ apiGroups: [rbac.authorization.k8s.io], resources: [roles, clusterroles], verbs: [escalate, bind] }' },
  { id: 'impersonate', label: 'impersonate users/groups', yaml: '{ apiGroups: [""], resources: [users, groups, serviceaccounts], verbs: [impersonate] }' },
  { id: 'nodes-proxy', label: 'get nodes/proxy', yaml: '{ apiGroups: [""], resources: [nodes/proxy], verbs: [get, create] }' },
  { id: 'webhooks', label: 'patch validating/mutating webhooks', yaml: '{ apiGroups: [admissionregistration.k8s.io], resources: [mutatingwebhookconfigurations], verbs: [patch] }' },
  { id: 'csr-approve', label: 'aprovar CertificateSigningRequests', yaml: '{ apiGroups: [certificates.k8s.io], resources: [certificatesigningrequests/approval], verbs: [update] }' },
  { id: 'wildcard', label: '* em *', yaml: '{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }' },
];

export type Level = 'baixo' | 'médio' | 'alto' | 'cluster-admin';
export interface Risk {
  perm: RulePerm;
  level: Level;
  why: string;
}

const RISKS: Record<RulePerm, { level: Level; why: string }> = {
  'read-pods': { level: 'baixo', why: 'Leitura de metadados. Cuidado: env com valores literais aparece na spec.' },
  logs: { level: 'baixo', why: 'Logs podem conter dados pessoais ou segredos logados por engano.' },
  'secrets-ns': { level: 'alto', why: 'list em secrets devolve o CONTEÚDO de todos os Secrets do namespace, incluindo tokens e senhas.' },
  'secrets-cluster': { level: 'cluster-admin', why: 'Todos os Secrets do cluster, inclusive tokens de ServiceAccounts de controllers poderosos.' },
  'create-pods': { level: 'alto', why: 'Um Pod pode montar qualquer Secret e usar qualquer ServiceAccount do namespace — e, sem Pod Security, ser privilegiado e tomar o nó.' },
  deployments: { level: 'alto', why: 'Criar workloads equivale a criar Pods (o controller cria por você).' },
  'pods-exec': { level: 'alto', why: 'Shell em Pods de terceiros: lê o token e os Secrets montados deles.' },
  'sa-token': { level: 'alto', why: 'Emite tokens para qualquer ServiceAccount do namespace, herdando suas permissões.' },
  'escalate-bind': { level: 'cluster-admin', why: 'escalate permite criar Roles com permissões que você não tem; bind permite vinculá-las — inclusive cluster-admin.' },
  impersonate: { level: 'cluster-admin', why: 'Agir como outro usuário ou grupo (ex.: --as-group=system:masters).' },
  'nodes-proxy': { level: 'cluster-admin', why: 'Acesso direto à API do kubelet: exec em qualquer Pod do nó, sem passar pela autorização de pods/exec.' },
  webhooks: { level: 'cluster-admin', why: 'Um webhook mutante sob seu controle pode alterar todo Pod criado no cluster.' },
  'csr-approve': { level: 'cluster-admin', why: 'Aprovar CSRs (com o signer adequado) permite emitir certificados de cliente para identidades privilegiadas.' },
  wildcard: { level: 'cluster-admin', why: 'Tudo, inclusive recursos que ainda serão criados (CRDs futuros).' },
};

const ORDER: Level[] = ['baixo', 'médio', 'alto', 'cluster-admin'];

export function analyzeRules(perms: Set<RulePerm>): { risks: Risk[]; effective: Level } {
  const risks = [...perms].map((p) => ({ perm: p, ...RISKS[p] })).sort((a, b) => ORDER.indexOf(b.level) - ORDER.indexOf(a.level));
  const effective: Level = risks.length ? risks[0].level : 'baixo';
  return { risks, effective };
}

export default function HdRbacRiskSim() {
  const [perms, setPerms] = useState<Set<RulePerm>>(new Set(['read-pods', 'logs', 'create-pods']));
  const r = analyzeRules(perms);
  const toggle = (k: RulePerm, v: boolean) => setPerms((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const tone = (l: Level) => (l === 'cluster-admin' ? 'red' : l === 'alto' ? 'amber' : 'green');

  return (
    <SimFrame title="Role time-dev · análise de risco" toolbar={<Badge tone={tone(r.effective)}>{`nível efetivo: ${r.effective}`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          <div className="label">Permissões concedidas</div>
          {RULES.map((x) => <Toggle key={x.id} checked={perms.has(x.id)} onChange={(v) => toggle(x.id, v)}><span className="font-mono text-[11px]">{x.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          {r.risks.length === 0 ? <div className="text-sm text-tactical-label">Nenhuma permissão concedida.</div> : (
            <ul className="space-y-2">
              {r.risks.map((x) => (
                <li key={x.perm} className="rounded-md border border-tactical-border p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{RULES.find((y) => y.id === x.perm)!.label}</span><Badge tone={tone(x.level)}>{x.level}</Badge></div>
                  <div className="mt-1 text-xs text-tactical-dim">{x.why}</div>
                </li>
              ))}
            </ul>
          )}
          <pre className="mt-3 overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{`kind: Role\nmetadata: { name: time-dev, namespace: loja }\nrules:\n${[...perms].map((p) => `  - ${RULES.find((y) => y.id === p)!.yaml}`).join('\n')}`}</pre>
          <p className="mt-2 text-xs text-tactical-label">Revise com <code>kubectl auth can-i --list --as=…</code> e ferramentas como rbac-tool, KubiScan ou kubescape. Permissões de escrita em workloads valem tanto quanto as permissões da ServiceAccount mais poderosa do namespace.</p>
        </div>
      </div>
    </SimFrame>
  );
}
