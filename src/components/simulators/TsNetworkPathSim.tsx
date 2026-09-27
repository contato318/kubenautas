import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/**
 * O caminho de "curl http://api.loja:8080/health" saindo de um Pod, salto a salto.
 * Cada falha produz o sintoma típico que o cliente vê — é assim que se localiza o salto quebrado.
 */

export type Fault = 'coredns' | 'wrongName' | 'kubeproxy' | 'selector' | 'readiness' | 'netpol' | 'targetPort' | 'localhost';

export interface Hop {
  name: string;
  ok: boolean;
  detail: string;
  check: string;
}

export function trace(faults: Set<Fault>): { hops: Hop[]; symptom: string; ok: boolean } {
  const hops: Hop[] = [];
  const push = (h: Hop) => hops.push(h);
  const fail = (symptom: string) => ({ hops, symptom, ok: false });

  if (faults.has('coredns')) {
    push({ name: '1. DNS', ok: false, detail: 'Nenhum Pod do CoreDNS responde em 10.96.0.10:53', check: 'kubectl get pods -n kube-system -l k8s-app=kube-dns' });
    return fail('curl: (6) Could not resolve host: api.loja   (depois de ~5–10 s de espera)');
  }
  if (faults.has('wrongName')) {
    push({ name: '1. DNS', ok: false, detail: 'NXDOMAIN: não existe Service "apii" no namespace loja', check: 'kubectl get svc -n loja' });
    return fail('curl: (6) Could not resolve host: apii.loja   (imediato)');
  }
  push({ name: '1. DNS', ok: true, detail: 'api.loja → 10.96.40.12 (ClusterIP)', check: 'kubectl run -it --rm dns --image=busybox:1.36 -- nslookup api.loja' });

  if (faults.has('kubeproxy')) {
    push({ name: '2. Service (ClusterIP)', ok: false, detail: 'Não há regras de iptables/IPVS/eBPF para o ClusterIP neste nó', check: 'kubectl get pods -n kube-system -l k8s-app=kube-proxy -o wide' });
    return fail('curl: (28) Connection timed out after 10000 ms');
  }
  push({ name: '2. Service (ClusterIP)', ok: true, detail: 'kube-proxy traduz 10.96.40.12:8080 para os endpoints', check: 'kubectl get svc api -n loja -o wide' });

  if (faults.has('selector') || faults.has('readiness')) {
    push({ name: '3. Endpoints', ok: false, detail: faults.has('selector') ? 'Selector app=api não casa com nenhum Pod (os Pods têm app=api-v2)' : 'Pods existem, mas nenhum está Ready (readiness falhando)', check: 'kubectl get endpointslices -n loja -l kubernetes.io/service-name=api' });
    return fail('curl: (7) Failed to connect to api.loja port 8080: Connection refused   (Service sem endpoints → REJECT)');
  }
  push({ name: '3. Endpoints', ok: true, detail: '3 endpoints prontos: 10.244.1.7, 10.244.2.9, 10.244.3.4', check: 'kubectl get endpointslices -n loja -l kubernetes.io/service-name=api' });

  if (faults.has('netpol')) {
    push({ name: '4. NetworkPolicy', ok: false, detail: 'default-deny-ingress em loja e nenhuma regra permite a origem', check: 'kubectl get networkpolicy -n loja' });
    return fail('curl: (28) Connection timed out after 10000 ms   (pacotes descartados em silêncio)');
  }
  push({ name: '4. NetworkPolicy', ok: true, detail: 'Nenhuma policy bloqueia (ou uma regra permite a origem)', check: 'kubectl describe networkpolicy -n loja' });

  if (faults.has('targetPort') || faults.has('localhost')) {
    push({ name: '5. Container', ok: false, detail: faults.has('targetPort') ? 'targetPort 8080, mas a aplicação escuta na 3000' : 'A aplicação escuta em 127.0.0.1:8080, e não em 0.0.0.0', check: 'kubectl exec <pod> -- ss -lntp   (ou netstat)' });
    return fail('curl: (7) Failed to connect to api.loja port 8080: Connection refused');
  }
  push({ name: '5. Container', ok: true, detail: 'Processo escutando em 0.0.0.0:8080', check: 'kubectl exec <pod> -- ss -lntp' });
  return { hops, symptom: 'HTTP/1.1 200 OK', ok: true };
}

const FAULTS: { id: Fault; label: string }[] = [
  { id: 'coredns', label: 'CoreDNS fora do ar' },
  { id: 'wrongName', label: 'Nome do Service digitado errado' },
  { id: 'kubeproxy', label: 'kube-proxy/CNI sem regras no nó' },
  { id: 'selector', label: 'Selector do Service não casa' },
  { id: 'readiness', label: 'Readiness falhando em todos os Pods' },
  { id: 'netpol', label: 'NetworkPolicy bloqueando' },
  { id: 'targetPort', label: 'targetPort diferente da porta da app' },
  { id: 'localhost', label: 'App escutando só em 127.0.0.1' },
];

export default function TsNetworkPathSim() {
  const [faults, setFaults] = useState<Set<Fault>>(new Set(['netpol']));
  const r = trace(faults);
  const toggle = (f: Fault, v: boolean) => setFaults((s) => { const n = new Set(s); v ? n.add(f) : n.delete(f); return n; });

  return (
    <SimFrame title="$ kubectl exec frontend -- curl -sS http://api.loja:8080/health">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <div className="label">Falhas injetadas</div>
          {FAULTS.map((f) => (
            <Toggle key={f.id} checked={faults.has(f.id)} onChange={(v) => toggle(f.id, v)}><span className="text-xs">{f.label}</span></Toggle>
          ))}
        </div>
        <div>
          <div className={`rounded-md border p-3 font-mono text-sm ${r.ok ? 'border-signal-green/60 text-signal-green' : 'border-signal-red/60 text-signal-red'}`}>{r.symptom}</div>
          <ol className="mt-4 space-y-2">
            {r.hops.map((h) => (
              <li key={h.name} className={`rounded-md border p-3 ${h.ok ? 'border-tactical-border' : 'border-signal-red/60 bg-signal-red/5'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{h.name}</span>
                  <Badge tone={h.ok ? 'green' : 'red'}>{h.ok ? 'ok' : 'quebrado aqui'}</Badge>
                </div>
                <div className="mt-1 text-sm text-tactical-dim">{h.detail}</div>
                <div className="mt-1 font-mono text-[11px] text-signal-cyan">$ {h.check}</div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-tactical-label">
            Leia o sintoma: "Could not resolve host" é DNS; "Connection refused" é Service sem endpoints ou porta errada; "timed out" costuma ser pacote descartado (NetworkPolicy,
            firewall, rotas). A primeira falha no caminho esconde as seguintes — corrija e teste de novo.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
