import { describe, expect, it } from 'vitest';
import { apply, type Action, type ReleaseState } from '../components/simulators/HelmReleaseSim';
import { lint } from '../components/simulators/HelmLintSim';
import { computeValues } from '../components/simulators/HelmValuesSim';
import { PRESETS, HELPERS } from '../components/simulators/HelmTemplateSim';
import { names, nameProblems } from '../components/simulators/HelmHelpersSim';
import { DEPENDENCIES, isEnabled, subchartValues } from '../components/simulators/HelmDependenciesSim';
import { run, type Hook, type HookState } from '../components/simulators/HelmHooksSim';
import { threeWay, twoWay } from '../components/simulators/HelmUpgradeSim';
import { renderChart, parseValuesYaml } from '../components/simulators/helm/engine';
import { resolve } from '../components/simulators/helm/semver';
import { sha256 } from '../components/simulators/helm/sha256';
import { formatGoFloat, goPrint, GoInt, parseSet, typedVal } from '../components/simulators/helm/values';
import { helmModule } from '../content/helmModule';

const steps = (s: ReleaseState, ...actions: Action[]) => actions.reduce((st, a) => apply(st, a).state, s);
const empty: ReleaseState = { name: 'loja', revisions: [], historyMax: 10 };
const render = (template: string, values: string) =>
  renderChart([{ name: 'c/templates/_helpers.tpl', src: HELPERS }, { name: 'c/templates/t.yaml', src: template }], {
    Values: parseValuesYaml(values),
    Release: { Name: 'loja', Service: 'Helm' },
    Chart: { Name: 'loja', Version: '1.4.0', AppVersion: '2.3.1' },
  });

describe('módulo Helm', () => {
  it('9 lições, cada uma com simulador próprio e quiz de 10 perguntas', () => {
    expect(helmModule.lessons).toHaveLength(9);
    expect(new Set(helmModule.lessons.map((l) => l.simulator)).size).toBe(9);
    for (const l of helmModule.lessons) {
      expect(l.quiz, l.slug).toHaveLength(10);
      expect(l.content.length, l.slug).toBeGreaterThan(2500);
    }
  });
});

describe('ciclo de vida da release', () => {
  it('upgrade com sucesso marca a anterior como superseded e rollback cria revisão nova', () => {
    const s = steps(empty, { type: 'install', chart: 'loja-1.0.0' }, { type: 'upgrade', chart: 'loja-1.1.0' }, { type: 'rollback', to: 1 });
    expect(s.revisions.map((r) => [r.rev, r.status])).toEqual([[1, 'superseded'], [2, 'superseded'], [3, 'deployed']]);
    expect(s.revisions[2]).toMatchObject({ chart: 'loja-1.0.0', description: 'Rollback to 1' });
  });

  it('upgrade com falha mantém a anterior deployed; com --atomic faz rollback', () => {
    const base = steps(empty, { type: 'install', chart: 'loja-1.0.0' });
    expect(steps(base, { type: 'upgrade', chart: 'loja-1.1.0', fail: true }).revisions.map((r) => r.status)).toEqual(['deployed', 'failed']);
    expect(steps(base, { type: 'upgrade', chart: 'loja-1.1.0', fail: true, atomic: true }).revisions.map((r) => r.status)).toEqual(['superseded', 'failed', 'deployed']);
  });

  it('operação interrompida trava novos upgrades até o rollback', () => {
    const stuck = steps(empty, { type: 'install', chart: 'loja-1.0.0' }, { type: 'upgrade', chart: 'loja-1.1.0', interrupt: true });
    expect(apply(stuck, { type: 'upgrade', chart: 'loja-1.2.0' }).error).toMatch(/another operation/);
    const fixed = apply(stuck, { type: 'rollback' }).state;
    expect(apply(fixed, { type: 'upgrade', chart: 'loja-1.2.0' }).error).toBeUndefined();
  });

  it('nomes em uso e --keep-history', () => {
    const inst = steps(empty, { type: 'install', chart: 'loja-1.0.0' });
    expect(apply(inst, { type: 'install', chart: 'loja-1.0.0' }).error).toMatch(/still in use/);
    const kept = steps(inst, { type: 'uninstall', keepHistory: true });
    expect(kept.revisions[0].status).toBe('uninstalled');
    expect(steps(inst, { type: 'uninstall' }).revisions).toHaveLength(0);
    expect(apply(empty, { type: 'upgrade', chart: 'x' }).error).toMatch(/has no deployed releases/);
    expect(apply(empty, { type: 'upgrade', chart: 'loja-1.0.0', install: true }).state.revisions).toHaveLength(1);
  });
});

