import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Zero trust com NetworkPolicy: matriz de conectividade entre workloads, DNS, internet e o metadata da nuvem. */

export type NpToggle = 'denyIngress' | 'denyEgress' | 'allowDns' | 'allowFrontToApi' | 'allowApiToDb' | 'allowApiInternet' | 'blockMetadata';
export const NP: { id: NpToggle; label: string }[] = [
  { id: 'denyIngress', label: 'default-deny ingress (loja)' },
  { id: 'denyEgress', label: 'default-deny egress (web e loja)' },
  { id: 'allowDns', label: 'permitir egress DNS para kube-dns (53/UDP e TCP)' },
  { id: 'allowFrontToApi', label: 'permitir frontend → api:8080' },
  { id: 'allowApiToDb', label: 'permitir api → db:5432' },
  { id: 'allowApiInternet', label: 'permitir egress da api para IPv4 (0.0.0.0/0)' },
  { id: 'blockMetadata', label: 'excluir 169.254.169.254/32 (ipBlock.except)' },
];

export type Src = 'frontend' | 'api' | 'db';
export type Dst = 'api' | 'db' | 'kube-dns' | 'internet' | 'metadata';
export const SRCS: Src[] = ['frontend', 'api', 'db'];
export const DSTS: Dst[] = ['api', 'db', 'kube-dns', 'internet', 'metadata'];

export function reach(p: Set<NpToggle>, src: Src, dst: Dst): boolean {
  if ((src as string) === dst) return true;
  // Every selecting policy isolates its direction, including allow-only policies.
  const frontRule = src === 'frontend' && p.has('allowFrontToApi');
  const dbRule = src === 'api' && p.has('allowApiToDb');
  const internetRule = src === 'api' && p.has('allowApiInternet');
  const egressIsolated = p.has('denyEgress') || p.has('allowDns') || frontRule || dbRule || internetRule;
  const egressOk = !egressIsolated ||
    (dst === 'kube-dns' && p.has('allowDns')) ||
    (dst === 'api' && frontRule) || (dst === 'db' && dbRule) ||
    (internetRule && (dst !== 'metadata' || !p.has('blockMetadata')));
  if (!egressOk) return false;
  const ingressIsolated = (dst === 'api' || dst === 'db') &&
    (p.has('denyIngress') || (dst === 'api' ? p.has('allowFrontToApi') : p.has('allowApiToDb')));
  const ingressOk = !ingressIsolated || (dst === 'api' ? frontRule : dbRule);
  return ingressOk;
}

export const GOALS: { src: Src; dst: Dst; want: boolean; label: string }[] = [
  { src: 'frontend', dst: 'api', want: true, label: 'frontend acessa a api' },
  { src: 'api', dst: 'db', want: true, label: 'api acessa o banco' },
  { src: 'api', dst: 'kube-dns', want: true, label: 'DNS funciona' },
  { src: 'frontend', dst: 'db', want: false, label: 'frontend NÃO acessa o banco' },
  { src: 'db', dst: 'internet', want: false, label: 'banco NÃO sai para a internet (exfiltração)' },
  { src: 'api', dst: 'metadata', want: false, label: 'api NÃO acessa o metadata da nuvem' },
];

export default function HdNetpolMatrixSim() {
  const [p, setP] = useState<Set<NpToggle>>(new Set());
  const toggle = (k: NpToggle, v: boolean) => setP((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const met = GOALS.filter((g) => reach(p, g.src, g.dst) === g.want).length;

  return (
    <SimFrame title="NetworkPolicy · zero trust" toolbar={<Badge tone={met === GOALS.length ? 'green' : 'amber'}>{`${met}/${GOALS.length} objetivos`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          <div className="label">Policies aplicadas</div>
          {NP.map((x) => <Toggle key={x.id} checked={p.has(x.id)} onChange={(v) => toggle(x.id, v)}><span className="text-xs">{x.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead><tr><th className="p-1 text-left text-tactical-label">origem ↓ / destino →</th>{DSTS.map((d) => <th key={d} className="p-1 text-tactical-label">{d}</th>)}</tr></thead>
              <tbody>
                {SRCS.map((s) => (
                  <tr key={s} className="border-t border-tactical-border">
                    <td className="p-1">{s}</td>
                    {DSTS.map((d) => <td key={d} className="p-1 text-center">{(s as string) === d ? '—' : reach(p, s, d) ? <span className="text-signal-green">✔</span> : <span className="text-signal-red">✖</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {GOALS.map((g) => {
              const ok = reach(p, g.src, g.dst) === g.want;
              return <li key={g.label} className={ok ? 'text-signal-green' : 'text-signal-red'}>{ok ? '✔' : '✖'} {g.label}</li>;
            })}
          </ul>
          <p className="mt-2 text-xs text-tactical-label">Sem nenhuma policy, tudo fala com tudo — inclusive com o endpoint de metadata, que entrega credenciais da nuvem. Comece com default-deny em ingress e egress, libere o DNS e abra só os fluxos necessários. Policies de allow também isolam os Pods selecionados. Neste cenário IPv4, ipBlock 0.0.0.0/0 inclui IPs de Pods; NAT e implementação do CNI podem mudar o IP avaliado. NetworkPolicy exige um CNI compatível.</p>
        </div>
      </div>
    </SimFrame>
  );
}
