import { useMemo, useState } from 'react';
import { Badge, SimFrame } from './kit';
import { compare, parseVersion, resolve } from './helm/semver';

/** Qual versão o Helm escolhe para uma restrição (dependencies[].version ou --version)? */

const VERSIONS = '14.3.3, 15.5.0, 15.5.38, 16.0.0, 16.0.6, 16.1.0-rc.1, 16.1.0, 16.1.2, 17.0.0-beta.2';
const EXAMPLES = ['16.1.0', '~16.0.0', '^16.0.0', '16.x', '>=15.5.0 <16.0.0', '15.5 - 16.0', '^16.1.0-0', '>=16.1.0-0', '*', '^15.0.0 || ^17.0.0-0', '~16'];

export default function HelmSemverSim() {
  const [versions, setVersions] = useState(VERSIONS);
  const [constraint, setConstraint] = useState('^16.0.0');

  const list = versions.split(/[,\s]+/).filter(Boolean);
  const result = useMemo(() => {
    try {
      return { ...resolve(list, constraint), error: '' };
    } catch (e) {
      return { error: (e as Error).message, matching: [], chosen: null, constraint: null };
    }
  }, [versions, constraint]);
  const sorted = list.map(parseVersion).filter((v): v is NonNullable<typeof v> => !!v).sort((a, b) => compare(b, a));
  const invalid = list.filter((v) => !parseVersion(v));

  return (
    <SimFrame title="Chart.yaml dependencies[].version · helm install --version">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="flex flex-col gap-1"><span className="label">Versões publicadas no repositório</span><textarea className="h-20 w-full rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-xs" value={versions} onChange={(e) => setVersions(e.target.value)} /></label>
          {invalid.length > 0 && <p className="text-xs text-signal-amber">Ignoradas (não são SemVer válido): {invalid.join(', ')}</p>}
          <label className="flex flex-col gap-1"><span className="label">Restrição</span><input className="rounded-md border border-tactical-border bg-tactical-bg px-3 py-2 font-mono text-sm" value={constraint} onChange={(e) => setConstraint(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => <button key={ex} className="btn-ghost px-2 py-1 normal-case" onClick={() => setConstraint(ex)}>{ex}</button>)}
          </div>
          <div className="rounded-md border border-tactical-border bg-black/40 p-3 text-xs text-tactical-dim">
            <div className="label mb-1">Cola</div>
            <div><code className="text-signal-amber">~1.2.3</code> = &gt;=1.2.3 &lt;1.3.0 (só patch)</div>
            <div><code className="text-signal-amber">^1.2.3</code> = &gt;=1.2.3 &lt;2.0.0 (compatível); <code className="text-signal-amber">^0.2.3</code> = &gt;=0.2.3 &lt;0.3.0</div>
            <div><code className="text-signal-amber">1.2.x</code> ou <code className="text-signal-amber">1.2</code> = &gt;=1.2.0 &lt;1.3.0</div>
            <div>Prerelease (-rc, -beta) só entra se a restrição tiver prerelease (ex.: <code className="text-signal-amber">&gt;=16.1.0-0</code>).</div>
          </div>
        </div>
        <div>
          {result.error ? (
            <p className="font-mono text-sm text-signal-red">Error: {result.error}</p>
          ) : (
            <>
              <div className="font-mono text-xs text-tactical-label">expandida: {result.constraint?.expanded}</div>
              <div className="mt-3 flex items-center gap-3">
                <span className="label">Escolhida</span>
                {result.chosen ? <span className="font-mono text-2xl text-signal-green">{result.chosen.raw}</span> : <span className="font-mono text-sm text-signal-red">nenhuma — Error: no chart version found for loja-postgresql-{constraint}</span>}
              </div>
              <div className="mt-4 space-y-1">
                {sorted.map((v) => {
                  const ok = result.matching.some((m) => m.raw === v.raw);
                  const chosen = result.chosen?.raw === v.raw;
                  return (
                    <div key={v.raw} className={`flex items-center justify-between rounded border px-3 py-1 font-mono text-xs ${chosen ? 'border-signal-green bg-signal-green/10' : 'border-tactical-border'}`}>
                      <span>{v.raw}{v.pre.length ? ' (prerelease)' : ''}</span>
                      <Badge tone={chosen ? 'green' : ok ? 'cyan' : 'dim'}>{chosen ? 'escolhida' : ok ? 'satisfaz' : 'fora'}</Badge>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-tactical-label">
                O Helm escolhe a maior versão que satisfaz a restrição e grava a versão exata no Chart.lock. helm dependency build usa o lock; update resolve de
                novo e pode trazer versões novas.
              </p>
            </>
          )}
        </div>
      </div>
    </SimFrame>
  );
}
