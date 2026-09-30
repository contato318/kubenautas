import { useState } from 'react';
import { Badge, Choice, MetricBox, SimFrame, Toggle } from './kit';

/** Auditoria estilo CIS/kube-bench das flags do API server, kubelet e etcd. */

export interface CPConfig {
  anonymousAuth: boolean;
  authzMode: 'AlwaysAllow' | 'RBAC' | 'Node,RBAC';
  profiling: boolean;
  auditLog: boolean;
  encryptionAtRest: boolean;
  nodeRestriction: boolean;
  kubeletAnonymous: boolean;
  kubeletAuthz: 'AlwaysAllow' | 'Webhook';
  kubeletReadOnlyPort: boolean;
  etcdClientCertAuth: boolean;
  apiPublic: boolean;
}
export type Severity = 'Crítica' | 'Alta' | 'Média' | 'Baixa';
export interface Finding {
  component: 'API server' | 'kubelet' | 'etcd' | 'rede';
  check: string;
  pass: boolean;
  severity: Severity;
  fix: string;
}

export function auditControlPlane(c: CPConfig): Finding[] {
  return [
    { component: 'API server', check: 'Autorização não é AlwaysAllow', pass: c.authzMode !== 'AlwaysAllow', severity: 'Crítica', fix: '--authorization-mode=Node,RBAC' },
    { component: 'API server', check: 'Autorizador Node habilitado (kubelets só acessam o que é do seu nó)', pass: c.authzMode === 'Node,RBAC', severity: 'Alta', fix: '--authorization-mode=Node,RBAC' },
    { component: 'API server', check: 'Admission NodeRestriction habilitado', pass: c.nodeRestriction, severity: 'Alta', fix: '--enable-admission-plugins=…,NodeRestriction' },
    { component: 'API server', check: 'Acesso anônimo desabilitado (ou restrito a health checks)', pass: !c.anonymousAuth, severity: 'Média', fix: '--anonymous-auth=false, ou AuthenticationConfiguration limitando anônimos a /healthz, /livez, /readyz' },
    { component: 'API server', check: 'Audit log habilitado com política', pass: c.auditLog, severity: 'Alta', fix: '--audit-policy-file e --audit-log-path (ou webhook de auditoria)' },
    { component: 'API server', check: 'Secrets criptografados em repouso no etcd', pass: c.encryptionAtRest, severity: 'Alta', fix: '--encryption-provider-config com KMS v2 (ou aescbc/aesgcm)' },
    { component: 'API server', check: 'Profiling desabilitado', pass: !c.profiling, severity: 'Baixa', fix: '--profiling=false' },
    { component: 'kubelet', check: 'Autenticação anônima do kubelet desabilitada', pass: !c.kubeletAnonymous, severity: 'Crítica', fix: 'authentication.anonymous.enabled: false' },
    { component: 'kubelet', check: 'Autorização do kubelet delegada ao API server', pass: c.kubeletAuthz === 'Webhook', severity: 'Crítica', fix: 'authorization.mode: Webhook' },
    { component: 'kubelet', check: 'Porta somente leitura (10255) desabilitada', pass: !c.kubeletReadOnlyPort, severity: 'Média', fix: 'readOnlyPort: 0' },
    { component: 'etcd', check: 'etcd exige certificado de cliente', pass: c.etcdClientCertAuth, severity: 'Crítica', fix: '--client-cert-auth=true (e --peer-client-cert-auth=true)' },
    { component: 'rede', check: 'API server não exposto publicamente para a internet', pass: !c.apiPublic, severity: 'Alta', fix: 'Endpoint privado, lista de IPs autorizados ou VPN/bastion' },
  ];
}

export function score(f: Finding[]) {
  const weight: Record<Severity, number> = { Crítica: 4, Alta: 3, Média: 2, Baixa: 1 };
  const total = f.reduce((a, x) => a + weight[x.severity], 0);
  const ok = f.filter((x) => x.pass).reduce((a, x) => a + weight[x.severity], 0);
  return Math.round((ok / total) * 100);
}

