import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/**
 * Como o upgrade/rollback trata mudanças feitas fora do Helm (drift):
 * - three-way (Helm 3+): campos do manifesto novo são impostos (mesmo que o live tenha mudado);
 *   campos que saíram do chart são removidos; campos que só existem no live (ex.: sidecar injetado) ficam.
 * - two-way (Helm 2): só aplica o que mudou entre o manifesto antigo e o novo; mudanças manuais nos demais campos ficam.
 * Valor vazio = campo ausente.
 */

export type Fields = Record<string, string>;

export function threeWay(old: Fields, live: Fields, next: Fields): Fields {
  const out: Fields = {};
  for (const k of new Set([...Object.keys(old), ...Object.keys(live), ...Object.keys(next)])) {
    if (next[k]) out[k] = next[k];
    else if (old[k]) continue; // saiu do chart → removido
    else if (live[k]) out[k] = live[k];
  }
  return out;
}

export function twoWay(old: Fields, live: Fields, next: Fields): Fields {
  const out: Fields = {};
  for (const k of new Set([...Object.keys(old), ...Object.keys(live), ...Object.keys(next)])) {
    const changed = (old[k] ?? '') !== (next[k] ?? '');
    const v = changed ? next[k] : live[k];
    if (v) out[k] = v;
  }
  return out;
}

const KEYS = ['spec.replicas', 'image', 'env.LOG_LEVEL', 'env.FEATURE_NOVA', 'limits.memory', 'containers[istio-proxy]'];

const SCENARIOS: Record<string, { label: string; old: Fields; live: Fields; next: Fields; story: string }> = {
  hpa: {
    label: 'HPA escalou, chart fixa replicas',
    story: 'O HPA escalou para 8 réplicas no pico. O chart continua com replicas: 2 e o time faz um deploy só de imagem.',
    old: { 'spec.replicas': '2', image: 'api:1.4.0', 'env.LOG_LEVEL': 'info', 'limits.memory': '512Mi' },
    live: { 'spec.replicas': '8', image: 'api:1.4.0', 'env.LOG_LEVEL': 'info', 'limits.memory': '512Mi' },
    next: { 'spec.replicas': '2', image: 'api:1.5.0', 'env.LOG_LEVEL': 'info', 'limits.memory': '512Mi' },
  },
  hotfix: {
    label: 'Hotfix manual com kubectl',
    story: 'Durante um incidente, alguém fez kubectl set image para api:1.4.1-hotfix e subiu o limite de memória. O próximo deploy do chart não inclui essas mudanças.',
    old: { 'spec.replicas': '3', image: 'api:1.4.0', 'env.LOG_LEVEL': 'info', 'limits.memory': '512Mi' },
    live: { 'spec.replicas': '3', image: 'api:1.4.1-hotfix', 'env.LOG_LEVEL': 'info', 'limits.memory': '1Gi' },
    next: { 'spec.replicas': '3', image: 'api:1.4.0', 'env.LOG_LEVEL': 'debug', 'limits.memory': '512Mi' },
  },
  sidecar: {
    label: 'Sidecar injetado + campo removido',
    story: 'O service mesh injeta o container istio-proxy (só existe no live). A versão nova do chart remove a variável FEATURE_NOVA.',
    old: { 'spec.replicas': '3', image: 'api:1.4.0', 'env.FEATURE_NOVA': 'true', 'limits.memory': '512Mi' },
    live: { 'spec.replicas': '3', image: 'api:1.4.0', 'env.FEATURE_NOVA': 'true', 'limits.memory': '512Mi', 'containers[istio-proxy]': 'istio/proxyv2' },
    next: { 'spec.replicas': '3', image: 'api:1.5.0', 'limits.memory': '512Mi' },
  },
};

export default function HelmUpgradeSim() {
  const [scenario, setScenario] = useState('hpa');
  const [old, setOld] = useState<Fields>(SCENARIOS.hpa.old);
  const [live, setLive] = useState<Fields>(SCENARIOS.hpa.live);
  const [next, setNext] = useState<Fields>(SCENARIOS.hpa.next);

  const load = (k: string) => {
    setScenario(k);
    setOld(SCENARIOS[k].old);
    setLive(SCENARIOS[k].live);
    setNext(SCENARIOS[k].next);
  };
  const three = threeWay(old, live, next);
  const two = twoWay(old, live, next);

  const cell = (f: Fields, set: (f: Fields) => void, k: string) => (
    <input className="w-full rounded border border-tactical-border bg-tactical-bg px-1.5 py-1 font-mono text-[11px]" value={f[k] ?? ''} placeholder="(ausente)" onChange={(e) => set({ ...f, [k]: e.target.value })} />
  );

  return (
    <SimFrame title="helm upgrade · three-way merge (Helm 3+) × two-way (Helm 2)">
      <Choice label="Cenário" value={scenario} onChange={load} options={Object.entries(SCENARIOS).map(([k, s]) => ({ value: k, label: s.label }))} />
      <p className="mt-2 text-sm text-tactical-dim">{SCENARIOS[scenario].story}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="text-left">
              {['campo', 'manifesto da revisão atual', 'estado live (cluster)', 'manifesto novo (chart)', 'resultado Helm 3 (3-way)', 'Helm 2 (2-way)'].map((h) => <th key={h} className="label px-1.5 py-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {KEYS.map((k) => {
              const driftLost = live[k] && live[k] !== (three[k] ?? '') ;
              return (
                <tr key={k} className="border-t border-tactical-border">
                  <td className="px-1.5 py-1 font-mono">{k}</td>
                  <td className="px-1.5 py-1">{cell(old, setOld, k)}</td>
                  <td className="px-1.5 py-1">{cell(live, setLive, k)}</td>
                  <td className="px-1.5 py-1">{cell(next, setNext, k)}</td>
                  <td className="px-1.5 py-1 font-mono">
                    {three[k] ?? <span className="text-tactical-label">(removido/ausente)</span>} {driftLost && <Badge tone="amber">mudança manual perdida</Badge>}
                  </td>
                  <td className="px-1.5 py-1 font-mono text-tactical-dim">{two[k] ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-tactical-label">
        No Helm 3+, o que está no chart vence: o HPA perde as réplicas extras a cada deploy (remova replicas do template quando houver autoscaling) e hotfixes
        manuais são desfeitos. Campos que o chart nunca declarou, como sidecars injetados, são preservados. O Helm 4 também pode aplicar via server-side
        apply, que registra o dono de cada campo (field managers).
      </p>
    </SimFrame>
  );
}
