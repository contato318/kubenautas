import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Diagnóstico de volumes: o que PVC e Pod mostram em cada falha, e como corrigir. */

export interface VolumeInput {
  storageClass: 'ok' | 'missing';
  provisioner: 'up' | 'down';
  secondReplicaOtherNode: boolean;
  nonRootWithoutFsGroup: boolean;
  quotaExceeded: boolean;
}

export interface VolumeResult {
  pvc: string;
  pods: { name: string; status: string; ok: boolean }[];
  events: string[];
  fix: string;
}

export function volumeCheck(i: VolumeInput): VolumeResult {
  if (i.quotaExceeded) {
    return {
      pvc: 'não criado',
      pods: [{ name: 'web-0', status: 'Pending (o StatefulSet não consegue criar o PVC)', ok: false }],
      events: ['Warning  FailedCreate  statefulset-controller  create Claim data-web-0 for Pod web-0 in StatefulSet web failed error: persistentvolumeclaims "data-web-0" is forbidden: exceeded quota: storage-quota, requested: requests.storage=100Gi, used: requests.storage=450Gi, limited: requests.storage=500Gi'],
      fix: 'Reduza o tamanho pedido, libere PVCs antigos (kubectl get pvc) ou aumente a ResourceQuota do namespace.',
    };
  }
  if (i.storageClass === 'missing') {
    return {
      pvc: 'Pending',
      pods: [{ name: 'web-0', status: 'Pending', ok: false }],
      events: ['Warning  ProvisioningFailed  persistentvolume-controller  storageclass.storage.k8s.io "fast-ssd" not found', 'Warning  FailedScheduling  default-scheduler  0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims.'],
      fix: 'Use uma StorageClass existente (kubectl get storageclass) ou crie a "fast-ssd". storageClassName é imutável no PVC: apague e recrie o PVC.',
    };
  }
  if (i.provisioner === 'down') {
    return {
      pvc: 'Pending',
      pods: [{ name: 'web-0', status: 'Pending', ok: false }],
      events: ['Normal  ExternalProvisioning  persistentvolume-controller  Waiting for a volume to be created either by the external provisioner "ebs.csi.aws.com" or manually by the system administrator. If volume creation is delayed, please verify that the provisioner is running and correctly registered.'],
      fix: 'Verifique o controller do driver CSI (kubectl get pods -n kube-system | grep csi) e seus logs — credenciais da nuvem e permissões IAM são causas comuns.',
    };
  }
  const events: string[] = ['Normal  ProvisioningSucceeded  ebs.csi.aws.com  Successfully provisioned volume pvc-8f2c1a', 'Normal  SuccessfulAttachVolume  attachdetach-controller  AttachVolume.Attach succeeded for volume "pvc-8f2c1a"'];
  const pods: VolumeResult['pods'] = [];
  let fix = 'Tudo certo.';
  if (i.nonRootWithoutFsGroup) {
    pods.push({ name: 'web-0', status: 'CrashLoopBackOff', ok: false });
    events.push('logs: mkdir: can\'t create directory \'/data/uploads\': Permission denied');
    fix = 'O volume foi montado com dono root e a aplicação roda como usuário 1000. Defina securityContext.fsGroup: 1000 (e runAsUser) no Pod para o kubelet ajustar a permissão do volume.';
  } else pods.push({ name: 'web-0', status: 'Running', ok: true });
  if (i.secondReplicaOtherNode) {
    pods.push({ name: 'web-1 (mesmo PVC, outro nó)', status: 'ContainerCreating', ok: false });
    events.push('Warning  FailedAttachVolume  attachdetach-controller  Multi-Attach error for volume "pvc-8f2c1a" Volume is already exclusively attached to one node and can\'t be attached to another');
    fix = `${fix === 'Tudo certo.' ? '' : `${fix} `}Volumes ReadWriteOnce só se anexam a um nó. Use um PVC por réplica (StatefulSet com volumeClaimTemplates), afinidade para o mesmo nó, ou storage RWX (NFS/EFS/CephFS).`;
  }
  return { pvc: 'Bound', pods, events, fix };
}

export default function TsVolumeSim() {
  const [i, setI] = useState<VolumeInput>({ storageClass: 'ok', provisioner: 'up', secondReplicaOtherNode: true, nonRootWithoutFsGroup: false, quotaExceeded: false });
  const r = volumeCheck(i);
  const set = (p: Partial<VolumeInput>) => setI((x) => ({ ...x, ...p }));

  return (
    <SimFrame title="PersistentVolumeClaim data-web-0 · StorageClass fast-ssd (RWO)">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Choice label="StorageClass fast-ssd" value={i.storageClass} onChange={(v) => set({ storageClass: v })} options={[{ value: 'ok', label: 'existe' }, { value: 'missing', label: 'não existe' }]} />
          <Choice label="Driver CSI (provisionador)" value={i.provisioner} onChange={(v) => set({ provisioner: v })} options={[{ value: 'up', label: 'rodando' }, { value: 'down', label: 'fora do ar' }]} />
          <Toggle checked={i.quotaExceeded} onChange={(v) => set({ quotaExceeded: v })}><span className="text-xs">ResourceQuota de storage estourada</span></Toggle>
          <Toggle checked={i.secondReplicaOtherNode} onChange={(v) => set({ secondReplicaOtherNode: v })}><span className="text-xs">2ª réplica usa o mesmo PVC em outro nó</span></Toggle>
          <Toggle checked={i.nonRootWithoutFsGroup} onChange={(v) => set({ nonRootWithoutFsGroup: v })}><span className="text-xs">App roda como UID 1000, sem fsGroup</span></Toggle>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">PVC: <Badge tone={r.pvc === 'Bound' ? 'green' : 'red'}>{r.pvc}</Badge></div>
          <div className="mt-2 space-y-1">
            {r.pods.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded border border-tactical-border px-3 py-1.5 font-mono text-xs">
                <span>{p.name}</span><Badge tone={p.ok ? 'green' : 'red'}>{p.status}</Badge>
              </div>
            ))}
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{r.events.join('\n')}</pre>
          <div className="mt-3 rounded-md border-l-4 border-signal-cyan bg-signal-cyan/10 px-4 py-2 text-sm text-tactical-dim"><strong>Correção:</strong> {r.fix}</div>
        </div>
      </div>
    </SimFrame>
  );
}
