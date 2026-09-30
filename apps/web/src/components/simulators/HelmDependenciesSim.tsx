import { useMemo, useState } from 'react';
import YAML from 'yaml';
import { Badge, SimFrame, Toggle } from './kit';
import { Val, isMap, mergeValues } from './helm/values';

/**
 * Dependências de um chart:
 * - condition: primeiro caminho encontrado nos values decide (e tem prioridade sobre tags);
 * - tags: habilita se alguma tag for true; desabilita se todas forem false;
 * - alias: o mesmo chart usado duas vezes, com values separados;
 * - cada subchart enxerga só a chave com o seu nome/alias, mais .Values.global.
 */

export interface Dependency {
  name: string;
  alias?: string;
  version: string;
  repository: string;
  condition?: string;
  tags?: string[];
  defaults: Val;
}

export const DEPENDENCIES: Dependency[] = [
  { name: 'postgresql', version: '~16.0.0', repository: 'oci://registry-1.docker.io/bitnamicharts', condition: 'postgresql.enabled', defaults: { auth: { database: 'app', username: 'app' }, primary: { persistence: { size: '8Gi' } } } },
  { name: 'redis', version: '^20.0.0', repository: 'oci://registry-1.docker.io/bitnamicharts', tags: ['cache'], defaults: { architecture: 'replication', auth: { enabled: true } } },
  { name: 'app', alias: 'api', version: '0.3.0', repository: 'file://../app', defaults: { replicaCount: 1, role: 'web', image: { repository: 'loja/app', tag: 'latest' } } },
  { name: 'app', alias: 'worker', version: '0.3.0', repository: 'file://../app', condition: 'worker.enabled', defaults: { replicaCount: 1, role: 'web', image: { repository: 'loja/app', tag: 'latest' } } },
];

const get = (v: Val, path: string): Val => path.split('.').reduce<Val>((acc, k) => (isMap(acc) ? acc[k] : undefined), v);

export function isEnabled(dep: Dependency, values: Val): { enabled: boolean; why: string } {
  if (dep.condition) {
    for (const path of dep.condition.split(',').map((s) => s.trim())) {
      const v = get(values, path);
      if (typeof v === 'boolean') return { enabled: v, why: `condition ${path} = ${v}` };
    }
  }
  if (dep.tags?.length) {
    const tagVals = dep.tags.map((t) => get(values, `tags.${t}`)).filter((v): v is boolean => typeof v === 'boolean');
    if (tagVals.some(Boolean)) return { enabled: true, why: `tag ${dep.tags.join(',')} = true` };
    if (tagVals.length && tagVals.every((v) => !v)) return { enabled: false, why: `tag ${dep.tags.join(',')} = false` };
  }
  return { enabled: true, why: dep.condition ? `${dep.condition} não definido → habilitado` : 'sem condition/tags → sempre habilitado' };
}

export function subchartValues(dep: Dependency, parent: Val): Val {
  const key = dep.alias ?? dep.name;
  const own = isMap(parent) ? parent[key] : undefined;
  let v = mergeValues(dep.defaults, (own ?? {}) as Val);
  const global = isMap(parent) ? parent.global : undefined;
  if (isMap(global)) v = mergeValues(v, { global });
  return v;
}

const PARENT = `global:
  imageRegistry: registry.exemplo.com
tags:
  cache: false
postgresql:
  enabled: true
  auth:
    database: loja
redis:
  architecture: standalone
api:
  replicaCount: 3
worker:
  enabled: true
  role: worker
  image:
    tag: "2.3.1"
`;

export default function HelmDependenciesSim() {
  const [values, setValues] = useState(PARENT);
  const [built, setBuilt] = useState(true);

  const parsed = useMemo(() => {
    try {
      return { v: (YAML.parse(values) ?? {}) as Val, error: '' };
    } catch (e) {
      return { v: {} as Val, error: (e as Error).message.split('\n')[0] };
    }
  }, [values]);

  const chartYaml = `apiVersion: v2\nname: loja\nversion: 1.4.0\ndependencies:\n${DEPENDENCIES.map((d) => `  - name: ${d.name}\n${d.alias ? `    alias: ${d.alias}\n` : ''}    version: "${d.version}"\n    repository: ${d.repository}\n${d.condition ? `    condition: ${d.condition}\n` : ''}${d.tags ? `    tags: [${d.tags.join(', ')}]\n` : ''}`).join('')}`;

  return (
    <SimFrame title="Chart.yaml · dependencies · loja">
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-[11px] leading-5 text-tactical-dim">{chartYaml}</pre>
          <label className="flex flex-col gap-1"><span className="label">values.yaml do chart pai (editável)</span><textarea spellCheck={false} className="h-72 w-full rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-xs text-signal-green" value={values} onChange={(e) => setValues(e.target.value)} /></label>
          <Toggle checked={built} onChange={setBuilt}><span className="text-xs">charts/ contém os .tgz (helm dependency build já rodou)</span></Toggle>
        </div>
        <div>
          {!built && (
            <pre className="mb-3 whitespace-pre-wrap rounded-md border border-signal-red/50 bg-signal-red/5 p-3 font-mono text-xs text-signal-red">
              {'$ helm install loja ./loja\nError: INSTALLATION FAILED: An error occurred while checking for chart dependencies. You may need to run `helm dependency build` to fetch missing dependencies: found in Chart.yaml, but missing in charts/ directory: postgresql, redis, app'}
            </pre>
          )}
          {parsed.error && <p className="mb-3 font-mono text-xs text-signal-red">values.yaml inválido: {parsed.error}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {DEPENDENCIES.map((d) => {
              const st = isEnabled(d, parsed.v);
              const key = d.alias ?? d.name;
              return (
                <div key={key} className={`rounded-md border p-3 ${st.enabled ? 'border-signal-green/40' : 'border-tactical-border opacity-70'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{key}</span>
                    {d.alias && <span className="font-mono text-[10px] text-tactical-label">(chart {d.name})</span>}
                    <Badge tone={st.enabled ? 'green' : 'dim'}>{st.enabled ? 'renderizado' : 'desabilitado'}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-tactical-dim">{st.why}</div>
                  {st.enabled && (
                    <>
                      <div className="label mt-2">.Values dentro do subchart</div>
                      <pre className="mt-1 max-h-48 overflow-auto rounded border border-tactical-border bg-black/50 p-2 font-mono text-[11px] text-signal-green">{YAML.stringify(subchartValues(d, parsed.v))}</pre>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-tactical-label">
            O subchart não enxerga os values do pai — só a seção com o seu nome (ou alias) e o bloco global. Experimente: postgresql.enabled: false; apague
            a condition do worker; mude tags.cache para true; coloque um valor em global e veja-o aparecer em todos os subcharts.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
