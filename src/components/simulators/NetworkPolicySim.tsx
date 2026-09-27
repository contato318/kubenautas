import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/**
 * Avaliação de NetworkPolicy com a semântica da API:
 * - um Pod só é isolado numa direção se alguma policy do namespace o seleciona com aquele policyType;
 * - policies são aditivas (união das regras); não existe "deny" explícito;
 * - a conexão exige egress liberado na origem E ingress liberado no destino.
 */

export type Labels = Record<string, string>;

export interface NetPod {
  id: string;
  namespace: string;
  labels: Labels;
  external?: boolean;
}

/** Um peer: namespace só → namespaceSelector; labels só → podSelector no namespace da policy; ambos → E. */
export interface Peer {
  namespace?: string;
  labels?: Labels;
}

export interface Rule {
  /** vazio = qualquer origem/destino */
  peers: Peer[];
  /** undefined = todas as portas */
  ports?: number[];
}

export interface Policy {
  id: string;
  name: string;
  namespace: string;
  podSelector: Labels;
  types: ('Ingress' | 'Egress')[];
  ingress?: Rule[];
  egress?: Rule[];
  description: string;
}

const matches = (selector: Labels, labels: Labels) => Object.entries(selector).every(([k, v]) => labels[k] === v);

function peerMatches(peer: Peer, policyNs: string, target: NetPod) {
  if (target.external) return false; // sem ipBlock nesta simulação
  const nsOk = peer.namespace !== undefined ? target.namespace === peer.namespace : target.namespace === policyNs;
  const podOk = peer.labels ? matches(peer.labels, target.labels) : true;
  return nsOk && podOk;
}

const ruleAllows = (rule: Rule, policyNs: string, other: NetPod, port: number) =>
  (rule.ports === undefined || rule.ports.includes(port)) && (rule.peers.length === 0 || rule.peers.some((p) => peerMatches(p, policyNs, other)));

export interface Verdict {
  allowed: boolean;
  reason: string;
}

function direction(kind: 'Ingress' | 'Egress', subject: NetPod, other: NetPod, port: number, policies: Policy[]): Verdict {
  if (subject.external) return { allowed: true, reason: '' };
  const selecting = policies.filter((p) => p.namespace === subject.namespace && p.types.includes(kind) && matches(p.podSelector, subject.labels));
  if (selecting.length === 0) return { allowed: true, reason: `${kind.toLowerCase()} de ${subject.id} não está isolado` };
  const allowing = selecting.find((p) => (kind === 'Ingress' ? p.ingress : p.egress)?.some((r) => ruleAllows(r, p.namespace, other, port)));
  return allowing
    ? { allowed: true, reason: `liberado por ${allowing.name}` }
    : { allowed: false, reason: `${kind.toLowerCase()} de ${subject.id} isolado (policies: ${selecting.map((p) => p.name).join(', ')}); nenhuma regra libera esta conexão` };
}

export function evaluate(src: NetPod, dst: NetPod, port: number, policies: Policy[]): Verdict {
  const egress = direction('Egress', src, dst, port, policies);
  if (!egress.allowed) return egress;
  const ingress = direction('Ingress', dst, src, port, policies);
  if (!ingress.allowed) return ingress;
  return { allowed: true, reason: [egress.reason, ingress.reason].filter(Boolean).join(' · ') };
}

export const PODS: NetPod[] = [
  { id: 'frontend', namespace: 'loja', labels: { app: 'frontend' } },
  { id: 'api', namespace: 'loja', labels: { app: 'api' } },
  { id: 'db', namespace: 'loja', labels: { app: 'db' } },
  { id: 'prometheus', namespace: 'monitoring', labels: { app: 'prometheus' } },
  { id: 'coredns', namespace: 'kube-system', labels: { 'k8s-app': 'kube-dns' } },
  { id: 'internet', namespace: '', labels: {}, external: true },
];

