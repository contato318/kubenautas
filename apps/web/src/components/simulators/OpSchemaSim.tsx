import { useState } from 'react';
import { parse } from 'yaml';
import { Badge, Choice, SimFrame } from './kit';

/**
 * Validação de um Custom Resource contra um schema estrutural:
 * pruning de campos desconhecidos → defaults → tipos/enum/pattern/limites → regras CEL.
 */

export type FieldValidation = 'Strict' | 'Warn' | 'Ignore';
export interface SchemaResult {
  accepted: boolean;
  errors: string[];
  warnings: string[];
  pruned: string[];
  defaulted: string[];
  stored: Record<string, unknown> | null;
}

type Prop = { type: 'string' | 'integer' | 'boolean' | 'object'; enum?: string[]; pattern?: string; minimum?: number; maximum?: number; default?: unknown; properties?: Record<string, Prop>; required?: string[] };

export const SPEC_SCHEMA: Prop = {
  type: 'object',
  required: ['engine', 'storageGB'],
  properties: {
    engine: { type: 'string', enum: ['postgres', 'mysql'] },
    version: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
    storageGB: { type: 'integer', minimum: 1, maximum: 1000 },
    replicas: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
    backup: {
      type: 'object',
      properties: { enabled: { type: 'boolean', default: false }, retentionDays: { type: 'integer', minimum: 1, maximum: 365 } },
    },
  },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v === 'number' ? 'number' : typeof v);

/** Remove campos desconhecidos e aplica defaults (in place), anotando o que fez. */
function pruneAndDefault(obj: Record<string, unknown>, schema: Prop, path: string, pruned: string[], defaulted: string[]) {
  for (const k of Object.keys(obj)) {
    const p = schema.properties?.[k];
    if (!p) {
      pruned.push(`${path}.${k}`);
      delete obj[k];
    } else if (obj[k] === null) delete obj[k]; // known, non-nullable field: prune before defaulting
    else if (p.type === 'object' && isObj(obj[k])) pruneAndDefault(obj[k] as Record<string, unknown>, p, `${path}.${k}`, pruned, defaulted);
  }
  for (const [k, p] of Object.entries(schema.properties ?? {})) {
    if (obj[k] === undefined && p.default !== undefined) {
      obj[k] = p.default;
      defaulted.push(`${path}.${k}=${JSON.stringify(p.default)}`);
    }
  }
}

function check(v: unknown, p: Prop, path: string, errors: string[]) {
  const t = typeOf(v);
  if (t !== p.type) {
    errors.push(`${path}: Invalid value: "${t}": ${path} in body must be of type ${p.type}: "${t}"`);
    return;
  }
  if (p.enum && !p.enum.includes(v as string)) errors.push(`${path}: Unsupported value: "${v}": supported values: ${p.enum.map((e) => `"${e}"`).join(', ')}`);
  if (p.pattern && !new RegExp(p.pattern).test(v as string)) errors.push(`${path}: Invalid value: "${v}": ${path} in body should match '${p.pattern}'`);
  if (p.minimum !== undefined && (v as number) < p.minimum) errors.push(`${path}: Invalid value: ${v}: ${path} in body should be greater than or equal to ${p.minimum}`);
  if (p.maximum !== undefined && (v as number) > p.maximum) errors.push(`${path}: Invalid value: ${v}: ${path} in body should be less than or equal to ${p.maximum}`);
  if (p.type === 'object') {
    const o = v as Record<string, unknown>;
    for (const r of p.required ?? []) if (o[r] === undefined) errors.push(`${path}.${r}: Required value`);
    for (const [k, sub] of Object.entries(p.properties ?? {})) if (o[k] !== undefined) check(o[k], sub, `${path}.${k}`, errors);
  }
}

export function validateCR(doc: unknown, opts: { fieldValidation: FieldValidation; op: 'create' | 'update'; oldStorageGB: number }): SchemaResult {
  const res: SchemaResult = { accepted: false, errors: [], warnings: [], pruned: [], defaulted: [], stored: null };
  if (!isObj(doc) || !isObj(doc.spec)) {
    res.errors.push('spec: Required value');
    return res;
  }
  const name = isObj(doc.metadata) && typeof doc.metadata.name === 'string' ? doc.metadata.name : 'sem-nome';
  const obj = structuredClone(doc) as Record<string, unknown>;
  const spec = obj.spec as Record<string, unknown>;
  const pruned: string[] = [];
  pruneAndDefault(spec, SPEC_SCHEMA, 'spec', pruned, res.defaulted);
  for (const k of Object.keys(obj)) if (!['apiVersion', 'kind', 'metadata', 'spec', 'status'].includes(k)) {
    pruned.push(k);
    delete obj[k];
  }

  if (pruned.length && opts.fieldValidation === 'Strict') {
    res.errors.push(...pruned.map((p) => `strict decoding error: unknown field "${p}"`));
    res.errors = [`Error from server (BadRequest): error when creating "db.yaml": Database in version "v1" cannot be handled as a Database: ${res.errors.join(', ')}`];
    return res;
  }
  if (opts.fieldValidation === 'Warn') res.warnings.push(...pruned.map((p) => `Warning: unknown field "${p}"`));
  res.pruned = pruned;

  const errors: string[] = [];
  check(spec, SPEC_SCHEMA, 'spec', errors);
  // Regras CEL (x-kubernetes-validations), avaliadas só se os tipos estão corretos.
  if (!errors.length) {
    if (spec.engine === 'mysql' && (spec.replicas as number) > 3) errors.push('spec: Invalid value: "object": mysql suporta no máximo 3 réplicas');
    const b = spec.backup as Record<string, unknown> | undefined;
    if (b && b.enabled === true && b.retentionDays === undefined) errors.push('spec.backup: Invalid value: "object": retentionDays é obrigatório quando enabled=true');
    if (opts.op === 'update' && (spec.storageGB as number) < opts.oldStorageGB) errors.push(`spec.storageGB: Invalid value: "integer": storageGB não pode diminuir (antes: ${opts.oldStorageGB})`);
  }
  if (errors.length) {
    res.errors = [`The Database "${name}" is invalid: ${errors.length > 1 ? `[${errors.join(', ')}]` : errors[0]}`];
    return res;
  }
  res.accepted = true;
  res.stored = obj;
  return res;
}

