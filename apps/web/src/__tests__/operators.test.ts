import { describe, expect, it } from 'vitest';
import { operatorsModule } from '../content/operatorsModule';
import { operatorsCaseMeta } from '../content/operatorsCases';
import { simulators } from '../components/simulators/registry';
import { applyActions, diff } from '../components/simulators/OpReconcileSim';
import { buildCrd, type CrdInput } from '../components/simulators/OpCrdBuilderSim';
import { validateCR } from '../components/simulators/OpSchemaSim';
import { INITIAL, health, step, type StatusCfg } from '../components/simulators/OpStatusSim';
import { dispatch, type HandlerKind } from '../components/simulators/OpKopfHandlersSim';
import { simulateRetries, type RetryOpts } from '../components/simulators/OpKopfRetriesSim';
import { deleteFlow } from '../components/simulators/OpFinalizersSim';
import { evaluateVersions, type VersionsCfg } from '../components/simulators/OpVersionsSim';
import { checkOperator, type Perm } from '../components/simulators/OpRbacSim';

describe('módulo de operators', () => {
  it('9 lições, 10 perguntas cada, um simulador diferente por lição', () => {
    const { lessons } = operatorsModule;
    expect(lessons).toHaveLength(9);
    lessons.forEach((l) => {
      expect(l.quiz).toHaveLength(10);
      expect(l.content.length).toBeGreaterThan(3000);
      expect(simulators.some((s) => s.id === l.simulator)).toBe(true);
    });
    expect(new Set(lessons.map((l) => l.simulator)).size).toBe(9);
  });
  it('12 casos, todos com simulador existente', () => {
    expect(operatorsCaseMeta).toHaveLength(12);
    operatorsCaseMeta.forEach((c) => expect(simulators.some((s) => s.id === c.simulator)).toBe(true));
  });
});

describe('reconcile', () => {
  it('converge a partir de qualquer estado e fica estável (idempotente)', () => {
    let n = 0;
    const name = () => `p${n++}`;
    const spec = { replicas: 3, image: 'b' };
    let pods = [{ name: 'x', image: 'a' }, { name: 'y', image: 'b' }, { name: 'z', image: 'a' }, { name: 'w', image: 'a' }];
    pods = applyActions(pods, diff(spec, pods), name);
    expect(pods).toHaveLength(3);
    expect(pods.every((p) => p.image === 'b')).toBe(true);
    expect(pods.some((p) => p.name === 'y')).toBe(true);
    expect(diff(spec, pods)).toEqual([]);
  });
});

describe('montador de CRD', () => {
  const ok: CrdInput = { group: 'db.exemplo.com', version: 'v1', kind: 'Database', plural: 'databases', singular: 'database', shortName: 'db', scope: 'Namespaced' };
  it('nome e caminhos corretos', () => {
    const r = buildCrd(ok);
    expect(r.errors).toEqual([]);
    expect(r.name).toBe('databases.db.exemplo.com');
    expect(r.paths[0]).toBe('/apis/db.exemplo.com/v1/namespaces/{namespace}/databases');
    expect(buildCrd({ ...ok, scope: 'Cluster' }).paths[0]).toBe('/apis/db.exemplo.com/v1/databases');
  });
  it('rejeita grupo sem ponto, plural maiúsculo e grupos protegidos', () => {
    expect(buildCrd({ ...ok, group: 'databases' }).errors[0]).toContain('at least one dot');
    expect(buildCrd({ ...ok, plural: 'Databases' }).errors[0]).toContain('spec.names.plural');
    expect(buildCrd({ ...ok, group: 'policy.k8s.io' }).errors.join()).toContain('api-approved');
  });
});