export const POLICIES: Policy[] = [
  { id: 'deny-in', name: 'default-deny-ingress', namespace: 'loja', podSelector: {}, types: ['Ingress'], ingress: [], description: 'Isola a entrada de todos os Pods de loja.' },
  { id: 'fe-api', name: 'allow-frontend-to-api', namespace: 'loja', podSelector: { app: 'api' }, types: ['Ingress'], ingress: [{ peers: [{ labels: { app: 'frontend' } }], ports: [8080] }], description: 'api aceita frontend na porta 8080.' },
  { id: 'api-db', name: 'allow-api-to-db', namespace: 'loja', podSelector: { app: 'db' }, types: ['Ingress'], ingress: [{ peers: [{ labels: { app: 'api' } }], ports: [5432] }], description: 'db aceita api na porta 5432.' },
  { id: 'mon', name: 'allow-monitoring', namespace: 'loja', podSelector: {}, types: ['Ingress'], ingress: [{ peers: [{ namespace: 'monitoring' }], ports: [9090] }], description: 'Qualquer Pod do namespace monitoring pode coletar métricas na 9090.' },
  { id: 'deny-out', name: 'default-deny-egress', namespace: 'loja', podSelector: {}, types: ['Egress'], egress: [], description: 'Isola a saída de todos os Pods de loja (inclusive DNS!).' },
  { id: 'dns', name: 'allow-dns', namespace: 'loja', podSelector: {}, types: ['Egress'], egress: [{ peers: [{ namespace: 'kube-system', labels: { 'k8s-app': 'kube-dns' } }], ports: [53] }], description: 'Libera saída para o CoreDNS na porta 53.' },
  { id: 'same-ns', name: 'allow-egress-same-namespace', namespace: 'loja', podSelector: {}, types: ['Egress'], egress: [{ peers: [{ namespace: 'loja' }] }], description: 'Libera saída para qualquer Pod do próprio namespace.' },
];

export const CONNECTIONS: { from: string; to: string; port: number; label: string }[] = [
  { from: 'frontend', to: 'api', port: 8080, label: 'frontend → api:8080' },
  { from: 'api', to: 'db', port: 5432, label: 'api → db:5432' },
  { from: 'frontend', to: 'db', port: 5432, label: 'frontend → db:5432' },
  { from: 'prometheus', to: 'api', port: 9090, label: 'prometheus → api:9090 (métricas)' },
  { from: 'api', to: 'coredns', port: 53, label: 'api → coredns:53 (DNS)' },
  { from: 'api', to: 'internet', port: 443, label: 'api → internet:443' },
  { from: 'internet', to: 'frontend', port: 8080, label: 'internet → frontend:8080 (via Ingress)' },
];

const byId = (id: string) => PODS.find((p) => p.id === id)!;

export default function NetworkPolicySim() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const active = POLICIES.filter((p) => enabled[p.id]);
  const toggle = (id: string, v: boolean) => setEnabled((e) => ({ ...e, [id]: v }));

  return (
    <SimFrame
      title="networking.k8s.io/v1 · NetworkPolicy · namespace loja"
      toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setEnabled({})}>Remover todas</button>}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          <div className="label">Policies aplicadas</div>
          {POLICIES.map((p) => (
            <Toggle key={p.id} checked={!!enabled[p.id]} onChange={(v) => toggle(p.id, v)}>
              <span className="font-mono text-xs text-k8s-400">{p.name}</span>
              <span className="block text-xs text-tactical-dim">{p.description}</span>
            </Toggle>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-ghost px-2 py-1" onClick={() => setEnabled({ 'deny-in': true, 'fe-api': true, 'api-db': true, mon: true })}>Cenário: zero trust (ingress)</button>
            <button className="btn-ghost px-2 py-1" onClick={() => setEnabled({ 'deny-in': true, 'fe-api': true, 'api-db': true, 'deny-out': true, 'same-ns': true })}>Cenário: esqueci o DNS</button>
          </div>
        </div>

        <div>
          <div className="label mb-2">Teste de conectividade ({active.length} policies ativas)</div>
          <div className="space-y-2">
            {CONNECTIONS.map((c) => {
              const v = evaluate(byId(c.from), byId(c.to), c.port, active);
              return (
                <div key={c.label} className={`rounded-md border px-3 py-2 ${v.allowed ? 'border-signal-green/40 bg-signal-green/5' : 'border-signal-red/40 bg-signal-red/5'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{c.label}</span>
                    <Badge tone={v.allowed ? 'green' : 'red'}>{v.allowed ? 'permitido' : 'bloqueado'}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-tactical-dim">{v.reason || 'nenhuma policy seleciona estes Pods: tudo aberto'}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-tactical-label">
            Regras: sem policy selecionando o Pod, tudo é permitido; com policy, só passa o que alguma regra libera. A conexão precisa de egress na origem
            e ingress no destino. O tráfego da internet chega pelo Ingress Controller — aqui simplificado como origem externa.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
