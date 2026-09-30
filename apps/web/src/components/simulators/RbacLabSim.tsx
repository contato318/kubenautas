import { useState } from 'react';
import { Badge, Choice, SimFrame } from './kit';

/**
 * Laboratório de menor privilégio: monte a Role e cumpra a missão.
 * - resources incluem subrecursos (pods/log, pods/exec), que precisam de regra própria;
 * - deployments pertencem ao apiGroup "apps": uma regra em "" (core) não vale para eles;
 * - kubectl logs = get pods/log; kubectl exec = create pods/exec.
 */

export type Verb = 'get' | 'list' | 'watch' | 'create' | 'update' | 'patch' | 'delete';
export const VERBS: Verb[] = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'];

export interface ResourceDef {
  resource: string;
  /** apiGroup real do recurso na API */
  group: string;
}

export const RESOURCES: ResourceDef[] = [
  { resource: 'pods', group: '' },
  { resource: 'pods/log', group: '' },
  { resource: 'pods/exec', group: '' },
  { resource: 'deployments', group: 'apps' },
  { resource: 'services', group: '' },
  { resource: 'configmaps', group: '' },
  { resource: 'secrets', group: '' },
];

/** grants: "recurso:verbo"; groups: apiGroup escolhido para cada recurso na Role */
export interface RoleDraft {
  grants: Set<string>;
  groups: Record<string, string>;
  wildcard: boolean;
}

export const key = (resource: string, verb: Verb) => `${resource}:${verb}`;

export function allows(role: RoleDraft, resource: string, verb: Verb): boolean {
  if (role.wildcard) return true;
  const def = RESOURCES.find((r) => r.resource === resource)!;
  return role.grants.has(key(resource, verb)) && (role.groups[resource] ?? def.group) === def.group;
}

export interface Mission {
  id: string;
  title: string;
  story: string;
  must: [string, Verb][];
  mustNot: [string, Verb][];
}

export const MISSIONS: Mission[] = [
  {
    id: 'suporte',
    title: 'Suporte lê logs',
    story: 'O time de suporte precisa listar os Pods e ler os logs (kubectl get pods, kubectl logs). Nada de shell, nada de apagar.',
    must: [['pods', 'get'], ['pods', 'list'], ['pods/log', 'get']],
    mustNot: [['pods/exec', 'create'], ['pods', 'delete'], ['secrets', 'get']],
  },
  {
    id: 'ci',
    title: 'Pipeline de CI',
    story: 'O pipeline atualiza a imagem com kubectl set image e acompanha com kubectl rollout status (get/list/watch/patch em deployments e inspeção get/list/watch em pods).',
    must: [['deployments', 'get'], ['deployments', 'patch'], ['deployments', 'list'], ['deployments', 'watch'], ['pods', 'get'], ['pods', 'list'], ['pods', 'watch']],
    mustNot: [['deployments', 'delete'], ['secrets', 'get'], ['secrets', 'list'], ['pods/exec', 'create']],
  },
  {
    id: 'debug',
    title: 'Debug em produção',
    story: 'Um SRE de plantão precisa abrir shell nos containers (kubectl exec) e ver os Pods, mas não pode alterar workloads nem ler Secrets.',
    must: [['pods', 'get'], ['pods', 'list'], ['pods/exec', 'create']],
    mustNot: [['pods', 'delete'], ['deployments', 'patch'], ['secrets', 'get']],
  },
  {
    id: 'config',
    title: 'Operador de configuração',
    story: 'Uma ferramenta de GitOps aplica ConfigMaps (get, list, create, update, patch). Ela não pode tocar em Secrets nem em Deployments.',
    must: [['configmaps', 'get'], ['configmaps', 'list'], ['configmaps', 'create'], ['configmaps', 'update'], ['configmaps', 'patch']],
    mustNot: [['secrets', 'get'], ['secrets', 'list'], ['deployments', 'update']],
  },
];

export interface Evaluation {
  checks: { resource: string; verb: Verb; expect: 'permitir' | 'negar'; ok: boolean }[];
  passed: boolean;
  excess: number;
}

export function evaluate(role: RoleDraft, mission: Mission): Evaluation {
  const checks = [
    ...mission.must.map(([resource, verb]) => ({ resource, verb, expect: 'permitir' as const, ok: allows(role, resource, verb) })),
    ...mission.mustNot.map(([resource, verb]) => ({ resource, verb, expect: 'negar' as const, ok: !allows(role, resource, verb) })),
  ];
  const needed = new Set(mission.must.map(([r, v]) => key(r, v)));
  const granted = RESOURCES.flatMap((r) => VERBS.filter((v) => allows(role, r.resource, v)).map((v) => key(r.resource, v)));
  return { checks, passed: checks.every((c) => c.ok), excess: granted.filter((g) => !needed.has(g)).length };
}

export function warnings(role: RoleDraft): string[] {
  const w: string[] = [];
  if (role.wildcard) w.push('Curinga em apiGroups, resources e verbs equivale a admin do namespace — inclusive Secrets e RBAC.');
  if (allows(role, 'secrets', 'get') || allows(role, 'secrets', 'list')) w.push('Ler Secrets expõe senhas e tokens de ServiceAccounts: é um caminho de escalonamento de privilégio.');
  if (allows(role, 'pods', 'create')) w.push('Criar Pods permite montar qualquer Secret ou ServiceAccount do namespace dentro do container.');
  if (allows(role, 'pods/exec', 'create')) w.push('pods/exec dá um shell dentro dos containers, com acesso ao que eles acessam.');
  if (role.groups['deployments'] === '' && VERBS.some((v) => role.grants.has(key('deployments', v)))) w.push('Deployments estão no apiGroup "apps": uma regra com apiGroups [""] não concede nada sobre eles.');
  return w;
}

