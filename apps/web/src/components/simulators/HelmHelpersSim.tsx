import { useMemo, useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';
import { renderChart } from './helm/engine';
import { sha256 } from './helm/sha256';
import { HELPERS } from './HelmTemplateSim';

/** Nomes, labels e checksum: o que os helpers padrão do "helm create" produzem. */

const NO_TRUNC = HELPERS.replaceAll(' | trunc 63 | trimSuffix "-"', '');
export const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function names(opts: { release: string; chart: string; version: string; nameOverride: string; fullnameOverride: string; truncate: boolean }) {
  const tpl = `{{ include "loja.fullname" . }}\n---\n{{ include "loja.labels" . }}`;
  const r = renderChart(
    [
      { name: 'x/templates/_helpers.tpl', src: opts.truncate ? HELPERS : NO_TRUNC },
      { name: 'x/templates/names', src: tpl },
    ],
    {
      Values: { nameOverride: opts.nameOverride, fullnameOverride: opts.fullnameOverride },
      Release: { Name: opts.release, Service: 'Helm' },
      Chart: { Name: opts.chart, Version: opts.version },
    },
  );
  if (r.error) return { fullname: '', labels: '', error: r.error };
  const [fullname, labels] = r.outputs[0].text.split('\n---\n');
  return { fullname, labels, error: '' };
}

export function nameProblems(name: string): string[] {
  const p: string[] = [];
  if (name.length > 63) p.push(`tem ${name.length} caracteres (máximo 63)`);
  if (!DNS_LABEL.test(name)) p.push('não é um DNS label válido (minúsculas, números e "-", começando e terminando com alfanumérico)');
  return p;
}

export default function HelmHelpersSim() {
  const [release, setRelease] = useState('loja-producao');
  const [chart, setChart] = useState('pagamentos-api');
  const [version, setVersion] = useState('1.4.0');
  const [nameOverride, setNameOverride] = useState('');
  const [fullnameOverride, setFullnameOverride] = useState('');
  const [truncate, setTruncate] = useState(true);

  const [config, setConfig] = useState('LOG_LEVEL: info\nTIMEOUT: "30s"\n');
  const [deployed, setDeployed] = useState(() => sha256('LOG_LEVEL: info\nTIMEOUT: "30s"\n'));
  const [useChecksum, setUseChecksum] = useState(true);
  const [msg, setMsg] = useState('');

  const n = useMemo(() => names({ release, chart, version, nameOverride, fullnameOverride, truncate }), [release, chart, version, nameOverride, fullnameOverride, truncate]);
  const problems = n.fullname ? nameProblems(n.fullname) : [];
  const svcName = `${n.fullname}-headless`;
  const checksum = sha256(config);

  const upgrade = () => {
    const changed = checksum !== deployed;
    if (!changed) setMsg('Nada mudou no template do Pod: o Deployment não é atualizado.');
    else if (useChecksum) setMsg('A annotation checksum/config mudou → o template do Pod mudou → rolling update: os Pods novos leem a config nova.');
    else setMsg('O ConfigMap foi atualizado, mas o template do Pod é idêntico: nenhum Pod reinicia e quem lê via env continua com o valor antigo.');
    setDeployed(checksum);
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1"><span className="label">{label}</span><input className="rounded-md border border-tactical-border bg-tactical-bg px-2 py-1.5 font-mono text-xs" value={value} onChange={(e) => set(e.target.value)} /></label>
  );

  return (
    <SimFrame title="templates/_helpers.tpl · loja.fullname e loja.labels">
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('Release.Name', release, setRelease)}
            {field('Chart.Name', chart, setChart)}
            {field('Chart.Version', version, setVersion)}
            {field('nameOverride', nameOverride, setNameOverride)}
            {field('fullnameOverride', fullnameOverride, setFullnameOverride)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-ghost px-2 py-1" onClick={() => { setRelease('loja-producao-regiao-sudeste-cliente-premium-2026'); setChart('pagamentos-api-gateway-interno'); }}>Nome gigante</button>
            <button className="btn-ghost px-2 py-1" onClick={() => { setRelease('pagamentos-api'); setChart('pagamentos-api'); }}>Release contém o chart</button>
            <button className="btn-ghost px-2 py-1" onClick={() => { setRelease('Loja_Prod'); }}>Maiúsculas</button>
          </div>
          <div className="mt-3"><Toggle checked={truncate} onChange={setTruncate}><span className="text-xs">Helper com <code>| trunc 63 | trimSuffix "-"</code> (padrão do helm create)</span></Toggle></div>

          {n.error ? (
            <p className="mt-3 font-mono text-xs text-signal-red">{n.error}</p>
          ) : (
            <div className="mt-4 space-y-2 font-mono text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-tactical-label">fullname:</span><span className="break-all">{n.fullname}</span>
                <Badge tone={problems.length ? 'red' : 'green'}>{n.fullname.length} chars</Badge>
              </div>
              {problems.map((p) => <div key={p} className="text-signal-red">✗ {p}</div>)}
              {problems.length > 0 && <div className="text-signal-red">The Service "{svcName.slice(0, 40)}…" is invalid: metadata.name: Invalid value</div>}
              <pre className="overflow-x-auto rounded border border-tactical-border bg-black/60 p-2 text-signal-green">{n.labels}</pre>
              <p className="text-tactical-dim">Os labels app.kubernetes.io/name e instance formam o selector — que é imutável no Deployment. Trocar nameOverride depois da primeira instalação quebra o upgrade.</p>
            </div>
          )}
        </div>

        <div>
          <div className="label mb-2">Checksum: forçar rollout quando a config muda</div>
          <textarea className="h-28 w-full rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-xs text-signal-green" value={config} onChange={(e) => setConfig(e.target.value)} />
          <div className="mt-2"><Toggle checked={useChecksum} onChange={setUseChecksum}><span className="text-xs">Deployment com a annotation checksum/config</span></Toggle></div>
          <pre className="mt-2 overflow-x-auto rounded border border-tactical-border bg-black/60 p-2 font-mono text-[11px] text-tactical-dim">
            {useChecksum
              ? `template:\n  metadata:\n    annotations:\n      checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}\n      # = ${checksum.slice(0, 32)}…`
              : 'template:\n  metadata:\n    annotations: {}'}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-tactical-label">no cluster:</span>{deployed.slice(0, 16)}… <Badge tone={checksum === deployed ? 'green' : 'amber'}>{checksum === deployed ? 'igual' : 'config mudou'}</Badge>
          </div>
          <button className="btn-primary mt-3" onClick={upgrade}>helm upgrade</button>
          {msg && <p className="mt-2 text-sm text-tactical-dim">{msg}</p>}
        </div>
      </div>
    </SimFrame>
  );
}
