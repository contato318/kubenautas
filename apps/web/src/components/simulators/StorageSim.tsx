import { useState } from 'react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, logEntry, pushLog } from './kit';

/**
 * Binding de PVCs:
 * - primeiro procura um PV Available da mesma StorageClass, com o access mode e capacidade suficiente (o menor que serve);
 * - senão, se a classe tem provisioner, cria um PV dinamicamente (em WaitForFirstConsumer, só depois que um Pod usar o PVC);
 * - ao apagar o PVC: reclaimPolicy Delete apaga o PV; Retain deixa o PV Released (não reutilizável automaticamente).
 */

export type AccessMode = 'RWO' | 'RWX';

export interface StorageClass {
  name: string;
  provisioner: string | null;
  bindingMode: 'Immediate' | 'WaitForFirstConsumer';
  reclaim: 'Delete' | 'Retain';
  supports: AccessMode[];
}

export interface PV {
  name: string;
  capacity: number;
  accessModes: AccessMode[];
  storageClass: string;
  reclaim: 'Delete' | 'Retain';
  phase: 'Available' | 'Bound' | 'Released';
  claim?: string;
}

export interface PVC {
  name: string;
  size: number;
  accessMode: AccessMode;
  storageClass: string;
  phase: 'Pending' | 'Bound';
  volume?: string;
  hasConsumer: boolean;
  message?: string;
}

export interface StorageState {
  pvs: PV[];
  pvcs: PVC[];
}

export const CLASSES: StorageClass[] = [
  { name: 'standard', provisioner: 'disk.csi.exemplo.com', bindingMode: 'Immediate', reclaim: 'Delete', supports: ['RWO'] },
  { name: 'fast-ssd', provisioner: 'disk.csi.exemplo.com', bindingMode: 'WaitForFirstConsumer', reclaim: 'Delete', supports: ['RWO'] },
  { name: 'nfs', provisioner: 'nfs.csi.k8s.io', bindingMode: 'Immediate', reclaim: 'Retain', supports: ['RWO', 'RWX'] },
  { name: 'manual', provisioner: null, bindingMode: 'Immediate', reclaim: 'Retain', supports: ['RWO', 'RWX'] },
];

export const initialStorage = (): StorageState => ({
  pvs: [
    { name: 'pv-a', capacity: 10, accessModes: ['RWO'], storageClass: 'manual', reclaim: 'Retain', phase: 'Available' },
    { name: 'pv-b', capacity: 50, accessModes: ['RWO', 'RWX'], storageClass: 'manual', reclaim: 'Retain', phase: 'Available' },
    { name: 'pv-c', capacity: 5, accessModes: ['RWO'], storageClass: 'manual', reclaim: 'Retain', phase: 'Available' },
  ],
  pvcs: [],
});

/** Tenta fazer o bind de todos os PVCs pendentes. Retorna o novo estado e as mensagens de evento. */
export function reconcile(state: StorageState): { state: StorageState; events: string[] } {
  let pvs = [...state.pvs];
  const events: string[] = [];
  const pvcs = state.pvcs.map((pvc) => {
    if (pvc.phase === 'Bound') return pvc;
    const sc = CLASSES.find((c) => c.name === pvc.storageClass)!;
    const match = pvs
      .filter((pv) => pv.phase === 'Available' && pv.storageClass === pvc.storageClass && pv.accessModes.includes(pvc.accessMode) && pv.capacity >= pvc.size)
      .sort((a, b) => a.capacity - b.capacity)[0];
    if (match) {
      pvs = pvs.map((pv) => (pv.name === match.name ? { ...pv, phase: 'Bound', claim: pvc.name } : pv));
      events.push(`pvc/${pvc.name} Bound → ${match.name} (${match.capacity}Gi, PV estático)`);
      return { ...pvc, phase: 'Bound' as const, volume: match.name, message: undefined };
    }
    if (!sc.provisioner) {
      return { ...pvc, message: 'no persistent volumes available for this claim' };
    }
    if (sc.bindingMode === 'WaitForFirstConsumer' && !pvc.hasConsumer) {
      return { ...pvc, message: 'waiting for first consumer to be created before binding' };
    }
    if (!sc.supports.includes(pvc.accessMode)) {
      return { ...pvc, message: `ProvisioningFailed: ${sc.provisioner} não suporta ${pvc.accessMode}` };
    }
    const name = `pvc-${pvc.name}-${Math.abs(hash(pvc.name)).toString(16).slice(0, 6)}`;
    pvs = [...pvs, { name, capacity: pvc.size, accessModes: [pvc.accessMode], storageClass: sc.name, reclaim: sc.reclaim, phase: 'Bound', claim: pvc.name }];
    events.push(`pvc/${pvc.name} ProvisioningSucceeded: ${sc.provisioner} criou ${name} (${pvc.size}Gi)`);
    return { ...pvc, phase: 'Bound' as const, volume: name, message: undefined };
  });
  return { state: { pvs, pvcs }, events };
}