describe('schema e CEL', () => {
  const base = { apiVersion: 'db.exemplo.com/v1', kind: 'Database', metadata: { name: 'pedidos' } };
  const opts = { fieldValidation: 'Ignore' as const, op: 'create' as const, oldStorageGB: 100 };
  it('aplica defaults e aceita objeto válido', () => {
    const r = validateCR({ ...base, spec: { engine: 'postgres', storageGB: 50 } }, opts);
    expect(r.accepted).toBe(true);
    expect((r.stored as { spec: { replicas: number } }).spec.replicas).toBe(1);
  });
  it('pruning silencioso × strict', () => {
    const doc = { ...base, spec: { engine: 'postgres', storageGB: 50, storageGb: 9 } };
    const r = validateCR(doc, opts);
    expect(r.accepted).toBe(true);
    expect(r.pruned).toEqual(['spec.storageGb']);
    expect(validateCR(doc, { ...opts, fieldValidation: 'Strict' }).errors[0]).toContain('unknown field "spec.storageGb"');
  });
  it('enum, tipo, required, CEL e transição', () => {
    expect(validateCR({ ...base, spec: { engine: 'mongo', storageGB: 5 } }, opts).errors[0]).toContain('Unsupported value: "mongo"');
    expect(validateCR({ ...base, spec: { engine: 'postgres', storageGB: '5' } }, opts).errors[0]).toContain('must be of type integer');
    expect(validateCR({ ...base, spec: { engine: 'postgres' } }, opts).errors[0]).toContain('spec.storageGB: Required value');
    expect(validateCR({ ...base, spec: { engine: 'mysql', replicas: 5, storageGB: 5 } }, opts).errors[0]).toContain('no máximo 3');
    expect(validateCR({ ...base, spec: { engine: 'postgres', storageGB: 50 } }, { ...opts, op: 'update' }).errors[0]).toContain('não pode diminuir');
  });
});

describe('status e observedGeneration', () => {
  const run = (cfg: StatusCfg, ...acts: Parameters<typeof step>[1][]) => acts.reduce((s, a) => step(s, a, cfg).state, INITIAL);
  it('com subrecurso e observedGeneration: status confiável', () => {
    const cfg = { statusSubresource: true, writesObservedGeneration: true };
    const s = run(cfg, 'edit-spec', 'reconcile-ok');
    expect(s.generation).toBe(2);
    expect(health(s, cfg).trustworthy).toBe(true);
    expect(health(run(cfg, 'edit-spec'), cfg).tone).toBe('red'); // Ready antigo
  });
  it('sem subrecurso, escrever status incrementa generation', () => {
    const cfg = { statusSubresource: false, writesObservedGeneration: true };
    expect(run(cfg, 'reconcile-ok').generation).toBe(1); // idempotent write
    expect(run(cfg, 'reconcile-fail').generation).toBe(2);
  });
  it('PATCH de status no endpoint principal é ignorado com o subrecurso', () => {
    const cfg = { statusSubresource: true, writesObservedGeneration: true };
    const s = run(cfg, 'reconcile-fail', 'status-via-main');
    expect(s.ready).toBe('False');
  });
  it('labels não mudam generation', () => {
    expect(run({ statusSubresource: true, writesObservedGeneration: true }, 'edit-label').generation).toBe(1);
  });
});

describe('handlers do Kopf', () => {
  const all = new Set<HandlerKind>(['create', 'update', 'field', 'delete', 'resume']);
  it('roteamento', () => {
    expect(dispatch('update-replicas', all).fired).toEqual(['update', 'field']);
    expect(dispatch('update-image', all).fired).toEqual(['update']);
    expect(dispatch('status', all).fired).toEqual([]);
    expect(dispatch('restart-unchanged', all).fired).toEqual(['resume']);
    expect(dispatch('restart-changed', all).fired).toEqual(['resume', 'update', 'field']);
  });
  it('finalizer só com on.delete', () => {
    expect(dispatch('create', all).finalizer).toBe(true);
    expect(dispatch('delete', new Set<HandlerKind>(['create'])).deletedImmediately).toBe(true);
  });
});

describe('retentativas', () => {
  const o: RetryOpts = { retries: null, backoff: 60, temporaryDelay: 10, sideEffectBeforeFailure: false, idempotent: false };
  it('backoff e TemporaryError somam o tempo', () => {
    const r = simulateRetries(['exception', 'temporary', 'ok'], o);
    expect(r.final).toBe('succeeded');
    expect(r.attempts.map((a) => a.t)).toEqual([0, 60, 70]);
  });
  it('PermanentError e limite de retries', () => {
    expect(simulateRetries(['permanent', 'ok'], o).final).toBe('failed');
    const r = simulateRetries(['exception', 'exception', 'ok'], { ...o, retries: 2 });
    expect(r.final).toBe('failed');
    expect(r.attempts.at(-1)!.text).toContain('exceeded the number of retries');
  });
  it('efeito colateral + não idempotente = 409 para sempre', () => {
    expect(simulateRetries(['exception', 'ok', 'ok'], { ...o, sideEffectBeforeFailure: true }).final).toBe('retrying');
    expect(simulateRetries(['exception', 'ok'], { ...o, sideEffectBeforeFailure: true, idempotent: true }).final).toBe('succeeded');
  });
});