const INSEGURO: CPConfig = { anonymousAuth: true, authzMode: 'AlwaysAllow', profiling: true, auditLog: false, encryptionAtRest: false, nodeRestriction: false, kubeletAnonymous: true, kubeletAuthz: 'AlwaysAllow', kubeletReadOnlyPort: true, etcdClientCertAuth: false, apiPublic: true };
const PADRAO: CPConfig = { anonymousAuth: true, authzMode: 'Node,RBAC', profiling: true, auditLog: false, encryptionAtRest: false, nodeRestriction: true, kubeletAnonymous: false, kubeletAuthz: 'Webhook', kubeletReadOnlyPort: false, etcdClientCertAuth: true, apiPublic: true };

export default function HdCisAuditSim() {
  const [c, setC] = useState<CPConfig>(PADRAO);
  const f = auditControlPlane(c);
  const s = score(f);
  const set = (p: Partial<CPConfig>) => setC((x) => ({ ...x, ...p }));
  const fails = f.filter((x) => !x.pass);

  return (
    <SimFrame title="kube-bench · control plane e nós" toolbar={<div className="flex gap-2"><button className="btn-ghost px-2 py-1" onClick={() => setC(INSEGURO)}>cluster "de laboratório"</button><button className="btn-ghost px-2 py-1" onClick={() => setC(PADRAO)}>exemplo kubeadm + API pública</button></div>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <div className="label">kube-apiserver</div>
          <Choice label="--authorization-mode" value={c.authzMode} onChange={(v) => set({ authzMode: v })} options={[{ value: 'AlwaysAllow', label: 'AlwaysAllow' }, { value: 'RBAC', label: 'RBAC' }, { value: 'Node,RBAC', label: 'Node,RBAC' }]} />
          <Toggle checked={c.anonymousAuth} onChange={(v) => set({ anonymousAuth: v })}><span className="text-xs">--anonymous-auth=true</span></Toggle>
          <Toggle checked={c.nodeRestriction} onChange={(v) => set({ nodeRestriction: v })}><span className="text-xs">NodeRestriction</span></Toggle>
          <Toggle checked={c.auditLog} onChange={(v) => set({ auditLog: v })}><span className="text-xs">Audit log</span></Toggle>
          <Toggle checked={c.encryptionAtRest} onChange={(v) => set({ encryptionAtRest: v })}><span className="text-xs">Criptografia em repouso</span></Toggle>
          <Toggle checked={c.profiling} onChange={(v) => set({ profiling: v })}><span className="text-xs">--profiling=true</span></Toggle>
          <Toggle checked={c.apiPublic} onChange={(v) => set({ apiPublic: v })}><span className="text-xs">Endpoint público na internet</span></Toggle>
          <div className="label pt-2">kubelet / etcd</div>
          <Toggle checked={c.kubeletAnonymous} onChange={(v) => set({ kubeletAnonymous: v })}><span className="text-xs">kubelet: anonymous.enabled=true</span></Toggle>
          <Choice label="kubelet authorization.mode" value={c.kubeletAuthz} onChange={(v) => set({ kubeletAuthz: v })} options={[{ value: 'AlwaysAllow', label: 'AlwaysAllow' }, { value: 'Webhook', label: 'Webhook' }]} />
          <Toggle checked={c.kubeletReadOnlyPort} onChange={(v) => set({ kubeletReadOnlyPort: v })}><span className="text-xs">kubelet: readOnlyPort 10255</span></Toggle>
          <Toggle checked={c.etcdClientCertAuth} onChange={(v) => set({ etcdClientCertAuth: v })}><span className="text-xs">etcd: --client-cert-auth=true</span></Toggle>
        </div>
        <div className="min-w-0">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricBox label="Pontuação ponderada" value={`${s}%`} tone={s >= 90 ? 'text-signal-green' : s >= 60 ? 'text-signal-amber' : 'text-signal-red'} />
            <MetricBox label="Falhas críticas" value={fails.filter((x) => x.severity === 'Crítica').length} tone="text-signal-red" />
          </div>
          <ul className="space-y-1">
            {f.map((x) => (
              <li key={x.check} className="rounded border border-tactical-border px-3 py-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-mono text-tactical-label">[{x.component}]</span> {x.check}</span>
                  <span className="flex gap-1"><Badge tone={x.severity === 'Crítica' ? 'red' : x.severity === 'Alta' ? 'amber' : 'dim'}>{x.severity}</Badge><Badge tone={x.pass ? 'green' : 'red'}>{x.pass ? 'PASS' : 'FAIL'}</Badge></span>
                </div>
                {!x.pass && <div className="mt-1 font-mono text-[11px] text-signal-cyan">correção: {x.fix}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SimFrame>
  );
}