export function toYaml(role: RoleDraft, name: string): string {
  const header = `apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: ${name}\n  namespace: prod\nrules:`;
  if (role.wildcard) return `${header}\n  - apiGroups: ["*"]\n    resources: ["*"]\n    verbs: ["*"]`;
  const rules = new Map<string, { group: string; resources: string[]; verbs: Verb[] }>();
  for (const r of RESOURCES) {
    const verbs = VERBS.filter((v) => role.grants.has(key(r.resource, v)));
    if (!verbs.length) continue;
    const group = role.groups[r.resource] ?? r.group;
    const id = `${group}|${verbs.join(',')}`;
    const rule = rules.get(id) ?? { group, resources: [], verbs };
    rule.resources.push(r.resource);
    rules.set(id, rule);
  }
  if (!rules.size) return `${header} []`;
  const q = (xs: string[]) => `[${xs.map((x) => `"${x}"`).join(', ')}]`;
  return `${header}\n${[...rules.values()].map((r) => `  - apiGroups: ${q([r.group])}\n    resources: ${q(r.resources)}\n    verbs: ${q(r.verbs)}`).join('\n')}`;
}

const emptyRole = (): RoleDraft => ({ grants: new Set(), groups: {}, wildcard: false });

export default function RbacLabSim() {
  const [missionId, setMissionId] = useState(MISSIONS[0].id);
  const [role, setRole] = useState<RoleDraft>(emptyRole);
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  const result = evaluate(role, mission);
  const warns = warnings(role);

  const toggle = (resource: string, verb: Verb) =>
    setRole((r) => {
      const grants = new Set(r.grants);
      const k = key(resource, verb);
      grants.has(k) ? grants.delete(k) : grants.add(k);
      return { ...r, grants };
    });

  return (
    <SimFrame
      title="rbac.authorization.k8s.io/v1 · laboratório de menor privilégio"
      toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setRole(emptyRole())}>Limpar Role</button>}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <Choice label="Missão" value={missionId} onChange={(v) => { setMissionId(v); setRole(emptyRole()); }} options={MISSIONS.map((m) => ({ value: m.id, label: m.title }))} />
          <p className="mt-2 text-sm text-tactical-dim">{mission.story}</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr>
                  <th className="label px-2 py-1 text-left">recurso</th>
                  <th className="label px-2 py-1 text-left">apiGroup</th>
                  {VERBS.map((v) => <th key={v} className="label px-1 py-1">{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r) => (
                  <tr key={r.resource} className="border-t border-tactical-border">
                    <td className="px-2 py-1.5 font-mono text-xs">{r.resource}</td>
                    <td className="px-2 py-1.5">
                      {r.resource === 'deployments' ? (
                        <select
                          className="rounded border border-tactical-border bg-tactical-bg px-1 py-0.5 font-mono text-xs"
                          value={role.groups['deployments'] ?? 'apps'}
                          onChange={(e) => setRole((x) => ({ ...x, groups: { ...x.groups, deployments: e.target.value } }))}
                        >
                          <option value="apps">apps</option>
                          <option value="">"" (core)</option>
                        </select>
                      ) : (
                        <span className="font-mono text-xs text-tactical-label">{r.group === '' ? '"" (core)' : r.group}</span>
                      )}
                    </td>
                    {VERBS.map((v) => (
                      <td key={v} className="px-1 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${v} ${r.resource}`}
                          className="h-4 w-4 accent-[#326ce5]"
                          disabled={role.wildcard}
                          checked={role.wildcard || role.grants.has(key(r.resource, v))}
                          onChange={() => toggle(r.resource, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-tactical-dim">
            <input type="checkbox" className="accent-[#326ce5]" checked={role.wildcard} onChange={(e) => setRole((x) => ({ ...x, wildcard: e.target.checked }))} />
            Atalho perigoso: apiGroups/resources/verbs ["*"]
          </label>

          <pre className="mt-4 overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-signal-green">{toYaml(role, `missao-${mission.id}`)}</pre>
        </div>

        <div className="space-y-3">
          <div className={`rounded-md border p-3 ${result.passed ? (result.excess === 0 ? 'border-signal-green/60 bg-signal-green/10' : 'border-signal-amber/60 bg-signal-amber/10') : 'border-tactical-border'}`}>
            <div className="label">Resultado</div>
            <div className="mt-1 text-lg font-semibold">
              {!result.passed ? 'Ainda não atende à missão' : result.excess === 0 ? 'Menor privilégio perfeito ✔' : `Funciona, mas com ${result.excess} permissão(ões) a mais`}
            </div>
          </div>
          <div className="space-y-1">
            {result.checks.map((c) => (
              <div key={`${c.expect}-${c.resource}-${c.verb}`} className="flex items-center justify-between gap-2 rounded border border-tactical-border px-2 py-1 font-mono text-xs">
                <span>can-i {c.verb} {c.resource}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-tactical-label">deve {c.expect}</span>
                  <Badge tone={c.ok ? 'green' : 'red'}>{c.ok ? 'ok' : 'falha'}</Badge>
                </span>
              </div>
            ))}
          </div>
          {warns.length > 0 && (
            <div className="rounded-md border border-signal-amber/50 bg-signal-amber/5 p-3 text-xs text-signal-amber">
              <div className="label mb-1 !text-signal-amber">Atenção</div>
              <ul className="list-disc space-y-1 pl-4">{warns.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-tactical-label">
            Dica: subrecursos precisam de regra própria (get pods não libera pods/log). Troque o apiGroup de deployments para "" e veja a missão de CI falhar
            mesmo com os verbos marcados.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
