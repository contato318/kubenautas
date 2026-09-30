import { useMemo, useState } from 'react';
import { Badge, SimFrame } from './kit';
import { parseValuesYaml, renderChart } from './helm/engine';

/** helm template no navegador: edite template e values e veja o manifesto (ou o erro) resultante. */

export const HELPERS = `{{- define "loja.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "loja.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}`;

const VALUES = `replicaCount: 2
image:
  repository: registry.exemplo.com/loja/api
  tag: ""
env:
  LOG_LEVEL: info
  FEATURE_X: "true"
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 256Mi
`;

export const PRESETS: Record<string, { label: string; template: string; values: string; hint: string }> = {
  deployment: {
    label: 'Deployment completo',
    values: VALUES,
    hint: 'include + nindent, default para a tag, with + range em mapa e toYaml para blocos.',
    template: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "loja.fullname" . }}
  labels:
    {{- include "loja.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Chart.Name }}
        app.kubernetes.io/instance: {{ .Release.Name }}
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          {{- with .Values.env }}
          env:
            {{- range $key, $value := . }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`,
  },
  indent: {
    label: 'indent × nindent',
    values: VALUES,
    hint: 'toYaml na mesma linha com indent gera YAML inválido. Troque por "resources:" + {{- toYaml .Values.resources | nindent 12 }}.',
    template: `apiVersion: v1
kind: Pod
metadata:
  name: exemplo
spec:
  containers:
    - name: api
      image: nginx
      resources: {{ toYaml .Values.resources | indent 8 }}
`,
  },
  whitespace: {
    label: 'Espaços: {{ }} × {{- }}',
    values: 'features:\n  - cache\n  - busca\n',
    hint: 'Sem o hífen, cada {{ range }} e {{ end }} deixa uma linha em branco. Compare a saída trocando {{ por {{-.',
    template: `apiVersion: v1
kind: ConfigMap
metadata:
  name: features
data:
  lista: |
    {{ range .Values.features }}
    - {{ . }}
    {{ end }}
  enxuta: |
    {{- range .Values.features }}
    - {{ . }}
    {{- end }}
`,
  },
  required: {
    label: 'required e fail',
    values: 'database:\n  host: ""\n',
    hint: 'required interrompe o render com uma mensagem clara. Preencha database.host nos values.',
    template: `apiVersion: v1
kind: Secret
metadata:
  name: db
stringData:
  host: {{ required "database.host é obrigatório (defina em values-<ambiente>.yaml)" .Values.database.host }}
  {{- if and .Values.database.port (lt (int .Values.database.port) 1024) }}
  {{- fail "database.port deve ser >= 1024" }}
  {{- end }}
`,
  },
  scope: {
    label: 'Escopo: with e $',
    values: VALUES,
    hint: 'Dentro de with, o ponto vira .Values.image; .Release não existe ali. Use $.Release.Name para voltar à raiz.',
    template: `apiVersion: v1
kind: ConfigMap
metadata:
  name: imagem
data:
  {{- with .Values.image }}
  repositorio: {{ .repository }}
  release: {{ .Release.Name }}
  {{- end }}
`,
  },
  numbers: {
    label: 'Números: float64 e printf',
    values: 'port: 8080\nbuild: 20240501\nversao: 1.10\n',
    hint: 'Números de values viram float64: grandes saem em notação científica, 1.10 vira 1.1 e printf "%d" falha. Use aspas no values ou int/quote no template.',
    template: `apiVersion: v1
kind: ConfigMap
metadata:
  name: numeros
data:
  porta: {{ .Values.port | quote }}
  porta-d: {{ printf "%d" .Values.port | quote }}
  porta-int: {{ printf "%d" (int .Values.port) | quote }}
  build: {{ .Values.build | quote }}
  versao: {{ .Values.versao | quote }}
`,
  },
};

export default function HelmTemplateSim() {
  const [key, setKey] = useState('deployment');
  const [template, setTemplate] = useState(PRESETS.deployment.template);
  const [values, setValues] = useState(PRESETS.deployment.values);
  const [release, setRelease] = useState('loja');

  const load = (k: string) => {
    setKey(k);
    setTemplate(PRESETS[k].template);
    setValues(PRESETS[k].values);
  };

  const result = useMemo(() => {
    let parsed;
    try {
      parsed = parseValuesYaml(values);
    } catch (e) {
      return { error: `Error: failed to parse values.yaml: ${(e as Error).message.split('\n')[0]}`, outputs: [] };
    }
    return renderChart(
      [
        { name: 'loja/templates/_helpers.tpl', src: HELPERS },
        { name: 'loja/templates/manifest.yaml', src: template },
      ],
      { Values: parsed, Release: { Name: release, Namespace: 'default', Service: 'Helm', IsInstall: true }, Chart: { Name: 'loja', Version: '1.4.0', AppVersion: '2.3.1' } },
    );
  }, [template, values, release]);

  const out = result.outputs[0];
  const ta = 'w-full rounded-md border border-tactical-border bg-black/60 p-2 font-mono text-xs leading-5 text-tactical-text';

  return (
    <SimFrame title={`helm template ${release} ./loja`}>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} className={`btn-ghost px-2 py-1 ${key === k ? 'border-k8s-500 text-white' : ''}`} onClick={() => load(k)}>{p.label}</button>
        ))}
      </div>
      <p className="mb-3 text-sm text-tactical-dim">{PRESETS[key].hint}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <label className="flex flex-col gap-1"><span className="label">templates/manifest.yaml (editável)</span><textarea spellCheck={false} className={`${ta} h-80`} value={template} onChange={(e) => setTemplate(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="label">values.yaml (editável)</span><textarea spellCheck={false} className={`${ta} h-40`} value={values} onChange={(e) => setValues(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><span className="label">Release.Name</span><input className="rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" value={release} onChange={(e) => setRelease(e.target.value)} /></label>
          <details className="text-xs text-tactical-dim"><summary className="cursor-pointer text-tactical-label">_helpers.tpl disponível</summary><pre className="mt-2 overflow-x-auto rounded border border-tactical-border bg-black/40 p-2 font-mono">{HELPERS}</pre></details>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="label">Saída</span>
            {result.error ? <Badge tone="red">erro de template</Badge> : out?.yamlError ? <Badge tone="red">YAML inválido</Badge> : <Badge tone="green">ok</Badge>}
          </div>
          {result.error ? (
            <pre className="whitespace-pre-wrap rounded-md border border-signal-red/50 bg-signal-red/5 p-3 font-mono text-xs text-signal-red">{result.error}</pre>
          ) : (
            <>
              <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs leading-5 text-signal-green">{`---\n# Source: ${out.name}\n${out.text}`}</pre>
              {out.yamlError && <p className="mt-2 font-mono text-xs text-signal-red">Error: {out.yamlError}</p>}
            </>
          )}
          <p className="mt-3 text-xs text-tactical-label">
            Motor didático com as funções mais usadas (default, required, quote, toYaml, nindent, include, tpl, printf, range, with…). Como o Helm, valores
            ausentes viram vazio e números de values são float64.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
