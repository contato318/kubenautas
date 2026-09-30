import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/** Monta um CRD a partir de grupo/nomes/escopo e mostra o YAML, os caminhos da API e como o kubectl o enxerga. */

export interface CrdInput {
  group: string;
  version: string;
  kind: string;
  plural: string;
  singular: string;
  shortName: string;
  scope: 'Namespaced' | 'Cluster';
}

export interface CrdResult {
  name: string;
  errors: string[];
  warnings: string[];
  yaml: string;
  paths: string[];
  kubectl: string[];
}

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function buildCrd(i: CrdInput): CrdResult {
  const name = `${i.plural}.${i.group}`;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!i.group.includes('.')) errors.push(`spec.group: Invalid value: "${i.group}": should be a domain with at least one dot`);
  if (!DNS_LABEL.test(i.plural)) errors.push(`spec.names.plural: Invalid value: "${i.plural}": a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-'`);
  if (!DNS_LABEL.test(i.singular)) errors.push(`spec.names.singular: Invalid value: "${i.singular}": a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-'`);
  if (i.shortName && !DNS_LABEL.test(i.shortName)) errors.push(`spec.names.shortNames[0]: Invalid value: "${i.shortName}": a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-'`);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(i.kind)) errors.push(`spec.names.kind: Invalid value: "${i.kind}": use CamelCase começando com maiúscula (ex.: Database)`);
  if (!DNS_LABEL.test(i.version)) errors.push(`spec.versions[0].name: Invalid value: "${i.version}": a DNS-1035 label must consist of lower case alphanumeric characters or '-'`);
  else if (!/^v\d+((alpha|beta)\d+)?$/.test(i.version)) warnings.push(`"${i.version}" não segue o padrão vN / vNalphaN / vNbetaN: será ordenada depois das versões padrão pelo kubectl`);
  if (i.group.endsWith('.k8s.io') || i.group.endsWith('.kubernetes.io')) errors.push(`metadata.annotations[api-approved.kubernetes.io]: Required value: protected groups must have approval annotation`);
  if (i.plural && i.plural === i.singular) warnings.push('plural igual ao singular: funciona, mas confunde (kubectl get database × databases)');

  const base = `/apis/${i.group}/${i.version}`;
  const paths =
    i.scope === 'Namespaced'
      ? [`${base}/namespaces/{namespace}/${i.plural}`, `${base}/namespaces/{namespace}/${i.plural}/{nome}`, `${base}/${i.plural}   (lista em todos os namespaces)`]
      : [`${base}/${i.plural}`, `${base}/${i.plural}/{nome}`];

  const kubectl = [`kubectl get ${i.plural}`, `kubectl get ${i.singular}`, ...(i.shortName ? [`kubectl get ${i.shortName}`] : []), `kubectl get ${name}   (nome totalmente qualificado)`, `kubectl explain ${i.plural}.spec`];

  const yaml = `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: ${name}          # sempre <plural>.<group>
spec:
  group: ${i.group}
  scope: ${i.scope}
  names:
    kind: ${i.kind}
    listKind: ${i.kind}List
    plural: ${i.plural}
    singular: ${i.singular}${i.shortName ? `\n    shortNames: [${i.shortName}]` : ''}
    categories: [all-dbs]
  versions:
    - name: ${i.version}
      served: true
      storage: true
      subresources:
        status: {}
      additionalPrinterColumns:
        - { name: Engine, type: string, jsonPath: .spec.engine }
        - { name: Ready, type: string, jsonPath: '.status.conditions[?(@.type=="Ready")].status' }
        - { name: Age, type: date, jsonPath: .metadata.creationTimestamp }
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine: { type: string, enum: [postgres, mysql] }
            status:
              type: object
              x-kubernetes-preserve-unknown-fields: true`;

  return { name, errors, warnings, yaml, paths, kubectl };
}