describe('lint', () => {
  it('erros falham o lint e INFO não', () => {
    expect(lint(new Set(['no-icon'])).failed).toBe(false);
    expect(lint(new Set(['no-version', 'bad-semver'])).messages).toHaveLength(1);
    expect(lint(new Set(['indent'])).failed).toBe(true);
  });
});

describe('values', () => {
  it('tipos do --set e formatação de floats do Go', () => {
    expect(typedVal('20240501', false)).toBeInstanceOf(GoInt);
    expect(typedVal('0123', false)).toBe('0123');
    expect(typedVal('20240501', true)).toBe('20240501');
    expect(formatGoFloat(20240501)).toBe('2.0240501e+07');
    expect(formatGoFloat(1.1)).toBe('1.1');
    expect(formatGoFloat(123456)).toBe('123456');
    expect(formatGoFloat(1000000)).toBe('1e+06');
    expect(parseSet('a.b[0].c=x,l={1,2}')).toHaveLength(2);
  });

  it('listas substituídas, null remove e precedência', () => {
    const lists = computeValues('env: [{name: A}, {name: B}]\n', ['env: [{name: C}]\n'], '', '').final as any;
    expect(lists.env).toEqual([{ name: 'C' }]);
    const nulls = computeValues('a: {x: 1, y: 2}\nb: 1\n', ['a: {y: null}\n'], 'b=null', '').final as any;
    expect(nulls).toEqual({ a: { x: 1 } });
    const prec = computeValues('tag: "1"\nr: 1\n', ['r: 3\n'], 'tag=2', 'tag=03').final as any;
    expect(prec.tag).toBe('03');
    expect(prec.r).toBe(3);
  });
});

