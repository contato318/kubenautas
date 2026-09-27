import { useState } from 'react';
import { Badge, Choice, SimFrame, Tone } from './kit';

/**
 * Hooks do Helm:
 * - hooks rodam em fases (pre-install, post-install, pre-upgrade, post-upgrade, pre-delete, pre-rollback, test…),
 *   em ordem de helm.sh/hook-weight (menor primeiro) e depois pelo nome; o Helm espera cada Job terminar;
 * - hook que falha marca a release como failed e interrompe a operação;
 * - hook-delete-policy: before-hook-creation (padrão quando nada é informado), hook-succeeded, hook-failed;
 * - hooks não fazem parte da release: sobrevivem ao uninstall, a menos que uma política os apague.
 */

export type Policy = 'before-hook-creation' | 'hook-succeeded' | 'hook-failed';
export type Operation = 'install' | 'upgrade' | 'rollback' | 'uninstall' | 'test';

export interface Hook {
  name: string;
  kind: 'Job' | 'Pod';
  events: string[];
  weight: number;
  policies: Policy[];
}

export interface HookState {
  installed: boolean;
  leftovers: string[];
}

export interface Step {
  text: string;
  tone: Tone;
}

const PHASES: Record<Operation, [string, string]> = {
  install: ['pre-install', 'post-install'],
  upgrade: ['pre-upgrade', 'post-upgrade'],
  rollback: ['pre-rollback', 'post-rollback'],
  uninstall: ['pre-delete', 'post-delete'],
  test: ['test', ''],
};

export function run(hooks: Hook[], state: HookState, op: Operation, failing: Set<string>): { steps: Step[]; state: HookState; status: string } {
  const steps: Step[] = [];
  let leftovers = [...state.leftovers];

  if (op === 'install' && state.installed) return { steps: [{ text: 'Error: INSTALLATION FAILED: cannot re-use a name that is still in use', tone: 'red' }], state, status: 'erro' };
  if (op !== 'install' && !state.installed) return { steps: [{ text: 'Error: release: not found', tone: 'red' }], state, status: 'erro' };

  const runPhase = (phase: string): boolean => {
    const list = hooks.filter((h) => h.events.includes(phase)).sort((a, b) => a.weight - b.weight || a.name.localeCompare(b.name));
    if (!list.length) return true;
    steps.push({ text: `── fase ${phase} (${list.length} hook${list.length > 1 ? 's' : ''}) ──`, tone: 'blue' });
    for (const h of list) {
      const id = `${h.kind.toLowerCase()}/${h.name}`;
      if (leftovers.includes(id)) {
        if (h.policies.includes('before-hook-creation')) {
          steps.push({ text: `${id}: sobra da execução anterior apagada (before-hook-creation)`, tone: 'dim' });
          leftovers = leftovers.filter((x) => x !== id);
        } else {
          steps.push({ text: `Error: ${h.kind === 'Job' ? 'jobs.batch' : 'pods'} "${h.name}" already exists`, tone: 'red' });
          return false;
        }
      }
      steps.push({ text: `${id} (weight ${h.weight}) criado — aguardando terminar…`, tone: 'cyan' });
      const ok = !failing.has(h.name);
      if (!ok) {
        steps.push({ text: `${id} falhou: ${h.kind === 'Job' ? 'BackoffLimitExceeded' : 'container saiu com código 1'}`, tone: 'red' });
        if (h.policies.includes('hook-failed')) steps.push({ text: `${id} apagado (hook-failed)`, tone: 'dim' });
        else leftovers.push(id);
        return false;
      }
      steps.push({ text: `${id} concluído com sucesso`, tone: 'green' });
      if (h.policies.includes('hook-succeeded')) steps.push({ text: `${id} apagado (hook-succeeded)`, tone: 'dim' });
      else leftovers.push(id);
    }
    return true;
  };

  const [pre, post] = PHASES[op];
  if (op === 'test') {
    const ok = runPhase('test');
    return { steps: [...steps, { text: ok ? 'TEST SUITE: passou' : 'Error: 1 error occurred: * pod smoke-test failed', tone: ok ? 'green' : 'red' }], state: { ...state, leftovers }, status: ok ? 'deployed' : 'deployed (teste falhou)' };
  }
  if (!runPhase(pre)) {
    steps.push({ text: `Error: ${op.toUpperCase()} FAILED: ${pre} hooks failed — recursos do chart NÃO foram aplicados`, tone: 'red' });
    return { steps, state: { installed: op === 'uninstall' || op !== 'install' ? state.installed : true, leftovers }, status: 'failed' };
  }
  if (op === 'uninstall') {
    steps.push({ text: 'Recursos da release apagados (ConfigMap, Deployment, Service). PVC com helm.sh/resource-policy: keep foi mantido.', tone: 'amber' });
  } else {
    steps.push({ text: `Recursos do chart aplicados (${op === 'rollback' ? 'manifesto da revisão alvo' : 'ConfigMap, Deployment, Service'})`, tone: 'green' });
  }
  if (post && !runPhase(post)) {
    steps.push({ text: `Error: ${op.toUpperCase()} FAILED: ${post} hooks failed — os recursos já foram aplicados, mas a release fica failed`, tone: 'red' });
    return { steps, state: { installed: op !== 'uninstall', leftovers }, status: 'failed' };
  }
  const status = op === 'uninstall' ? 'uninstalled' : 'deployed';
  steps.push({ text: `STATUS: ${status}`, tone: 'green' });
  return { steps, state: { installed: op !== 'uninstall', leftovers }, status };
}

