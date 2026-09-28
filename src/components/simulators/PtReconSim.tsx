import { useState } from 'react';
import { Badge, MetricBox, SimFrame, Toggle } from './kit';

/** Reconhecimento externo: o que um avaliador enxerga da borda e o que cada exposição revela. */

export type Surface = 'apiPublic' | 'apiAnonInfo' | 'kubelet10250' | 'kubelet10255' | 'etcd2379' | 'dashboard' | 'metrics' | 'ingressInternos';
export interface Finding {
  surface: Surface;
  label: string;
  reveals: string;
  severity: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
  probe: string;
}
export const SURFACES: Finding[] = [
  { surface: 'apiPublic', label: 'API server acessível pela internet', reveals: 'Versão do Kubernetes (/version) e ponto de autenticação exposto a força bruta e a CVEs', severity: 'Alta', probe: 'curl -k https://<ip>:6443/version' },
  { surface: 'apiAnonInfo', label: 'Descoberta anônima habilitada', reveals: 'Lista de APIs e, se houver bindings anônimos, recursos legíveis sem credencial', severity: 'Alta', probe: 'curl -k https://<ip>:6443/apis' },
  { surface: 'kubelet10250', label: 'Porta 10250 do kubelet alcançável', reveals: 'Se anônima+AlwaysAllow, execução em containers do nó, fora do RBAC', severity: 'Crítica', probe: 'curl -k https://<nó>:10250/pods' },
  { surface: 'kubelet10255', label: 'Porta read-only 10255 aberta', reveals: 'Lista de Pods, specs e variáveis de ambiente sem autenticação', severity: 'Alta', probe: 'curl http://<nó>:10255/pods' },
  { surface: 'etcd2379', label: 'etcd (2379) alcançável sem mTLS', reveals: 'Todo o estado do cluster, incluindo Secrets', severity: 'Crítica', probe: 'etcdctl --endpoints=<nó>:2379 get / --prefix' },
  { surface: 'dashboard', label: 'Kubernetes Dashboard exposto', reveals: 'Interface administrativa; com bindings amplos, controle do cluster', severity: 'Crítica', probe: 'navegador → https://<ip>/' },
  { surface: 'metrics', label: 'Endpoints de métricas públicos', reveals: 'Nomes de Pods, namespaces e topologia do cluster', severity: 'Baixa', probe: 'curl http://<ip>:9100/metrics' },
  { surface: 'ingressInternos', label: 'Ferramentas internas via Ingress público', reveals: 'Grafana, Argo CD, Prometheus, etc. expostos — alvos de credenciais padrão', severity: 'Média', probe: 'busca por subdomínios / certificados' },
];

export function recon(active: Set<Surface>): { findings: Finding[]; score: number } {
  const w = { Crítica: 10, Alta: 6, Média: 3, Baixa: 1 };
  const findings = SURFACES.filter((s) => active.has(s.surface));
  return { findings, score: findings.reduce((a, f) => a + w[f.severity], 0) };
}

export default function PtReconSim() {
  const [a, setA] = useState<Set<Surface>>(new Set(['apiPublic', 'metrics']));
  const toggle = (k: Surface, v: boolean) => setA((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const r = recon(a);

  return (
    <SimFrame title="recon externo · superfície exposta do cluster" toolbar={<Badge tone={r.score >= 10 ? 'red' : r.score > 0 ? 'amber' : 'green'}>{`exposição: ${r.score}`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <div className="label">O que responde da borda</div>
          {SURFACES.map((s) => <Toggle key={s.surface} checked={a.has(s.surface)} onChange={(v) => toggle(s.surface, v)}><span className="text-xs">{s.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          <div className="mb-3"><MetricBox label="Pontuação de exposição externa" value={r.score} tone={r.score >= 10 ? 'text-signal-red' : 'text-signal-amber'} /></div>
          {r.findings.length === 0 ? <div className="text-sm text-signal-green">Nada respondeu da borda: superfície externa mínima.</div> : (
            <ul className="space-y-2">
              {r.findings.map((f) => (
                <li key={f.surface} className="rounded-md border border-tactical-border p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{f.label}</span><Badge tone={f.severity === 'Crítica' ? 'red' : f.severity === 'Alta' ? 'amber' : 'dim'}>{f.severity}</Badge></div>
                  <div className="mt-1 text-xs text-tactical-dim">{f.reveals}</div>
                  <div className="mt-1 font-mono text-[11px] text-signal-cyan">$ {f.probe}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-tactical-label">Recon é passivo e não intrusivo: mapeia o que está exposto para priorizar. Cada item aqui vira uma recomendação de fechar a porta (rede privada, autenticação, mTLS) no relatório.</p>
        </div>
      </div>
    </SimFrame>
  );
}
