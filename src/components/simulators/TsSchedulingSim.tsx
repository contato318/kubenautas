import { useState } from 'react';
import { Choice, SimFrame, Toggle } from './kit';

/**
 * Gera a mensagem de FailedScheduling como o kube-scheduler:
 * cada nó reprova no primeiro filtro que falhar (NodeResourcesFit pode listar cpu e memória),
 * e as razões são agregadas por contagem e ordenadas como texto: "0/4 nodes are available: …".
 */

export interface SNode {
  name: string;
  cpuFree: number; // millicores
  memFree: number; // Mi
  labels: Record<string, string>;
  taint?: string;
  unschedulable?: boolean;
  zone: string;
}

export interface PodSpec {
  cpu: number;
  mem: number;
  nodeSelector?: [string, string];
  tolerateGpu: boolean;
  pvcZone?: string;
}

export function nodeReasons(n: SNode, p: PodSpec): string[] {
  if (n.unschedulable) return ['node(s) were unschedulable'];
  if (n.taint && !(n.taint.startsWith('dedicated=gpu') && p.tolerateGpu)) return [`node(s) had untolerated taint {${n.taint.split(':')[0].replace('=', ': ')}}`];
  if (p.nodeSelector && n.labels[p.nodeSelector[0]] !== p.nodeSelector[1]) return ["node(s) didn't match Pod's node affinity/selector"];
  const res: string[] = [];
  if (p.cpu > n.cpuFree) res.push('Insufficient cpu');
  if (p.mem > n.memFree) res.push('Insufficient memory');
  if (res.length) return res;
  if (p.pvcZone && n.zone !== p.pvcZone) return ['node(s) had volume node affinity conflict'];
  return [];
}

export function schedule(nodes: SNode[], p: PodSpec): { node: string | null; message: string } {
  const counts = new Map<string, number>();
  let fit: string | null = null;
  for (const n of nodes) {
    const r = nodeReasons(n, p);
    if (!r.length && !fit) fit = n.name;
    r.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  }
  if (fit) return { node: fit, message: `Successfully assigned default/api-7d9f to ${fit}` };
  const parts = [...counts.entries()].map(([k, v]) => `${v} ${k}`).sort();
  return { node: null, message: `0/${nodes.length} nodes are available: ${parts.join(', ')}. preemption: 0/${nodes.length} nodes are available: ${nodes.length} Preemption is not helpful for scheduling.` };
}

export const NODES: SNode[] = [
  { name: 'worker-1', cpuFree: 1500, memFree: 3000, labels: { disktype: 'ssd' }, zone: 'a' },
  { name: 'worker-2', cpuFree: 3500, memFree: 6000, labels: { disktype: 'hdd' }, zone: 'b' },
  { name: 'worker-3', cpuFree: 3800, memFree: 12000, labels: { disktype: 'ssd', gpu: 'true' }, taint: 'dedicated=gpu:NoSchedule', zone: 'a' },
  { name: 'worker-4', cpuFree: 4000, memFree: 8000, labels: { disktype: 'ssd' }, zone: 'b' },
];

export default function TsSchedulingSim() {
  const [cpu, setCpu] = useState('2000');
  const [mem, setMem] = useState('2048');
  const [selector, setSelector] = useState('none');
  const [tolerate, setTolerate] = useState(false);
  const [pvc, setPvc] = useState('none');
  const [cordon4, setCordon4] = useState(true);

  const nodes = NODES.map((n) => (n.name === 'worker-4' ? { ...n, unschedulable: cordon4 } : n));
  const spec: PodSpec = { cpu: Number(cpu), mem: Number(mem), nodeSelector: selector === 'none' ? undefined : ['disktype', selector], tolerateGpu: tolerate, pvcZone: pvc === 'none' ? undefined : pvc };
  const r = schedule(nodes, spec);

  return (
    <SimFrame title="kube-scheduler · Events do Pod api-7d9f">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Choice label="requests.cpu" value={cpu} onChange={setCpu} options={['250', '1000', '2000', '4000', '6000'].map((v) => ({ value: v, label: `${v}m` }))} />
          <Choice label="requests.memory" value={mem} onChange={setMem} options={['512', '2048', '4096', '10000', '16000'].map((v) => ({ value: v, label: `${v}Mi` }))} />
          <Choice label="nodeSelector" value={selector} onChange={setSelector} options={[{ value: 'none', label: '(nenhum)' }, { value: 'ssd', label: 'disktype: ssd' }, { value: 'nvme', label: 'disktype: nvme' }]} />
          <Choice label="PVC já provisionado na zona" value={pvc} onChange={setPvc} options={[{ value: 'none', label: '(sem volume)' }, { value: 'a', label: 'zona a' }, { value: 'b', label: 'zona b' }]} />
          <Toggle checked={tolerate} onChange={setTolerate}><span className="text-xs">toleration dedicated=gpu:NoSchedule</span></Toggle>
          <Toggle checked={cordon4} onChange={setCordon4}><span className="text-xs">worker-4 cordonado (manutenção)</span></Toggle>
        </div>
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] font-mono text-xs">
              <thead><tr className="text-left text-tactical-label"><th className="px-2 py-1">nó</th><th className="px-2 py-1">livre</th><th className="px-2 py-1">zona/labels/taints</th><th className="px-2 py-1">resultado</th></tr></thead>
              <tbody>
                {nodes.map((n) => {
                  const reasons = nodeReasons(n, spec);
                  return (
                    <tr key={n.name} className="border-t border-tactical-border">
                      <td className="px-2 py-1">{n.name}</td>
                      <td className="px-2 py-1">{n.cpuFree}m / {n.memFree}Mi</td>
                      <td className="px-2 py-1 text-tactical-dim">{n.zone} · disktype={n.labels.disktype}{n.taint ? ` · ${n.taint}` : ''}{n.unschedulable ? ' · cordon' : ''}</td>
                      <td className={`px-2 py-1 ${reasons.length ? 'text-signal-red' : 'text-signal-green'}`}>{reasons.length ? reasons.join(', ') : 'cabe'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <pre className={`mt-4 whitespace-pre-wrap rounded-md border p-3 font-mono text-xs ${r.node ? 'border-signal-green/50 text-signal-green' : 'border-signal-red/50 text-signal-red'}`}>
            {`Type     Reason            From               Message\n${r.node ? 'Normal   Scheduled         default-scheduler  ' : 'Warning  FailedScheduling  default-scheduler  '}${r.message}`}
          </pre>
          <p className="mt-3 text-xs text-tactical-label">
            Cada nó aparece uma única vez na mensagem, no primeiro filtro em que foi reprovado — por isso a soma das contagens pode ser maior que o número de nós só quando cpu e memória
            faltam no mesmo nó. Leia a mensagem inteira: ela aponta exatamente o que mudar.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
