import { useState } from 'react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, Tone, logEntry, pushLog } from './kit';

/**
 * Ciclo de vida de uma release do Helm 3.17. Cada revisão é guardada num Secret
 * sh.helm.release.v1.<nome>.v<N> no namespace da release.
 * - upgrade com sucesso: anterior → superseded, nova → deployed;
 * - upgrade com falha: nova → failed, a anterior continua deployed; com --atomic, o Helm faz rollback;
 * - processo interrompido: a revisão fica pending-upgrade e bloqueia novas operações;
 * - rollback cria uma NOVA revisão com o conteúdo da revisão alvo;
 * - uninstall apaga o histórico (ou mantém com --keep-history, status uninstalled).
 */

export type Status = 'deployed' | 'superseded' | 'failed' | 'pending-install' | 'pending-upgrade' | 'uninstalled';

export interface Revision {
  rev: number;
  status: Status;
  chart: string;
  description: string;
}

export interface ReleaseState {
  name: string;
  revisions: Revision[];
  historyMax: number;
}

export type Action =
  | { type: 'install'; chart: string; fail?: boolean; atomic?: boolean }
  | { type: 'upgrade'; chart: string; fail?: boolean; atomic?: boolean; interrupt?: boolean; install?: boolean }
  | { type: 'rollback'; to?: number }
  | { type: 'uninstall'; keepHistory?: boolean };

export interface Outcome {
  state: ReleaseState;
  output: string[];
  error?: string;
}

const last = (s: ReleaseState) => s.revisions[s.revisions.length - 1];
const trim = (s: ReleaseState, revisions: Revision[]) => ({ ...s, revisions: revisions.slice(-s.historyMax) });