export function deleteClaim(state: StorageState, name: string): { state: StorageState; events: string[] } {
  const pvc = state.pvcs.find((c) => c.name === name);
  if (!pvc) return { state, events: [] };
  const events = [`pvc/${name} deletado`];
  let pvs = state.pvs;
  if (pvc.volume) {
    const pv = pvs.find((v) => v.name === pvc.volume)!;
    if (pv.reclaim === 'Delete') {
      pvs = pvs.filter((v) => v.name !== pv.name);
      events.push(`${pv.name} apagado junto com o disco (reclaimPolicy: Delete)`);
    } else {
      pvs = pvs.map((v) => (v.name === pv.name ? { ...v, phase: 'Released' } : v));
      events.push(`${pv.name} ficou Released: os dados foram preservados (reclaimPolicy: Retain)`);
    }
  }
  return { state: { pvs, pvcs: state.pvcs.filter((c) => c.name !== name) }, events };
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

const phaseTone = { Available: 'cyan', Bound: 'green', Released: 'amber', Pending: 'amber' } as const;

export default function StorageSim() {
  const [state, setState] = useState<StorageState>(initialStorage);
  const [log, setLog] = useState<LogEntry[]>([logEntry('3 PVs estáticos disponíveis na classe manual', 'blue')]);
  const [size, setSize] = useState('8');
  const [mode, setMode] = useState<AccessMode>('RWO');
  const [sc, setSc] = useState('manual');
  const [counter, setCounter] = useState(1);

  const apply = (r: { state: StorageState; events: string[] }, tone: 'green' | 'amber' = 'green') => {
    const again = reconcile(r.state);
    setState(again.state);
    setLog((l) => pushLog(l, ...[...r.events, ...again.events].map((e) => logEntry(e, e.includes('Released') ? 'amber' : tone))));
  };

  const create = () => {
    const name = `dados-${counter}`;
    setCounter((c) => c + 1);
    const pvc: PVC = { name, size: Number(size), accessMode: mode, storageClass: sc, phase: 'Pending', hasConsumer: false };
    apply({ state: { ...state, pvcs: [...state.pvcs, pvc] }, events: [`pvc/${name} criado (${size}Gi, ${mode}, ${sc})`] });
  };

  return (
    <SimFrame title="storage.k8s.io/v1 · PersistentVolumes e Claims" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => { setState(initialStorage()); setLog([]); }}>Reset</button>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <Choice label="Tamanho" value={size} onChange={setSize} options={['1', '5', '8', '20', '100'].map((v) => ({ value: v, label: `${v}Gi` }))} />
            <Choice label="Access mode" value={mode} onChange={setMode} options={[{ value: 'RWO', label: 'ReadWriteOnce' }, { value: 'RWX', label: 'ReadWriteMany' }]} />
            <Choice label="StorageClass" value={sc} onChange={setSc} options={CLASSES.map((c) => ({ value: c.name, label: `${c.name} (${c.provisioner ? c.bindingMode : 'sem provisioner'})` }))} />
            <button className="btn-primary" onClick={create}>Criar PVC</button>
          </div>

          <div className="mt-5 label mb-2">PersistentVolumeClaims</div>
          <div className="space-y-2">
            {state.pvcs.length === 0 && <p className="text-sm text-tactical-label">nenhum PVC ainda…</p>}
            {state.pvcs.map((c) => (
              <div key={c.name} className="rounded-md border border-tactical-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{c.name}</span>
                  <Badge tone={phaseTone[c.phase]}>{c.phase}</Badge>
                  <span className="font-mono text-xs text-tactical-label">{c.size}Gi · {c.accessMode} · {c.storageClass}{c.volume ? ` → ${c.volume}` : ''}</span>
                  <span className="ml-auto flex gap-2">
                    {!c.hasConsumer && (
                      <button className="btn-ghost px-2 py-1" onClick={() => apply({ state: { ...state, pvcs: state.pvcs.map((x) => (x.name === c.name ? { ...x, hasConsumer: true } : x)) }, events: [`pod usando ${c.name} agendado`] })}>Criar Pod que usa</button>
                    )}
                    <button className="btn-ghost px-2 py-1" onClick={() => apply(deleteClaim(state, c.name), 'amber')}>Apagar</button>
                  </span>
                </div>
                {c.message && <div className="mt-1 font-mono text-xs text-signal-amber">{c.message}</div>}
              </div>
            ))}
          </div>

          <div className="mt-5 label mb-2">PersistentVolumes</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.pvs.map((v) => (
              <div key={v.name} className="rounded-md border border-tactical-border px-3 py-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>{v.name}</span>
                  <Badge tone={phaseTone[v.phase]}>{v.phase}</Badge>
                </div>
                <div className="mt-1 text-tactical-label">{v.capacity}Gi · {v.accessModes.join(',')} · {v.storageClass} · {v.reclaim}{v.claim ? ` · claim ${v.claim}` : ''}</div>
              </div>
            ))}
          </div>
        </div>
        <EventLog entries={log} title="Eventos" height="h-96" />
      </div>
      <p className="mt-3 text-xs text-tactical-label">
        Teste: peça 8Gi RWO em manual (recebe o pv-a de 10Gi, o menor que serve); peça 100Gi em manual (fica Pending); peça RWX em standard (o
        driver de disco não suporta); use fast-ssd e veja o PVC esperar o primeiro Pod.
      </p>
    </SimFrame>
  );
}
