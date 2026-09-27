import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Quais handlers do Kopf disparam para cada acontecimento com o objeto. */

export type HandlerKind = 'create' | 'update' | 'field' | 'delete' | 'resume' | 'event';
export type KEvent = 'create' | 'update-replicas' | 'update-image' | 'labels' | 'status' | 'restart-unchanged' | 'restart-changed' | 'delete';

export const HANDLERS: { id: HandlerKind; code: string; label: string }[] = [
  { id: 'create', code: "@kopf.on.create('databases')", label: 'on.create' },
  { id: 'update', code: "@kopf.on.update('databases')", label: 'on.update' },
  { id: 'field', code: "@kopf.on.update('databases', field='spec.replicas')", label: "on.update(field='spec.replicas')" },
  { id: 'delete', code: "@kopf.on.delete('databases')", label: 'on.delete' },
  { id: 'resume', code: "@kopf.on.resume('databases')", label: 'on.resume' },
  { id: 'event', code: "@kopf.on.event('databases')", label: 'on.event (baixo nível)' },
];

export const EVENTS: { id: KEvent; label: string }[] = [
  { id: 'create', label: 'kubectl apply (objeto novo)' },
  { id: 'update-replicas', label: 'Mudar spec.replicas' },
  { id: 'update-image', label: 'Mudar spec.image' },
  { id: 'labels', label: 'Adicionar um label' },
  { id: 'status', label: 'Alguém muda só o status' },
  { id: 'restart-unchanged', label: 'Operador reinicia (objeto sem mudanças)' },
  { id: 'restart-changed', label: 'Operador reinicia (replicas mudou enquanto estava parado)' },
  { id: 'delete', label: 'kubectl delete' },
];

export interface Dispatch {
  fired: HandlerKind[];
  notes: string[];
  finalizer: boolean;
  deletedImmediately?: boolean;
}

export function dispatch(ev: KEvent, h: Set<HandlerKind>): Dispatch {
  const finalizer = h.has('delete');
  const fired: HandlerKind[] = [];
  const notes: string[] = [];
  const add = (k: HandlerKind) => h.has(k) && fired.push(k);
  switch (ev) {
    case 'create':
      add('create');
      if (finalizer) notes.push('O Kopf adiciona o finalizer kopf.zalando.org/KopfFinalizerMarker porque existe um on.delete.');
      break;
    case 'update-replicas':
      add('update');
      add('field');
      notes.push('O diff (old/new) é calculado contra a anotação kopf.zalando.org/last-handled-configuration.');
      break;
    case 'update-image':
      add('update');
      notes.push('O handler com field=spec.replicas não dispara: esse campo não mudou.');
      break;
    case 'labels':
      add('update');
      notes.push('Labels e anotações fazem parte da "essência" do objeto; as anotações do próprio Kopf são ignoradas.');
      break;
    case 'status':
      notes.push('Status não faz parte da essência: nenhum handler de mudança dispara. Isso evita loops quando o operador grava o status.');
      break;
    case 'restart-unchanged':
      add('resume');
      notes.push('Sem diff contra last-handled-configuration: on.update não roda. on.resume serve para reconstruir estado em memória (conexões, tarefas).');
      break;
    case 'restart-changed':
      add('resume');
      add('update');
      add('field');
      notes.push('O Kopf compara com last-handled-configuration e percebe a mudança que aconteceu enquanto estava parado.');
      break;
    case 'delete':
      if (finalizer) {
        add('delete');
        notes.push('Com o finalizer, o objeto fica com deletionTimestamp até o on.delete terminar; depois o Kopf remove o finalizer e o objeto some.');
      } else {
        notes.push('Sem on.delete, não há finalizer: o objeto some na hora e o operador não tem chance de limpar nada (use ownerReferences para filhos).');
      }
      break;
  }
  add('event');
  if (h.has('event')) notes.push('on.event recebe todo evento do watch (inclusive os patches do próprio Kopf), sem retentativas nem estado.');
  if (!fired.length) notes.unshift('Nenhum handler disparou.');
  return { fired, notes, finalizer, deletedImmediately: ev === 'delete' && !finalizer };
}

export default function OpKopfHandlersSim() {
  const [h, setH] = useState<Set<HandlerKind>>(new Set(['create', 'update', 'delete']));
  const [ev, setEv] = useState<KEvent>('create');
  const r = dispatch(ev, h);
  const toggle = (k: HandlerKind, v: boolean) => setH((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });

  const code = `import kopf

${HANDLERS.filter((x) => h.has(x.id)).map((x) => `${x.code}
def ${x.id === 'field' ? 'replicas' : x.id}_fn(spec, ${x.id === 'update' || x.id === 'field' ? 'old, new, diff, ' : ''}name, namespace, logger, **kwargs):
    logger.info("${x.label}: %s/%s", namespace, name)${x.id === 'create' ? '\n    return {"phase": "Provisioning"}   # vai para status.create_fn' : ''}`).join('\n\n')}`;

  return (
    <SimFrame title="kopf run operator.py · roteamento de eventos para handlers">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <div className="label">Handlers registrados</div>
          {HANDLERS.map((x) => <Toggle key={x.id} checked={h.has(x.id)} onChange={(v) => toggle(x.id, v)}><span className="font-mono text-xs">{x.label}</span></Toggle>)}
        </div>
        <div className="min-w-0">
          <div className="label mb-2">O que acontece com o objeto</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {EVENTS.map((e) => <button key={e.id} className={`rounded border px-2 py-1 text-xs ${ev === e.id ? 'border-k8s-500 bg-k8s-500/10 text-white' : 'border-tactical-border text-tactical-dim'}`} onClick={() => setEv(e.id)}>{e.label}</button>)}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="label">disparam:</span>
            {r.fired.length ? r.fired.map((f) => <Badge key={f} tone="green">{HANDLERS.find((x) => x.id === f)!.label}</Badge>) : <Badge tone="dim">nenhum</Badge>}
            {r.finalizer && <Badge tone="amber">finalizer no objeto</Badge>}
          </div>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-tactical-dim">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{code}</pre>
        </div>
      </div>
    </SimFrame>
  );
}