const POLICY_OPTIONS: { value: string; label: string; policies: Policy[] }[] = [
  { value: 'default', label: '(sem annotation) → before-hook-creation', policies: ['before-hook-creation'] },
  { value: 'bhc,succeeded', label: 'before-hook-creation,hook-succeeded', policies: ['before-hook-creation', 'hook-succeeded'] },
  { value: 'succeeded', label: 'hook-succeeded (apenas)', policies: ['hook-succeeded'] },
  { value: 'succeeded,failed', label: 'hook-succeeded,hook-failed', policies: ['hook-succeeded', 'hook-failed'] },
];

export default function HelmHooksSim() {
  const [policy, setPolicy] = useState('succeeded');
  const [failMigrate, setFailMigrate] = useState(false);
  const [failTest, setFailTest] = useState(false);
  const [state, setState] = useState<HookState>({ installed: false, leftovers: [] });
  const [steps, setSteps] = useState<Step[]>([]);
  const [status, setStatus] = useState('—');

  const hooks: Hook[] = [
    { name: 'db-migrate', kind: 'Job', events: ['pre-install', 'pre-upgrade'], weight: -5, policies: POLICY_OPTIONS.find((p) => p.value === policy)!.policies },
    { name: 'seed-dados', kind: 'Job', events: ['post-install'], weight: 0, policies: ['hook-succeeded'] },
    { name: 'avisar-slack', kind: 'Job', events: ['post-install', 'post-upgrade'], weight: 5, policies: ['before-hook-creation', 'hook-succeeded'] },
    { name: 'backup-banco', kind: 'Job', events: ['pre-delete'], weight: 0, policies: ['before-hook-creation'] },
    { name: 'smoke-test', kind: 'Pod', events: ['test'], weight: 0, policies: ['before-hook-creation'] },
  ];

  const exec = (op: Operation) => {
    const failing = new Set<string>([...(failMigrate ? ['db-migrate'] : []), ...(failTest ? ['smoke-test'] : [])]);
    const r = run(hooks, state, op, failing);
    setSteps([{ text: `$ helm ${op === 'test' ? 'test' : op} loja${op === 'install' || op === 'upgrade' ? ' ./loja' : ''}`, tone: 'blue' }, ...r.steps]);
    setState(r.state);
    setStatus(r.status);
  };

  return (
    <SimFrame title="helm.sh/hook · ciclo de vida com hooks" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => { setState({ installed: false, leftovers: [] }); setSteps([]); setStatus('—'); }}>Reset</button>}>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] font-mono text-[11px]">
              <thead><tr className="text-left text-tactical-label"><th className="px-1">hook</th><th className="px-1">eventos</th><th className="px-1">weight</th></tr></thead>
              <tbody>
                {hooks.map((h) => (
                  <tr key={h.name} className="border-t border-tactical-border"><td className="px-1 py-1">{h.kind}/{h.name}</td><td className="px-1">{h.events.join(', ')}</td><td className="px-1">{h.weight}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Choice label="hook-delete-policy do db-migrate" value={policy} onChange={setPolicy} options={POLICY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
          <label className="flex items-center gap-2 text-sm text-tactical-dim"><input type="checkbox" className="accent-[#326ce5]" checked={failMigrate} onChange={(e) => setFailMigrate(e.target.checked)} /> A migração falha</label>
          <label className="flex items-center gap-2 text-sm text-tactical-dim"><input type="checkbox" className="accent-[#326ce5]" checked={failTest} onChange={(e) => setFailTest(e.target.checked)} /> O smoke test falha</label>
          <div className="flex flex-wrap gap-2">
            {(['install', 'upgrade', 'rollback', 'test', 'uninstall'] as Operation[]).map((op) => (
              <button key={op} className={op === 'install' || op === 'upgrade' ? 'btn-primary' : 'btn-ghost'} onClick={() => exec(op)}>{op}</button>
            ))}
          </div>
          <div className="rounded-md border border-tactical-border p-2 font-mono text-xs">
            <div>release: <Badge tone={status === 'deployed' ? 'green' : status === 'failed' ? 'red' : 'dim'}>{status}</Badge></div>
            <div className="mt-1 text-tactical-dim">recursos de hook no cluster: {state.leftovers.length ? state.leftovers.join(', ') : 'nenhum'}</div>
          </div>
        </div>
        <div>
          <div className="label mb-1">Linha do tempo</div>
          <ol className="space-y-1 rounded-md border border-tactical-border bg-black/50 p-3 font-mono text-xs">
            {steps.length === 0 && <li className="text-tactical-label">execute uma operação…</li>}
            {steps.map((s, i) => (
              <li key={i} className={{ green: 'text-signal-green', red: 'text-signal-red', amber: 'text-signal-amber', cyan: 'text-signal-cyan', blue: 'text-k8s-400', dim: 'text-tactical-label' }[s.tone]}>{s.text}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-tactical-label">
            Roteiro: com a política "hook-succeeded (apenas)", faça install, marque "a migração falha" e faça upgrade (o Job falho fica no cluster); desmarque e
            faça upgrade de novo — "already exists". Troque para before-hook-creation e repita. Depois desinstale e veja que os Jobs de hook sobram.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
