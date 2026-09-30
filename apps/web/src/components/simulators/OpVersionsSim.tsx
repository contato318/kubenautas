import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Várias versões de um CRD: served, storage, storedVersions e conversão (None × Webhook). */

export type Ver = 'v1alpha1' | 'v1beta1' | 'v1';
export type VerState = 'served' | 'unserved' | 'removed';
export interface VersionsCfg {
  versions: Record<Ver, VerState>;
  storage: Ver;
  conversion: 'None' | 'Webhook';
  webhookUp: boolean;
  migrated: boolean; // objetos regravados na versão de storage e storedVersions ajustado
}
export interface VersionsResult {
  storedVersions: Ver[];
  crdErrors: string[];
  requests: { req: string; ok: boolean; warn?: boolean; msg: string }[];
}

export const VERS: Ver[] = ['v1alpha1', 'v1beta1', 'v1'];
/** v1alpha1 usa spec.size; v1beta1 e v1 usam spec.storage.size. */
const needsRealConversion = (a: Ver, b: Ver) => a !== b && (a === 'v1alpha1' || b === 'v1alpha1');

export function evaluateVersions(c: VersionsCfg): VersionsResult {
  const storedVersions: Ver[] = c.migrated ? [c.storage] : [...new Set<Ver>(['v1alpha1', c.storage])];
  const crdErrors: string[] = [];
  if (c.versions[c.storage] === 'removed') crdErrors.push('spec.versions: Invalid value: …: must have exactly one version marked as storage version');
  storedVersions.forEach((v, i) => {
    if (c.versions[v] === 'removed') crdErrors.push(`status.storedVersions[${i}]: Invalid value: "${v}": must appear in spec.versions`);
  });
  if (crdErrors.length) return { storedVersions, crdErrors, requests: [] };

  // Objetos existentes: um antigo (gravado em v1alpha1, a menos que migrado) e um novo (na versão de storage).
  const objects: Ver[] = [c.migrated ? c.storage : 'v1alpha1', c.storage];
  const requests: VersionsResult['requests'] = [];
  const webhookErr = `conversion webhook for db.exemplo.com/${c.storage}, Kind=Database failed: Post "https://db-operator-webhook.db-system.svc:443/convert?timeout=30s": dial tcp 10.96.12.7:443: connect: connection refused`;

  for (const v of VERS) {
    if (c.versions[v] === 'removed') continue;
    const req = `kubectl get databases.${v}.db.exemplo.com`;
    if (c.versions[v] === 'unserved') {
      requests.push({ req, ok: false, msg: 'error: the server doesn\'t have a resource type "databases" nessa versão (served: false)' });
      continue;
    }
    const conv = objects.filter((o) => needsRealConversion(o, v));
    const anyConv = objects.some((o) => o !== v);
    if (anyConv && c.conversion === 'Webhook' && !c.webhookUp) requests.push({ req, ok: false, msg: webhookErr });
    else if (conv.length && c.conversion === 'None')
      requests.push({ req, ok: true, warn: true, msg: `Responde, mas com conversão None só o apiVersion muda: objetos gravados em outra versão não têm campos renomeados. Campos fora do schema podem ser removidos por pruning: risco de perda de dados` });
    else requests.push({ req, ok: true, msg: anyConv ? `2 objetos (convertidos pelo ${c.conversion === 'Webhook' ? 'webhook' : 'API server'})` : '2 objetos, sem conversão' });
  }
  const write = `kubectl apply -f db-v1.yaml`;
  if (c.versions.v1 !== 'served') requests.push({ req: write, ok: false, msg: 'no matches for kind "Database" in version "db.exemplo.com/v1"' });
  else if (c.storage !== 'v1' && c.conversion === 'Webhook' && !c.webhookUp) requests.push({ req: write, ok: false, msg: webhookErr });
  else requests.push({ req: write, ok: true, msg: `gravado no etcd como ${c.storage}` });
  return { storedVersions, crdErrors, requests };
}

export default function OpVersionsSim() {
  const [c, setC] = useState<VersionsCfg>({ versions: { v1alpha1: 'served', v1beta1: 'served', v1: 'served' }, storage: 'v1', conversion: 'Webhook', webhookUp: true, migrated: false });
  const r = evaluateVersions(c);
  const set = (p: Partial<VersionsCfg>) => setC((x) => ({ ...x, ...p }));
  const opts = [{ value: 'served' as VerState, label: 'served: true' }, { value: 'unserved' as VerState, label: 'served: false' }, { value: 'removed' as VerState, label: 'removida do CRD' }];

  return (
    <SimFrame title="CRD databases.db.exemplo.com · versões" toolbar={<span className="font-mono text-[11px] text-tactical-label">storedVersions: [{r.storedVersions.join(', ')}]</span>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {VERS.map((v) => <Choice key={v} label={v} value={c.versions[v]} onChange={(s) => set({ versions: { ...c.versions, [v]: s } })} options={opts} />)}
          <Choice label="storage: true em" value={c.storage} onChange={(v) => set({ storage: v })} options={VERS.map((v) => ({ value: v, label: v }))} />
          <Choice label="spec.conversion.strategy" value={c.conversion} onChange={(v) => set({ conversion: v })} options={[{ value: 'Webhook', label: 'Webhook' }, { value: 'None', label: 'None' }]} />
          <Toggle checked={c.webhookUp} onChange={(v) => set({ webhookUp: v })}><span className="text-xs">Webhook de conversão no ar</span></Toggle>
          <Toggle checked={c.migrated} onChange={(v) => set({ migrated: v })}><span className="text-xs">Migração feita: objetos regravados e <code>status.storedVersions</code> atualizado</span></Toggle>
        </div>
        <div className="min-w-0">
          {r.crdErrors.length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-md border border-signal-red/60 bg-signal-red/10 p-3 font-mono text-[11px] text-signal-red">
              {'The CustomResourceDefinition "databases.db.exemplo.com" is invalid:\n' + r.crdErrors.map((e) => `* ${e}`).join('\n')}
            </pre>
          ) : (
            <ul className="space-y-2">
              {r.requests.map((q) => (
                <li key={q.req} className="rounded-md border border-tactical-border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs"><span>$ {q.req}</span><Badge tone={!q.ok ? 'red' : q.warn ? 'amber' : 'green'}>{!q.ok ? 'erro' : q.warn ? 'cuidado' : 'ok'}</Badge></div>
                  <div className={`mt-1 break-words font-mono text-[11px] ${!q.ok ? 'text-signal-red' : q.warn ? 'text-signal-amber' : 'text-tactical-dim'}`}>{q.msg}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-tactical-label">
            Cenário: existe um objeto antigo gravado em v1alpha1 (<code>spec.size</code>) e um novo na versão de storage (<code>spec.storage.size</code>). Para remover
            v1alpha1 do CRD, primeiro regrave todos os objetos na versão atual e tire v1alpha1 de <code>status.storedVersions</code>.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
