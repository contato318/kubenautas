import { describe, expect, it } from 'vitest';
import { lint } from '../components/simulators/HelmLintSim';
import { computeValues } from '../components/simulators/HelmValuesSim';
import { apply, type ReleaseState } from '../components/simulators/HelmReleaseSim';
import { run, type Hook } from '../components/simulators/HelmHooksSim';
import { renderChart, parseValuesYaml } from '../components/simulators/helm/engine';
import { parseConstraint, parseVersion, satisfies } from '../components/simulators/helm/semver';

// Expected render/merge/constraint results checked against the official Helm v3.17.4 binary.
describe('Helm 3.17 reference behavior', () => {
  const render = (source: string) => renderChart([{ name: 't.txt', src: source }], { Values: {}, Release: { Name: 'ref' }, Chart: { Name: 'reference', Version: '1.0.0' } });
  it.each(['{{ and .Values.missing .Values.missing.child }}', '{{ or true (fail "must not run") }}'])('short-circuits %s', (source) => {
    expect(render(source).error).toBeUndefined();
  });
  it('lint reports invalid object names as warnings by default', () => {
    expect(lint(new Set(['name'])).failed).toBe(false);
    expect(lint(new Set(['bad-semver'])).failed).toBe(true);
  });
  it('indexed --set replaces the chart default list', () => {
    expect(computeValues('env: [{name: A}, {name: B}]', [], 'env[0].name=C', '').final).toEqual({ env: [{ name: 'C' }] });
  });
  it('later null overrides survive user-layer merge until default coalescing', () => {
    expect(computeValues('a: {x: 1, z: 2}\nb: 1', ['a: {x: 5}', 'a: {z: null}'], 'b=null', '').final).toEqual({ a: { x: 5 } });
  });
  it('preserves escaped dots in keys and escaped commas in lists', () => {
    expect(computeValues('{}', [], String.raw`annotations.prometheus\.io/scrape=true,list={a\,b,c}`, '').final).toEqual({ annotations: { 'prometheus.io/scrape': true }, list: ['a,b', 'c'] });
  });
  it('uses YAML 1.1 scalar rules like Helm 3', () => {
    expect(parseValuesYaml('enabled: yes\nname: "yes"')).toEqual({ enabled: true, name: 'yes' });
    expect(computeValues('enabled: off', [], '', '').final).toEqual({ enabled: false });
  });
  it('treats prototype names as ordinary Go map keys without changing JS prototypes', () => {
    const result = computeValues('{}', [], '__proto__.polluted=yes,constructor.marker=ok', '').final;
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object as unknown as Record<string, unknown>).marker).toBeUndefined();
  });
  it.each([['1.1.9', true], ['1.2.7', false], ['1.3.0', true], ['2.0.0', true]])('partial !=1.2 evaluates %s', (version, expected) => {
    expect(satisfies(parseVersion(version as string)!, parseConstraint('!=1.2'))).toBe(expected);
  });
  it('partial exclusion composes with other AND constraints', () => {
    const constraint = parseConstraint('>=1.0 !=1.2 <2.0');
    expect(satisfies(parseVersion('1.1.9')!, constraint)).toBe(true);
    expect(satisfies(parseVersion('2.0.0')!, constraint)).toBe(false);
  });
  it('checks prerelease permission per original term', () => {
    expect(satisfies(parseVersion('1.3.0-beta.1')!, parseConstraint('>=1.2.0-0 <2.0.0'))).toBe(false);
    expect(satisfies(parseVersion('1.3.0-beta.1')!, parseConstraint('>=1.2.0-0 <2.0.0-0'))).toBe(true);
    expect(satisfies(parseVersion('1.2.0-beta.2')!, parseConstraint('^1.2.0-beta.1'))).toBe(true);
  });
  it('coerces short versions but rejects invalid prerelease identifiers', () => {
    expect(parseVersion('1.0')).toMatchObject({ major: 1, minor: 0, patch: 0 });
    expect(parseVersion('v1')).toMatchObject({ major: 1, minor: 0, patch: 0 });
    expect(parseVersion('1.0.0-01')).toBeNull();
    expect(parseVersion('1.0.0-beta..1')).toBeNull();
  });
});

describe('release and hook lifecycle', () => {
  const empty: ReleaseState = { name: 'ref', revisions: [], historyMax: 10 };
  const install = () => apply(empty, { type: 'install', chart: 'app-1' }).state;
  it('can upgrade a failed initial install', () => {
    const failed = apply(empty, { type: 'install', chart: 'app-1', fail: true }).state;
    const recovered = apply(failed, { type: 'upgrade', chart: 'app-2' });
    expect(recovered.error).toBeUndefined();
    expect(recovered.state.revisions[0]).toMatchObject({ rev: 1, status: 'superseded' });
    expect(recovered.state.revisions.at(-1)).toMatchObject({ rev: 2, status: 'deployed' });
  });
  it('upgrade --install reuses an uninstalled name with retained history', () => {
    const removed = apply(install(), { type: 'uninstall', keepHistory: true }).state;
    expect(apply(removed, { type: 'install', chart: 'app-2' }).error).toContain('cannot re-use');
    expect(apply(removed, { type: 'upgrade', install: true, chart: 'app-2' }).state.revisions.at(-1)).toMatchObject({ rev: 2, status: 'deployed' });
  });
  it('default rollback selects the immediately previous revision, including failed', () => {
    const failed = apply(install(), { type: 'upgrade', chart: 'app-2', fail: true }).state;
    const latest = apply(failed, { type: 'upgrade', chart: 'app-3' }).state;
    expect(apply(latest, { type: 'rollback' }).state.revisions.at(-1)).toMatchObject({ chart: 'app-2', description: 'Rollback to 2' });
  });
  it('atomic with no prior successful revision reports failure instead of crashing', () => {
    const failed = apply(empty, { type: 'install', chart: 'app-1', fail: true }).state;
    expect(apply(failed, { type: 'upgrade', chart: 'app-2', fail: true, atomic: true }).error).toContain('previously successful');
  });
  it('hooks default to before-hook-creation; equal weights sort by kind then name', () => {
    const hooks: Hook[] = [
      { name: 'aaa', kind: 'Job', events: ['pre-upgrade'], weight: 0, policies: [] },
      { name: 'zzz', kind: 'Pod', events: ['pre-upgrade'], weight: 0, policies: [] },
    ];
    const result = run(hooks, { installed: true, leftovers: ['job/aaa', 'pod/zzz'] }, 'upgrade', new Set());
    expect(result.status).toBe('deployed');
    expect(result.steps.filter((s) => s.text.includes('criado —'))[0].text).toContain('pod/zzz');
    expect(new Set(result.state.leftovers).size).toBe(2);
  });
});
