import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Cada componente do control plane fora do ar produz um conjunto característico de sintomas. */

export interface CPState {
  apiserver: boolean;
  etcd: boolean;
  scheduler: boolean;
  controllerManager: boolean;
  coredns: boolean;
  certsExpired: boolean;
  webhook: 'ok' | 'fail' | 'ignore';
}

export interface OpResult {
  op: string;
  ok: boolean;
  msg: string;
}

export function evaluateOps(s: CPState): OpResult[] {
  const apiErr = s.certsExpired
    ? 'Unable to connect to the server: x509: certificate has expired or is not yet valid'
    : !s.apiserver
      ? 'The connection to the server 10.0.0.10:6443 was refused - did you specify the right host or port?'
      : !s.etcd
        ? 'Error from server: etcdserver: request timed out'
        : '';
  const noApi = apiErr !== '';
  const webhookErr = 'Error from server (InternalError): Internal error occurred: failed calling webhook "validate.policy.exemplo.com": failed to call webhook: Post "https://policy-svc.policy.svc:443/validate?timeout=10s": context deadline exceeded';

  const r: OpResult[] = [];
  r.push({ op: '$ kubectl get pods', ok: !noApi, msg: noApi ? apiErr : 'lista os Pods normalmente' });
  if (noApi) r.push({ op: '$ kubectl apply -f deployment.yaml', ok: false, msg: apiErr });
  else if (s.webhook === 'fail') r.push({ op: '$ kubectl apply -f deployment.yaml', ok: false, msg: webhookErr });
  else r.push({ op: '$ kubectl apply -f deployment.yaml', ok: true, msg: s.webhook === 'ignore' ? 'deployment.apps/api created — ATENÇÃO: o webhook falhou e a política foi ignorada (failurePolicy: Ignore)' : 'deployment.apps/api created' });

  const created = !noApi && s.webhook !== 'fail';
  r.push({
    op: 'ReplicaSet e Pods criados pelo Deployment',
    ok: created && s.controllerManager,
    msg: !created ? 'nada foi criado' : !s.controllerManager ? 'Deployment existe, mas READY 0/3 e nenhum ReplicaSet — sem eventos, porque o controller não está rodando' : '3 Pods criados',
  });
  r.push({
    op: 'Pods novos agendados em nós',
    ok: created && s.controllerManager && s.scheduler,
    msg: !created || !s.controllerManager ? 'não há Pods para agendar' : !s.scheduler ? 'Pods ficam Pending sem nenhum evento FailedScheduling (ninguém está tentando agendar)' : 'Pods agendados e Running',
  });
  r.push({ op: 'Pods que já estavam rodando continuam atendendo', ok: true, msg: noApi ? 'sim: o kubelet mantém os containers, mas nada pode ser alterado' : 'sim' });
  r.push({ op: 'Resolução DNS dentro do cluster', ok: s.coredns, msg: s.coredns ? (noApi ? 'funciona para nomes já conhecidos (sem novas atualizações)' : 'funciona') : 'Could not resolve host: CoreDNS fora do ar' });
  r.push({ op: 'Nó que cai é marcado como NotReady', ok: !noApi && s.controllerManager, msg: noApi || !s.controllerManager ? 'não: o node lifecycle controller não está atuando; o nó morto continua Ready e nada é reagendado' : 'sim, em ~50 s' });
  return r;
}

export default function TsControlPlaneSim() {
  const [s, setS] = useState<CPState>({ apiserver: true, etcd: true, scheduler: false, controllerManager: true, coredns: true, certsExpired: false, webhook: 'ok' });
  const set = (p: Partial<CPState>) => setS((x) => ({ ...x, ...p }));
  const ops = evaluateOps(s);
  const down = (label: string, key: keyof CPState) => (
    <Toggle checked={!s[key]} onChange={(v) => set({ [key]: !v } as Partial<CPState>)}><span className="text-xs">{label} fora do ar</span></Toggle>
  );

  return (
    <SimFrame title="control plane · o que funciona e o que quebra">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {down('kube-apiserver', 'apiserver')}
          {down('etcd', 'etcd')}
          {down('kube-scheduler', 'scheduler')}
          {down('kube-controller-manager', 'controllerManager')}
          {down('CoreDNS', 'coredns')}
          <Toggle checked={s.certsExpired} onChange={(v) => set({ certsExpired: v })}><span className="text-xs">Certificados do cluster expirados</span></Toggle>
          <Choice label="Webhook de admission (policy)" value={s.webhook} onChange={(v) => set({ webhook: v })} options={[
            { value: 'ok', label: 'saudável' },
            { value: 'fail', label: 'fora do ar · failurePolicy: Fail' },
            { value: 'ignore', label: 'fora do ar · failurePolicy: Ignore' },
          ]} />
        </div>
        <div className="space-y-2">
          {ops.map((o) => (
            <div key={o.op} className={`rounded-md border p-3 ${o.ok ? 'border-tactical-border' : 'border-signal-red/60 bg-signal-red/5'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{o.op}</span>
                <Badge tone={o.ok ? 'green' : 'red'}>{o.ok ? 'ok' : 'falha'}</Badge>
              </div>
              <div className={`mt-1 text-xs ${o.ok ? 'text-tactical-dim' : 'text-signal-red'}`}>{o.msg}</div>
            </div>
          ))}
          <p className="text-xs text-tactical-label">
            Padrões para memorizar: Pods Pending sem eventos → scheduler; Deployment sem ReplicaSet → controller-manager; "connection refused" em 6443 → API server; timeouts do etcd
            → disco/quorum do etcd; x509 → certificados; "failed calling webhook" → webhook de admission.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