describe('motor de templates', () => {
  it('renderiza o Deployment completo como YAML válido', () => {
    const r = render(PRESETS.deployment.template, PRESETS.deployment.values);
    expect(r.error).toBeUndefined();
    expect(r.outputs[0].yamlError).toBeUndefined();
    expect(r.outputs[0].text).toContain('name: loja');
    expect(r.outputs[0].text).toContain('image: "registry.exemplo.com/loja/api:2.3.1"');
    expect(r.outputs[0].text).toContain('value: "info"');
  });

  it('indent na mesma linha gera YAML inválido', () => {
    expect(render(PRESETS.indent.template, PRESETS.indent.values).outputs[0].yamlError).toBeTruthy();
  });

  it('required, escopo sem $ e números', () => {
    expect(render(PRESETS.required.template, PRESETS.required.values).error).toMatch(/execution error.*database\.host é obrigatório/);
    expect(render(PRESETS.required.template, 'database:\n  host: db\n').error).toBeUndefined();
    expect(render(PRESETS.scope.template, PRESETS.scope.values).error).toMatch(/nil pointer evaluating interface \{\}\.Name/);
    expect(render(PRESETS.scope.template.replace('.Release.Name', '$.Release.Name'), PRESETS.scope.values).outputs[0].text).toContain('release: loja');
    const nums = render(PRESETS.numbers.template, PRESETS.numbers.values).outputs[0].text;
    expect(nums).toContain('porta-d: "%!d(float64=8080)"');
    expect(nums).toContain('porta-int: "8080"');
    expect(nums).toContain('build: "2.0240501e+07"');
    expect(nums).toContain('versao: "1.1"');
  });

  it('controle de espaços e valores ausentes', () => {
    const ws = render(PRESETS.whitespace.template, PRESETS.whitespace.values).outputs[0].text;
    expect(ws).toContain('enxuta: |\n    - cache\n    - busca');
    expect(render('a: "{{ .Values.nada }}"', '').outputs[0].text).toBe('a: ""');
    expect(goPrint({ b: 1, a: [1, 2] } as any)).toBe('map[a:[1 2] b:1]');
  });

  it('sha256 bate com o valor de referência', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('helpers', () => {
  const base = { release: 'loja', chart: 'pagamentos-api', version: '1.0.0', nameOverride: '', fullnameOverride: '', truncate: true };
  it('fullname padrão, release contendo o chart e overrides', () => {
    expect(names(base).fullname).toBe('loja-pagamentos-api');
    expect(names({ ...base, release: 'pagamentos-api' }).fullname).toBe('pagamentos-api');
    expect(names({ ...base, fullnameOverride: 'api' }).fullname).toBe('api');
    expect(names({ ...base, nameOverride: 'pay' }).fullname).toBe('loja-pay');
  });

  it('trunc 63 evita nomes inválidos', () => {
    const long = { ...base, release: 'r'.repeat(60) + '-x' };
    expect(names(long).fullname.length).toBeLessThanOrEqual(63);
    expect(nameProblems(names(long).fullname)).toEqual([]);
    expect(nameProblems(names({ ...long, truncate: false }).fullname)[0]).toMatch(/máximo 63/);
  });
});

describe('dependências', () => {
  const [pg, redis, api, worker] = DEPENDENCIES;
  it('condition vence tags; tags habilitam se alguma for true', () => {
    expect(isEnabled(pg, { postgresql: { enabled: false } }).enabled).toBe(false);
    expect(isEnabled(pg, {}).enabled).toBe(true);
    expect(isEnabled(redis, { tags: { cache: false } }).enabled).toBe(false);
    expect(isEnabled(redis, { tags: { cache: true } }).enabled).toBe(true);
    expect(isEnabled(worker, { worker: { enabled: false } }).enabled).toBe(false);
  });

  it('subchart vê só a própria seção (por alias) e o global', () => {
    const v = subchartValues(api, { global: { r: 'x' }, api: { replicaCount: 3 }, worker: { role: 'worker' } }) as any;
    expect(v).toMatchObject({ replicaCount: 3, role: 'web', global: { r: 'x' } });
    expect(v.worker).toBeUndefined();
  });
});

describe('hooks', () => {
  const hooks = (policies: Hook['policies']): Hook[] => [
    { name: 'migrate', kind: 'Job', events: ['pre-install', 'pre-upgrade'], weight: -5, policies },
    { name: 'notify', kind: 'Job', events: ['post-upgrade'], weight: 5, policies: ['before-hook-creation', 'hook-succeeded'] },
  ];
  const s0: HookState = { installed: false, leftovers: [] };

  it('com só hook-succeeded, o Job falho bloqueia a próxima execução', () => {
    const h = hooks(['hook-succeeded']);
    const installed = run(h, s0, 'install', new Set()).state;
    const failed = run(h, installed, 'upgrade', new Set(['migrate']));
    expect(failed.status).toBe('failed');
    expect(failed.state.leftovers).toContain('job/migrate');
    const again = run(h, failed.state, 'upgrade', new Set());
    expect(again.steps.some((s) => /already exists/.test(s.text))).toBe(true);
  });

  it('before-hook-creation limpa a sobra e o fluxo segue', () => {
    const h = hooks(['before-hook-creation']);
    const failed = run(h, run(h, s0, 'install', new Set()).state, 'upgrade', new Set(['migrate']));
    const again = run(h, failed.state, 'upgrade', new Set());
    expect(again.status).toBe('deployed');
  });

  it('pre-hook falho impede a aplicação dos recursos', () => {
    const r = run(hooks(['before-hook-creation']), s0, 'install', new Set(['migrate']));
    expect(r.steps.some((s) => /Recursos do chart aplicados/.test(s.text))).toBe(false);
  });
});

describe('SemVer', () => {
  const vs = ['14.3.3', '15.5.0', '15.5.38', '16.0.0', '16.0.6', '16.1.0-rc.1', '16.1.0', '16.1.2', '17.0.0-beta.2'];
  it.each([
    ['~16.0.0', '16.0.6'],
    ['^16.0.0', '16.1.2'],
    ['16.x', '16.1.2'],
    ['16.0', '16.0.6'],
    ['>=15.5.0 <16.0.0', '15.5.38'],
    ['15.5 - 16.0', '16.0.6'],
    ['*', '16.1.2'],
    ['^15.0.0 || ^17.0.0-0', '17.0.0-beta.2'],
    ['>=16.1.0-0 <16.1.1', '16.1.0'],
    ['^0.4.0', null],
  ])('%s → %s', (c, expected) => {
    expect(resolve(vs, c).chosen?.raw ?? null).toBe(expected);
  });

  it('prerelease só entra com restrição que tenha prerelease', () => {
    expect(resolve(['16.1.0-rc.1'], '^16.0.0').chosen).toBeNull();
    expect(resolve(['16.1.0-rc.1'], '>=16.1.0-0').chosen?.raw).toBe('16.1.0-rc.1');
  });
});

describe('three-way merge', () => {
  it('impõe o chart, remove o que saiu e preserva o que é só do live', () => {
    const old = { replicas: '2', image: 'a:1', env: 'x' };
    const live = { replicas: '8', image: 'a:1', env: 'x', sidecar: 'istio' };
    const next = { replicas: '2', image: 'a:2' };
    expect(threeWay(old, live, next)).toEqual({ replicas: '2', image: 'a:2', sidecar: 'istio' });
    expect(twoWay(old, live, next)).toEqual({ replicas: '8', image: 'a:2', sidecar: 'istio' });
  });
});