export function apply(s: ReleaseState, a: Action): Outcome {
  const cur = last(s);
  const busy = cur && cur.status.startsWith('pending');
  const next = (cur?.rev ?? 0) + 1;

  if (a.type === 'install' || (a.type === 'upgrade' && a.install && (!cur || cur.status === 'uninstalled'))) {
    if (s.revisions.length && !(a.type === 'upgrade' && a.install && cur.status === 'uninstalled')) return { state: s, output: [], error: 'Error: INSTALLATION FAILED: cannot re-use a name that is still in use' };
    if (a.fail) {
      if (a.atomic) return { state: { ...s, revisions: [] }, output: [`release "${s.name}" failed, and has been uninstalled due to atomic being set`], error: 'Error: INSTALLATION FAILED: context deadline exceeded' };
      return { state: trim(s, [...s.revisions, { rev: next, status: 'failed', chart: a.chart, description: 'Release "failed": context deadline exceeded' }]), output: [], error: 'Error: INSTALLATION FAILED: context deadline exceeded' };
    }
    return { state: trim(s, [...s.revisions, { rev: next, status: 'deployed', chart: a.chart, description: 'Install complete' }]), output: [`NAME: ${s.name}`, 'STATUS: deployed', `REVISION: ${next}`] };
  }

  if (a.type === 'upgrade') {
    if (busy) return { state: s, output: [], error: 'Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress' };
    if (!s.revisions.some((r) => r.status === 'deployed') && cur?.status !== 'failed' && cur?.status !== 'superseded') return { state: s, output: [], error: `Error: UPGRADE FAILED: "${s.name}" has no deployed releases` };
    if (a.interrupt) {
      return { state: trim(s, [...s.revisions, { rev: next, status: 'pending-upgrade', chart: a.chart, description: 'Preparing upgrade' }]), output: ['^C  (o processo do helm foi interrompido: CI cancelado, timeout do job, laptop fechado…)'] };
    }
    if (a.fail) {
      const failed: Revision = { rev: next, status: 'failed', chart: a.chart, description: `Upgrade "${s.name}" failed: context deadline exceeded` };
      if (!a.atomic) return { state: trim(s, [...s.revisions, failed]), output: [], error: 'Error: UPGRADE FAILED: context deadline exceeded' };
      const good = [...s.revisions].reverse().find((r) => r.status === 'deployed' || r.status === 'superseded');
      if (!good) return { state: trim(s, [...s.revisions, failed]), output: [], error: 'Error: UPGRADE FAILED: unable to find a previously successful release when attempting to rollback' };
      const revs = s.revisions.map((r) => (r.status === 'deployed' ? { ...r, status: 'superseded' as Status } : r));
      return {
        state: trim(s, [...revs, failed, { rev: next + 1, status: 'deployed', chart: good.chart, description: `Rollback to ${good.rev}` }]),
        output: [`Upgrade falhou; --atomic fez rollback para a revisão ${good.rev}`],
        error: `Error: UPGRADE FAILED: release ${s.name} failed, and has been rolled back due to atomic being set: context deadline exceeded`,
      };
    }
    const original = [...s.revisions].reverse().find((r) => r.status === 'deployed') ?? cur;
    const revs = s.revisions.map((r) => (r === original ? { ...r, status: 'superseded' as Status } : r));
    return { state: trim(s, [...revs, { rev: next, status: 'deployed', chart: a.chart, description: 'Upgrade complete' }]), output: [`Release "${s.name}" has been upgraded. Happy Helming!`, `REVISION: ${next}`] };
  }

  if (a.type === 'rollback') {
    if (!s.revisions.length || cur.status === 'uninstalled' && !a.to) return { state: s, output: [], error: `Error: release: not found` };
    const target = a.to ? s.revisions.find((r) => r.rev === a.to) : s.revisions.find((r) => r.rev === cur.rev - 1);
    if (!target) return { state: s, output: [], error: `Error: release has no ${a.to ?? 'previous'} version` };
    const revs = s.revisions.map((r) => (r.status === 'deployed' || r.status.startsWith('pending') ? { ...r, status: 'superseded' as Status } : r));
    return { state: trim(s, [...revs, { rev: next, status: 'deployed', chart: target.chart, description: `Rollback to ${target.rev}` }]), output: ['Rollback was a success! Happy Helming!'] };
  }

  // uninstall
  if (!s.revisions.length || cur.status === 'uninstalled') return { state: s, output: [], error: `Error: uninstall: Release not loaded: ${s.name}: release: not found` };
  if (a.keepHistory) {
    return { state: { ...s, revisions: s.revisions.map((r, i) => (i === s.revisions.length - 1 ? { ...r, status: 'uninstalled' as Status, description: 'Uninstallation complete' } : r)) }, output: [`release "${s.name}" uninstalled (histórico mantido)`] };
  }
  return { state: { ...s, revisions: [] }, output: [`release "${s.name}" uninstalled`] };
}

const statusTone: Record<Status, Tone> = { deployed: 'green', superseded: 'dim', failed: 'red', 'pending-install': 'amber', 'pending-upgrade': 'amber', uninstalled: 'cyan' };
const CHARTS = ['loja-1.0.0', 'loja-1.1.0', 'loja-1.2.0', 'loja-2.0.0'];