const PRESETS: Record<string, CrdInput> = {
  valido: { group: 'db.exemplo.com', version: 'v1', kind: 'Database', plural: 'databases', singular: 'database', shortName: 'db', scope: 'Namespaced' },
  semPonto: { group: 'databases', version: 'v1', kind: 'Database', plural: 'databases', singular: 'database', shortName: 'db', scope: 'Namespaced' },
  maiusculo: { group: 'db.exemplo.com', version: 'v1', kind: 'database', plural: 'Databases', singular: 'database', shortName: 'db', scope: 'Namespaced' },
  cluster: { group: 'infra.exemplo.com', version: 'v1beta1', kind: 'StoragePool', plural: 'storagepools', singular: 'storagepool', shortName: 'sp', scope: 'Cluster' },
  protegido: { group: 'policy.k8s.io', version: 'v1', kind: 'Rule', plural: 'rules', singular: 'rule', shortName: '', scope: 'Namespaced' },
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="flex flex-col gap-1">
    <span className="label">{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-tactical-border bg-tactical-bg px-2 py-1.5 font-mono text-sm text-tactical-text" />
  </label>
);

export default function OpCrdBuilderSim() {
  const [i, setI] = useState<CrdInput>(PRESETS.valido);
  const r = buildCrd(i);
  const set = (p: Partial<CrdInput>) => setI((x) => ({ ...x, ...p }));

  return (
    <SimFrame title={`kubectl apply -f crd.yaml · ${r.name}`} toolbar={<Badge tone={r.errors.length ? 'red' : 'green'}>{r.errors.length ? 'rejeitado' : 'Established'}</Badge>}>
      <div className="mb-3 flex flex-wrap gap-2">
        {[['valido', 'Válido (Database)'], ['semPonto', 'Grupo sem ponto'], ['maiusculo', 'Plural maiúsculo'], ['cluster', 'Cluster-scoped'], ['protegido', 'Grupo *.k8s.io']].map(([k, l]) => (
          <button key={k} className="btn-ghost px-2 py-1 text-xs" onClick={() => setI(PRESETS[k])}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <Field label="spec.group" value={i.group} onChange={(v) => set({ group: v })} />
          <Field label="versions[0].name" value={i.version} onChange={(v) => set({ version: v })} />
          <Field label="names.kind" value={i.kind} onChange={(v) => set({ kind: v })} />
          <Field label="names.plural" value={i.plural} onChange={(v) => set({ plural: v })} />
          <Field label="names.singular" value={i.singular} onChange={(v) => set({ singular: v })} />
          <Field label="names.shortNames[0]" value={i.shortName} onChange={(v) => set({ shortName: v })} />
          <Choice label="scope" value={i.scope} onChange={(v) => set({ scope: v })} options={[{ value: 'Namespaced', label: 'Namespaced' }, { value: 'Cluster', label: 'Cluster' }]} />
        </div>
        <div className="min-w-0">
          {r.errors.length > 0 && (
            <pre className="mb-3 whitespace-pre-wrap rounded-md border border-signal-red/60 bg-signal-red/10 p-3 font-mono text-[11px] text-signal-red">
              {`The CustomResourceDefinition "${r.name}" is invalid:\n` + r.errors.map((e) => `* ${e}`).join('\n')}
            </pre>
          )}
          {r.warnings.map((w) => <div key={w} className="mb-2 rounded border border-signal-amber/60 bg-signal-amber/10 px-3 py-1.5 text-xs text-signal-amber">⚠ {w}</div>)}
          {!r.errors.length && (
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="label mb-1">Endpoints REST criados</div>
                <ul className="space-y-1 break-all font-mono text-[11px] text-signal-cyan">{r.paths.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
              <div>
                <div className="label mb-1">Como o kubectl encontra</div>
                <ul className="space-y-1 font-mono text-[11px] text-tactical-dim">{r.kubectl.map((p) => <li key={p}>$ {p}</li>)}</ul>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <pre className="rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{r.yaml}</pre>
          </div>
        </div>
      </div>
    </SimFrame>
  );
}