describe('finalizers e GC', () => {
  it('tudo certo: nada sobra', () => {
    expect(deleteFlow({ operatorRunning: true, deleteHandler: true, adoptChildren: true, propagation: 'Background' }).remaining).toEqual([]);
  });
  it('operador parado com finalizer: CR preso', () => {
    const r = deleteFlow({ operatorRunning: false, deleteHandler: true, adoptChildren: true, propagation: 'Background' });
    expect(r.crDeleted).toBe(false);
    expect(r.remaining[0].name).toBe('Database/pedidos');
  });
  it('foreground apaga filhos mesmo com o CR preso; sem adopt eles sobram', () => {
    const fg = deleteFlow({ operatorRunning: false, deleteHandler: true, adoptChildren: true, propagation: 'Foreground' });
    expect(fg.remaining.some((x) => x.name.startsWith('Deployment'))).toBe(false);
    const orphan = deleteFlow({ operatorRunning: true, deleteHandler: true, adoptChildren: false, propagation: 'Background' });
    expect(orphan.remaining.some((x) => x.name.startsWith('Deployment'))).toBe(true);
  });
  it('sem on.delete o recurso externo vaza', () => {
    const r = deleteFlow({ operatorRunning: true, deleteHandler: false, adoptChildren: true, propagation: 'Background' });
    expect(r.remaining.map((x) => x.name)).toEqual(['Backup no bucket externo (s3://backups/pedidos)']);
  });
});

describe('versões', () => {
  const base: VersionsCfg = { versions: { v1alpha1: 'served', v1beta1: 'served', v1: 'served' }, storage: 'v1', conversion: 'Webhook', webhookUp: true, migrated: false };
  it('remover versão ainda em storedVersions é rejeitado; após migração, aceito', () => {
    const cfg = { ...base, versions: { ...base.versions, v1alpha1: 'removed' as const } };
    expect(evaluateVersions(cfg).crdErrors[0]).toContain('must appear in spec.versions');
    expect(evaluateVersions({ ...cfg, migrated: true }).crdErrors).toEqual([]);
  });
  it('webhook fora quebra leituras que exigem conversão', () => {
    const r = evaluateVersions({ ...base, webhookUp: false });
    expect(r.requests.find((x) => x.req.includes('.v1.'))!.ok).toBe(false);
    expect(evaluateVersions({ ...base, webhookUp: false, migrated: true }).requests.find((x) => x.req.includes('.v1.'))!.ok).toBe(true);
  });
  it('conversão None com schemas diferentes gera alerta', () => {
    expect(evaluateVersions({ ...base, conversion: 'None' }).requests.find((x) => x.req.includes('.v1.'))!.warn).toBe(true);
  });
});

describe('operator em produção', () => {
  const allPerms = new Set<Perm>(['cr-watch', 'cr-patch', 'status-patch', 'children', 'events', 'namespaces', 'crds', 'peering']);
  it('com tudo e peering: saudável', () => {
    expect(checkOperator({ granted: allPerms, scope: 'cluster', replicas: 2, peering: 'installed', distinctPriorities: true }).healthy).toBe(true);
  });
  it('duas réplicas sem peering duplicam', () => {
    const r = checkOperator({ granted: allPerms, scope: 'cluster', replicas: 2, peering: 'absent' });
    expect(r.duplicates).toBe(true);
    expect(r.logs.some((l) => l.text.includes('falling back to the standalone mode'))).toBe(true);
  });
  it('sem patch no recurso: 403', () => {
    const g = new Set(allPerms);
    g.delete('cr-patch');
    const r = checkOperator({ granted: g, scope: 'namespace', replicas: 1, peering: 'standalone' });
    expect(r.healthy).toBe(false);
    expect(r.logs.at(-1)!.text).toContain('cannot patch resource "databases"');
  });
});