export default function HelmReleaseSim() {
  const [state, setState] = useState<ReleaseState>({ name: 'loja', revisions: [], historyMax: 10 });
  const [chart, setChart] = useState(CHARTS[0]);
  const [fail, setFail] = useState(false);
  const [atomic, setAtomic] = useState(false);
  const [keep, setKeep] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([logEntry('namespace loja vazio: nenhuma release', 'dim')]);

  const run = (cmd: string, a: Action) => {
    const r = apply(state, a);
    setState(r.state);
    setLog((l) => pushLog(l, logEntry(`$ ${cmd}`, 'blue'), ...r.output.map((o) => logEntry(o, 'green')), ...(r.error ? [logEntry(r.error, 'red')] : [])));
  };
  const flags = `${atomic ? ' --atomic' : ''}`;
  const cur = state.revisions[state.revisions.length - 1];

  return (
    <SimFrame title="Helm 3.17 · release loja · namespace loja" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => { setState({ name: 'loja', revisions: [], historyMax: 10 }); setLog([]); }}>Reset</button>}>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <Choice label="Versão do chart" value={chart} onChange={setChart} options={CHARTS.map((c) => ({ value: c, label: c }))} />
            <label className="flex items-center gap-2 text-sm text-tactical-dim"><input type="checkbox" className="accent-[#326ce5]" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Pods não ficam prontos (falha)</label>
            <label className="flex items-center gap-2 text-sm text-tactical-dim"><input type="checkbox" className="accent-[#326ce5]" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} /> --atomic</label>
            <label className="flex items-center gap-2 text-sm text-tactical-dim"><input type="checkbox" className="accent-[#326ce5]" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> --keep-history</label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => run(`helm install loja ./loja --version ${chart.slice(5)}${flags}`, { type: 'install', chart, fail, atomic })}>install</button>
            <button className="btn-primary" onClick={() => run(`helm upgrade loja ./loja --version ${chart.slice(5)}${flags}`, { type: 'upgrade', chart, fail, atomic })}>upgrade</button>
            <button className="btn-ghost" onClick={() => run(`helm upgrade --install loja ./loja --version ${chart.slice(5)}${flags}`, { type: 'upgrade', chart, fail, atomic, install: true })}>upgrade --install</button>
            <button className="btn-ghost" onClick={() => run(`helm upgrade loja ./loja  (processo morto no meio)`, { type: 'upgrade', chart, interrupt: true })}>upgrade interrompido</button>
            <button className="btn-ghost" onClick={() => run('helm rollback loja', { type: 'rollback' })}>rollback</button>
            <button className="btn-ghost" onClick={() => run(`helm uninstall loja${keep ? ' --keep-history' : ''}`, { type: 'uninstall', keepHistory: keep })}>uninstall</button>
          </div>

          <div className="label mb-2 mt-5">$ helm list -n loja</div>
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-signal-green">
            {`NAME   NAMESPACE  REVISION  STATUS            CHART\n${cur && ['deployed', 'failed'].includes(cur.status) ? `loja   loja       ${String(cur.rev).padEnd(9)} ${cur.status.padEnd(17)} ${cur.chart}` : ''}`}
          </pre>
          {cur?.status.startsWith('pending') && <p className="mt-1 text-xs text-signal-amber">helm list sem --all/--pending esconde releases pendentes; use helm list -a.</p>}

          <div className="label mb-2 mt-4">$ helm history loja</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] font-mono text-xs">
              <thead>
                <tr className="text-left text-tactical-label">
                  <th className="px-2 py-1">REVISION</th><th className="px-2 py-1">STATUS</th><th className="px-2 py-1">CHART</th><th className="px-2 py-1">DESCRIPTION</th><th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {state.revisions.map((r) => (
                  <tr key={r.rev} className="border-t border-tactical-border">
                    <td className="px-2 py-1">{r.rev}</td>
                    <td className="px-2 py-1"><Badge tone={statusTone[r.status]}>{r.status}</Badge></td>
                    <td className="px-2 py-1">{r.chart}</td>
                    <td className="px-2 py-1 text-tactical-dim">{r.description}</td>
                    <td className="px-2 py-1">
                      {r.rev !== cur.rev && <button className="text-k8s-400 underline" onClick={() => run(`helm rollback loja ${r.rev}`, { type: 'rollback', to: r.rev })}>rollback aqui</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.revisions.length && <p className="px-2 py-2 text-xs text-tactical-label">Error: release: not found</p>}
          </div>

          <div className="label mb-1 mt-4">$ kubectl get secrets -n loja -l owner=helm</div>
          <div className="font-mono text-[11px] leading-5 text-tactical-dim">
            {state.revisions.length ? state.revisions.map((r) => <div key={r.rev}>sh.helm.release.v1.loja.v{r.rev}   helm.sh/release.v1</div>) : 'No resources found'}
          </div>
        </div>
        <div>
          <EventLog entries={log} title="Terminal" height="h-[28rem]" />
          <p className="mt-3 text-xs text-tactical-label">
            Experimente: faça um upgrade interrompido e tente outro upgrade (a trava "another operation in progress"); resolva com rollback. Compare upgrade
            com falha com e sem --atomic. Desinstale com --keep-history e tente instalar de novo com o mesmo nome.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
