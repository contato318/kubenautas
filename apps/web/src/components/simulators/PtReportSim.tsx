import { useState } from 'react';
import { Badge, Choice, MetricBox, SimFrame } from './kit';

/** Prioriza os achados por risco (probabilidade × impacto) para o relatório final. */

export type Level = 1 | 2 | 3 | 4;
export interface Finding {
  id: string;
  title: string;
  likelihood: Level;
  impact: Level;
  fix: string;
}
export type Severity = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';

export function severity(f: Finding): { sev: Severity; risk: number } {
  const risk = f.likelihood * f.impact;
  const sev: Severity = risk >= 12 ? 'Crítico' : risk >= 8 ? 'Alto' : risk >= 4 ? 'Médio' : 'Baixo';
  return { sev, risk };
}
export function prioritize(fs: Finding[]): (Finding & { sev: Severity; risk: number })[] {
  return fs.map((f) => ({ ...f, ...severity(f) })).sort((a, b) => b.risk - a.risk);
}

const INITIAL: Finding[] = [
  { id: 'anon-crb', title: 'Binding de cluster-admin a system:anonymous', likelihood: 4, impact: 4, fix: 'Remover o binding; --anonymous-auth restrito' },
  { id: 'no-pss', title: 'Namespaces sem Pod Security', likelihood: 3, impact: 4, fix: 'enforce baseline/restricted' },
  { id: 'legacy-token', title: 'Token de SA legado com permissões amplas', likelihood: 3, impact: 4, fix: 'Remover Secret; tokens curtos' },
  { id: 'no-netpol', title: 'Sem NetworkPolicy (rede plana)', likelihood: 2, impact: 3, fix: 'default-deny + fluxos mínimos' },
  { id: 'profiling', title: '--profiling habilitado no API server', likelihood: 1, impact: 2, fix: '--profiling=false' },
];

export default function PtReportSim() {
  const [fs, setFs] = useState<Finding[]>(INITIAL);
  const set = (id: string, p: Partial<Finding>) => setFs((xs) => xs.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const ranked = prioritize(fs);
  const crit = ranked.filter((f) => f.sev === 'Crítico').length;
  const opts = [1, 2, 3, 4].map((v) => ({ value: String(v), label: String(v) }));

  return (
    <SimFrame title="relatório · priorização por risco (probabilidade × impacto)" toolbar={<Badge tone={crit ? 'red' : 'green'}>{`${crit} críticos`}</Badge>}>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['Crítico', 'Alto', 'Médio', 'Baixo'] as Severity[]).map((s) => (
          <MetricBox key={s} label={s} value={ranked.filter((f) => f.sev === s).length} tone={s === 'Crítico' ? 'text-signal-red' : s === 'Alto' ? 'text-signal-amber' : 'text-tactical-text'} />
        ))}
      </div>
      <div className="space-y-2">
        {ranked.map((f, i) => (
          <div key={f.id} className="rounded-md border border-tactical-border p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-mono text-xs text-tactical-label">#{i + 1}</span> {f.title}</span>
              <span className="flex items-center gap-2"><span className="font-mono text-xs text-tactical-label">risco {f.risk}</span><Badge tone={f.sev === 'Crítico' ? 'red' : f.sev === 'Alto' ? 'amber' : f.sev === 'Médio' ? 'blue' : 'dim'}>{f.sev}</Badge></span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Choice label="probabilidade" value={String(f.likelihood)} onChange={(v) => set(f.id, { likelihood: Number(v) as Level })} options={opts} />
              <Choice label="impacto" value={String(f.impact)} onChange={(v) => set(f.id, { impact: Number(v) as Level })} options={opts} />
              <span className="text-xs text-signal-cyan">correção: {f.fix}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-tactical-label">Um bom relatório ordena por risco, não por ordem de descoberta: cada achado traz evidência, impacto, probabilidade e uma correção acionável com dono e prazo. Comece pelos críticos.</p>
    </SimFrame>
  );
}
