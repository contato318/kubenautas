import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Laboratório de helm lint: estrutura de um chart e as mensagens reais para erros clássicos. */

export interface LintIssue {
  id: string;
  file: string;
  label: string;
  level: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

export const ISSUES: LintIssue[] = [
  { id: 'no-version', file: 'Chart.yaml', label: 'Chart.yaml sem o campo version', level: 'ERROR', message: '[ERROR] Chart.yaml: version is required' },
  { id: 'bad-semver', file: 'Chart.yaml', label: 'version: "1.0" (não é SemVer completo)', level: 'ERROR', message: '[ERROR] Chart.yaml: version \'1.0\' is not a valid SemVerV2' },
  { id: 'no-icon', file: 'Chart.yaml', label: 'Sem o campo icon', level: 'INFO', message: '[INFO] Chart.yaml: icon is recommended' },
  { id: 'bad-values', file: 'values.yaml', label: 'values.yaml com indentação quebrada', level: 'ERROR', message: '[ERROR] values.yaml: unable to parse YAML: error converting YAML to JSON: yaml: line 4: did not find expected key' },
  { id: 'schema', file: 'values.schema.json', label: 'replicaCount: "3" viola o values.schema.json', level: 'ERROR', message: '[ERROR] values.yaml: - replicaCount: Invalid type. Expected: integer, given: string' },
  { id: 'required', file: 'templates/deployment.yaml', label: 'Template usa required sem valor padrão', level: 'ERROR', message: '[ERROR] templates/: template: loja/templates/deployment.yaml:18:20: executing "loja/templates/deployment.yaml" at <required "image.tag é obrigatório" .Values.image.tag>: error calling required: image.tag é obrigatório' },
  { id: 'indent', file: 'templates/deployment.yaml', label: 'toYaml com indent errado', level: 'ERROR', message: '[ERROR] templates/deployment.yaml: unable to parse YAML: error converting YAML to JSON: yaml: line 22: mapping values are not allowed in this context' },
  { id: 'name', file: 'templates/service.yaml', label: 'metadata.name com maiúsculas e _', level: 'ERROR', message: '[ERROR] templates/service.yaml: object name does not conform to Kubernetes naming requirements: "Loja_Service": metadata.name: Invalid value: "Loja_Service": a lowercase RFC 1123 label must consist of lower case alphanumeric characters or \'-\'' },
  { id: 'deprecated', file: 'templates/ingress.yaml', label: 'Ingress em networking.k8s.io/v1beta1', level: 'WARNING', message: '[WARNING] templates/ingress.yaml: networking.k8s.io/v1beta1 Ingress is deprecated in v1.19+, unavailable in v1.22+; use networking.k8s.io/v1 Ingress' },
];

export function lint(active: Set<string>) {
  const found = ISSUES.filter((i) => active.has(i.id));
  // version ausente e version inválida são mutuamente exclusivas: prevalece a ausência
  const messages = found.filter((i) => !(i.id === 'bad-semver' && active.has('no-version')));
  const failed = messages.some((m) => m.level === 'ERROR');
  return { messages, failed, summary: `1 chart(s) linted, ${failed ? 1 : 0} chart(s) failed` };
}

const TREE: { path: string; desc: string }[] = [
  { path: 'loja/', desc: 'Diretório do chart (o nome costuma ser igual ao name do Chart.yaml).' },
  { path: '  Chart.yaml', desc: 'Metadados: apiVersion v2, name, version (SemVer do chart), appVersion (versão da aplicação), type e dependencies.' },
  { path: '  Chart.lock', desc: 'Versões exatas das dependências resolvidas por helm dependency update.' },
  { path: '  values.yaml', desc: 'Valores padrão, sobrescritos por -f e --set.' },
  { path: '  values.schema.json', desc: 'JSON Schema opcional: valida os values em install, upgrade, lint e template.' },
  { path: '  charts/', desc: 'Dependências empacotadas (.tgz) ou subcharts.' },
  { path: '  crds/', desc: 'CRDs instaladas antes de tudo — e nunca atualizadas nem removidas pelo Helm.' },
  { path: '  templates/', desc: 'Manifestos com Go templates.' },
  { path: '    _helpers.tpl', desc: 'Templates nomeados (define). Arquivos com _ não geram manifestos.' },
  { path: '    deployment.yaml', desc: 'Um manifesto renderizado por arquivo (ou vários, separados por ---).' },
  { path: '    NOTES.txt', desc: 'Texto exibido após install/upgrade — também é template.' },
  { path: '    tests/', desc: 'Pods anotados com helm.sh/hook: test, executados por helm test.' },
  { path: '  .helmignore', desc: 'Padrões ignorados ao empacotar (como .gitignore).' },
];

export default function HelmLintSim() {
  const [active, setActive] = useState<Set<string>>(new Set(['no-icon']));
  const [selected, setSelected] = useState(TREE[1]);
  const result = lint(active);
  const toggle = (id: string, v: boolean) => setActive((s) => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; });

  return (
    <SimFrame title="helm lint ./loja">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div>
          <div className="label mb-2">Estrutura do chart</div>
          <div className="rounded-md border border-tactical-border bg-black/40 p-2 font-mono text-xs">
            {TREE.map((t) => (
              <button key={t.path} onClick={() => setSelected(t)} className={`block w-full whitespace-pre rounded px-2 py-0.5 text-left ${selected.path === t.path ? 'bg-k8s-500/20 text-white' : 'text-tactical-dim hover:bg-tactical-raised'}`}>
                {t.path}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-tactical-dim"><strong className="font-mono text-k8s-400">{selected.path.trim()}</strong> — {selected.desc}</p>
        </div>
        <div>
          <div className="label mb-2">Introduza problemas no chart</div>
          <div className="grid gap-2 md:grid-cols-2">
            {ISSUES.map((i) => (
              <Toggle key={i.id} checked={active.has(i.id)} onChange={(v) => toggle(i.id, v)}>
                <span className="font-mono text-[11px] text-k8s-400">{i.file}</span>
                <span className="block text-xs text-tactical-dim">{i.label}</span>
              </Toggle>
            ))}
          </div>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5">
            <span className="text-tactical-label">$ helm lint ./loja{'\n'}==&gt; Linting ./loja{'\n'}</span>
            {result.messages.map((m) => (
              <span key={m.id} className={m.level === 'ERROR' ? 'text-signal-red' : m.level === 'WARNING' ? 'text-signal-amber' : 'text-signal-cyan'}>{m.message}{'\n'}</span>
            ))}
            {'\n'}
            <span className={result.failed ? 'text-signal-red' : 'text-signal-green'}>{result.summary}</span>
            {result.failed && <span className="text-signal-red">{'\n'}Error: 1 chart(s) linted, 1 chart(s) failed</span>}
          </pre>
          <div className="mt-2 flex gap-2"><Badge tone={result.failed ? 'red' : 'green'}>{result.failed ? 'exit code 1 — o CI falha' : 'exit code 0'}</Badge></div>
          <p className="mt-3 text-xs text-tactical-label">
            helm lint renderiza os templates com os values padrão (e os que você passar com -f/--set), valida o YAML resultante, o schema e as regras de
            nomes. Rode no CI com os values de cada ambiente: um erro que só aparece com values-prod.yaml passa despercebido no lint padrão.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