const PRESETS: Record<string, string> = {
  'Válido': `apiVersion: db.exemplo.com/v1
kind: Database
metadata:
  name: pedidos
spec:
  engine: postgres
  version: "16"
  storageGB: 50`,
  'Enum inválido': `apiVersion: db.exemplo.com/v1
kind: Database
metadata:
  name: pedidos
spec:
  engine: mongo
  storageGB: 50`,
  'Campo com typo': `apiVersion: db.exemplo.com/v1
kind: Database
metadata:
  name: pedidos
spec:
  engine: postgres
  storageGb: 50
  storageGB: 20
  backup:
    enabled: true
    retentionDay: 7`,
  'Tipo errado': `apiVersion: db.exemplo.com/v1
kind: Database
metadata:
  name: pedidos
spec:
  engine: postgres
  version: 16
  storageGB: "50"`,
  'Regra CEL': `apiVersion: db.exemplo.com/v1
kind: Database
metadata:
  name: pedidos
spec:
  engine: mysql
  replicas: 5
  storageGB: 50`,
};

export default function OpSchemaSim() {
  const [src, setSrc] = useState(PRESETS['Campo com typo']);
  const [fv, setFv] = useState<FieldValidation>('Ignore');
  const [op, setOp] = useState<'create' | 'update'>('create');
  let doc: unknown = null;
  let parseErr = '';
  try {
    doc = parse(src);
  } catch (e) {
    parseErr = (e as Error).message;
  }
  const r = parseErr ? null : validateCR(doc, { fieldValidation: fv, op, oldStorageGB: 100 });

  return (
    <SimFrame title="kubectl apply -f db.yaml · schema estrutural + CEL" toolbar={r && <Badge tone={r.accepted ? 'green' : 'red'}>{r.accepted ? 'aceito' : 'rejeitado'}</Badge>}>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((k) => <button key={k} className="btn-ghost px-2 py-1 text-xs" onClick={() => setSrc(PRESETS[k])}>{k}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <textarea value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} rows={14} className="w-full rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs text-tactical-text" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice label="--validate (fieldValidation)" value={fv} onChange={setFv} options={[{ value: 'Strict', label: 'strict (padrão do kubectl)' }, { value: 'Warn', label: 'warn' }, { value: 'Ignore', label: 'ignore / clientes antigos' }]} />
            <Choice label="operação" value={op} onChange={setOp} options={[{ value: 'create', label: 'create' }, { value: 'update', label: 'update (antes: storageGB 100)' }]} />
          </div>
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          {parseErr && <div className="rounded border border-signal-red/60 bg-signal-red/10 p-2 font-mono text-xs text-signal-red">YAML inválido: {parseErr}</div>}
          {r?.errors.map((e) => <pre key={e} className="whitespace-pre-wrap rounded border border-signal-red/60 bg-signal-red/10 p-2 font-mono text-[11px] text-signal-red">{e}</pre>)}
          {r?.warnings.map((w) => <div key={w} className="font-mono text-xs text-signal-amber">{w}</div>)}
          {r && r.pruned.length > 0 && <div className="rounded border border-signal-amber/60 bg-signal-amber/10 px-3 py-2 text-xs text-signal-amber">✂ Removidos em silêncio (pruning): {r.pruned.join(', ')}</div>}
          {r && r.defaulted.length > 0 && <div className="rounded border border-signal-cyan/60 bg-signal-cyan/10 px-3 py-2 text-xs text-signal-cyan">Defaults aplicados: {r.defaulted.join(', ')}</div>}
          {r?.stored && (
            <>
              <div className="label">O que foi gravado no etcd (spec)</div>
              <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] text-signal-green">{JSON.stringify((r.stored as { spec: unknown }).spec, null, 2)}</pre>
            </>
          )}
          <p className="text-xs text-tactical-label">
            Ordem no API server: pruning de campos desconhecidos → defaults → validação OpenAPI → regras CEL (<code>x-kubernetes-validations</code>). Com
            <code> ignore</code>, um typo como <code>storageGb</code> é descartado sem erro — e o valor que você achou que configurou nunca chega ao operador.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
