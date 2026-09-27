import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** O que acontece ao apagar um Custom Resource: finalizers, handler de delete e garbage collection por ownerReferences. */

export type Propagation = 'Background' | 'Foreground' | 'Orphan';
export interface DeleteOpts {
  operatorRunning: boolean;
  deleteHandler: boolean; // @kopf.on.delete → finalizer no CR
  adoptChildren: boolean; // kopf.adopt() → ownerReferences nos filhos
  propagation: Propagation;
}
export interface DeleteResult {
  steps: string[];
  remaining: { name: string; why: string }[];
  crDeleted: boolean;
}

const CHILDREN = ['Deployment/pedidos-db', 'ReplicaSet/pedidos-db-7c9d', 'Pod/pedidos-db-7c9d-x2k', 'Service/pedidos-db', 'Secret/pedidos-db-cred'];
const EXTERNAL = 'Backup no bucket externo (s3://backups/pedidos)';

export function deleteFlow(o: DeleteOpts): DeleteResult {
  const steps: string[] = [`kubectl delete database pedidos --cascade=${o.propagation.toLowerCase()}`, 'API server grava metadata.deletionTimestamp (o objeto ainda existe)'];
  const remaining: DeleteResult['remaining'] = [];
  let childrenGone = false;
  let externalGone = false;

  if (o.propagation === 'Foreground' && o.adoptChildren) {
    steps.push('Foreground: finalizer foregroundDeletion no CR; o garbage collector apaga os dependentes primeiro (Pods → ReplicaSet → Deployment, Service, Secret)');
    childrenGone = true;
  }

  let crDeleted = true;
  if (o.deleteHandler) {
    if (o.operatorRunning) {
      steps.push('Kopf recebe o evento com deletionTimestamp e chama o on.delete: remove o backup externo');
      steps.push('Handler terminou com sucesso: o Kopf remove o finalizer kopf.zalando.org/KopfFinalizerMarker');
      externalGone = true;
    } else {
      steps.push('Finalizer kopf.zalando.org/KopfFinalizerMarker presente, mas o operador está parado: ninguém o remove');
      crDeleted = false;
    }
  } else {
    steps.push('Nenhum finalizer do operador: nada impede a remoção');
  }

  if (crDeleted) {
    steps.push('Lista de finalizers vazia: o CR é removido do etcd');
    if (o.adoptChildren && !childrenGone) {
      if (o.propagation === 'Background') {
        steps.push('Background: o garbage collector encontra filhos cujo dono não existe mais e os apaga em cascata');
        childrenGone = true;
      } else if (o.propagation === 'Orphan') {
        steps.push('Orphan: o GC remove as ownerReferences dos filhos e os deixa vivos');
      }
    }
  }

  if (!crDeleted) remaining.push({ name: 'Database/pedidos', why: 'Terminating para sempre — o finalizer só sai com o operador rodando (ou removido à mão)' });
  if (!childrenGone) {
    const why = !o.adoptChildren ? 'sem ownerReferences: o GC não sabe que pertencem ao CR' : o.propagation === 'Orphan' ? 'órfãos por escolha (--cascade=orphan)' : 'o dono ainda existe (Terminating)';
    CHILDREN.forEach((c) => remaining.push({ name: c, why }));
  }
  if (!externalGone) remaining.push({ name: EXTERNAL, why: o.deleteHandler ? 'o on.delete ainda não rodou' : 'o Kubernetes não sabe que ele existe — só um handler de delete limparia' });
  return { steps, remaining, crDeleted };
}

export default function OpFinalizersSim() {
  const [o, setO] = useState<DeleteOpts>({ operatorRunning: true, deleteHandler: true, adoptChildren: false, propagation: 'Background' });
  const r = deleteFlow(o);
  const set = (p: Partial<DeleteOpts>) => setO((x) => ({ ...x, ...p }));

  return (
    <SimFrame title="kubectl delete database pedidos" toolbar={<Badge tone={r.remaining.length ? 'amber' : 'green'}>{r.remaining.length ? `${r.remaining.length} sobrando` : 'limpo'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Toggle checked={o.deleteHandler} onChange={(v) => set({ deleteHandler: v })}><span className="text-xs"><code>@kopf.on.delete</code> registrado (finalizer)</span></Toggle>
          <Toggle checked={o.operatorRunning} onChange={(v) => set({ operatorRunning: v })}><span className="text-xs">Operador rodando</span></Toggle>
          <Toggle checked={o.adoptChildren} onChange={(v) => set({ adoptChildren: v })}><span className="text-xs">Filhos criados com <code>kopf.adopt()</code> (ownerReferences)</span></Toggle>
          <Choice label="propagationPolicy (--cascade)" value={o.propagation} onChange={(v) => set({ propagation: v })} options={[{ value: 'Background', label: 'background (padrão)' }, { value: 'Foreground', label: 'foreground' }, { value: 'Orphan', label: 'orphan' }]} />
        </div>
        <div className="min-w-0">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-tactical-dim">{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="label mb-1 mt-4">Ainda existe depois</div>
          {r.remaining.length === 0 ? (
            <div className="text-sm text-signal-green">Nada — CR, filhos e recurso externo foram limpos.</div>
          ) : (
            <ul className="space-y-1">
              {r.remaining.map((x) => (
                <li key={x.name} className="flex flex-wrap items-center justify-between gap-2 rounded border border-tactical-border px-3 py-1.5 text-xs">
                  <span className="font-mono">{x.name}</span><span className="text-signal-amber">{x.why}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SimFrame>
  );
}
