import { useMemo, useState } from 'react';
import YAML from 'yaml';
import { Badge, SimFrame } from './kit';
import { Val, applySet, goPrint, goType, leaves, mergeValues, parseSet, GoInt, isMap } from './helm/values';

/** Merge de values: values.yaml do chart < -f (na ordem) < --set < --set-string. */

export interface Layer {
  name: string;
  values: Val;
}

export function computeValues(chart: string, files: string[], set: string, setString: string) {
  const layers: Layer[] = [];
  const parse = (src: string) => (YAML.parse(src) ?? {}) as Val;
  layers.push({ name: 'values.yaml (chart)', values: parse(chart) });
  files.forEach((f, i) => layers.push({ name: `-f values-${i === 0 ? 'prod' : 'extra'}.yaml`, values: parse(f) }));
  let final: Val = {};
  const origin = new Map<string, string>();
  for (const l of layers) {
    final = mergeValues(final, l.values);
    for (const [k] of leaves(l.values)) origin.set(k, l.name);
  }
  for (const [flag, expr, asString] of [['--set', set, false], ['--set-string', setString, true]] as const) {
    for (const e of parseSet(expr, asString)) {
      final = applySet(final, e);
      const key = e.path.reduce<string>((acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), '');
      origin.set(key.replace(/\[\d+\]$/, ''), flag);
      origin.set(key, flag);
    }
  }
  return { final, origin };
}

const toPlain = (v: Val): unknown => (v instanceof GoInt ? v.n : Array.isArray(v) ? v.map(toPlain) : isMap(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)])) : v);

const PRESETS = {
  base: {
    label: 'Precedência básica',
    chart: 'replicaCount: 1\nimage:\n  repository: loja/api\n  tag: "2.3.0"\n  pullPolicy: IfNotPresent\nresources:\n  limits:\n    memory: 256Mi\n',
    files: ['replicaCount: 3\nresources:\n  limits:\n    cpu: 500m\n'],
    set: 'image.tag=2.4.0',
    setString: '',
  },
  lists: {
    label: 'Listas são substituídas',
    chart: 'env:\n  - name: LOG_LEVEL\n    value: info\n  - name: DB_HOST\n    value: postgres\n  - name: DB_PORT\n    value: "5432"\n',
    files: ['env:\n  - name: LOG_LEVEL\n    value: debug\n'],
    set: '',
    setString: '',
  },
  nulls: {
    label: 'null remove chaves',
    chart: 'podAnnotations:\n  prometheus.io/scrape: "true"\n  sidecar.istio.io/inject: "true"\nnodeSelector:\n  disktype: ssd\n',
    files: ['podAnnotations:\n  sidecar.istio.io/inject: null\n'],
    set: 'nodeSelector=null',
    setString: '',
  },
  numbers: {
    label: 'Números e tipos',
    chart: 'image:\n  tag: 20240501\nappVersion: 1.10\nport: 8080\nenabled: "false"\n',
    files: [''],
    set: 'buildId=20240501,debug=true',
    setString: 'image.tag=20240501',
  },
} as const;

type PresetKey = keyof typeof PRESETS;

export default function HelmValuesSim() {
  const [preset, setPreset] = useState<PresetKey>('base');
  const [chart, setChart] = useState<string>(PRESETS.base.chart);
  const [file, setFile] = useState<string>(PRESETS.base.files[0]);
  const [set, setSet] = useState<string>(PRESETS.base.set);
  const [setString, setSetString] = useState<string>(PRESETS.base.setString);

  const load = (k: PresetKey) => {
    const p = PRESETS[k];
    setPreset(k);
    setChart(p.chart);
    setFile(p.files[0]);
    setSet(p.set);
    setSetString(p.setString);
  };

  const result = useMemo(() => {
    try {
      return { ...computeValues(chart, [file], set, setString), error: '' };
    } catch (e) {
      return { final: {} as Val, origin: new Map<string, string>(), error: (e as Error).message };
    }
  }, [chart, file, set, setString]);

  const rows = leaves(result.final).filter(([k]) => k);
  const ta = 'h-36 w-full rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-xs text-signal-green';

  return (
    <SimFrame title="helm upgrade loja ./loja -f values-prod.yaml --set … --set-string …">
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
          <button key={k} className={`btn-ghost px-2 py-1 ${preset === k ? 'border-k8s-500 text-white' : ''}`} onClick={() => load(k)}>{PRESETS[k].label}</button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="label">1 · values.yaml do chart</span><textarea className={ta} value={chart} onChange={(e) => setChart(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="label">2 · -f values-prod.yaml</span><textarea className={ta} value={file} onChange={(e) => setFile(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className="label">3 · --set</span><input className="rounded-md border border-tactical-border bg-tactical-bg px-2 py-1.5 font-mono text-xs" value={set} onChange={(e) => setSet(e.target.value)} placeholder="a.b=1,lista={x,y}" /></label>
        <label className="flex flex-col gap-1"><span className="label">4 · --set-string</span><input className="rounded-md border border-tactical-border bg-tactical-bg px-2 py-1.5 font-mono text-xs" value={setString} onChange={(e) => setSetString(e.target.value)} placeholder="image.tag=0123" /></label>
      </div>

      {result.error ? (
        <p className="mt-4 font-mono text-sm text-signal-red">Error: {result.error}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="label mb-1">Valores finais (helm get values --all)</div>
            <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs text-signal-green">{YAML.stringify(toPlain(result.final))}</pre>
          </div>
          <div className="overflow-x-auto">
            <div className="label mb-1">Cada chave, como o template vê</div>
            <table className="w-full min-w-[420px] font-mono text-xs">
              <thead><tr className="text-left text-tactical-label"><th className="px-2 py-1">chave</th><th className="px-2 py-1">{'{{ . }}'}</th><th className="px-2 py-1">tipo Go</th><th className="px-2 py-1">origem</th></tr></thead>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-t border-tactical-border">
                    <td className="px-2 py-1">{k}</td>
                    <td className={`px-2 py-1 ${typeof v === 'number' && /e\+/.test(goPrint(v)) ? 'text-signal-red' : ''}`}>{goPrint(v)}</td>
                    <td className="px-2 py-1"><Badge tone={goType(v) === 'float64' ? 'amber' : goType(v) === 'string' ? 'green' : 'cyan'}>{goType(v)}</Badge></td>
                    <td className="px-2 py-1 text-tactical-dim">{result.origin.get(k) ?? result.origin.get(k.split('.').slice(0, -1).join('.')) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-tactical-label">
        Regras: mapas se mesclam chave a chave; listas e escalares são substituídos inteiros; null apaga a chave herdada. Números de arquivos YAML viram
        float64 (20240501 aparece como 2.0240501e+07 e 1.10 como 1.1); --set cria int64 para inteiros; --set-string sempre cria string.
      </p>
    </SimFrame>
  );
}
