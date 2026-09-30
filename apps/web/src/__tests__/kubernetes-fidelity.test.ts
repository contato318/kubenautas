import { describe, expect, it } from 'vitest';
import { initialCron, stepCron, tickCron } from '../components/simulators/CronJobSim';
import { initialLifecycle, stepLifecycle } from '../components/simulators/PodLifecycleSim';
import { initialHpa, stepHpa } from '../components/simulators/HpaSim';
import { initialDeployment, stepDeployment } from '../components/simulators/DeploymentSim';
import { initialRollout, stepRollout } from '../components/simulators/RollingUpdateSim';
import { initialStorage, reconcile, deleteClaim, type PVC } from '../components/simulators/StorageSim';
import { qosClass, simulateNode } from '../components/simulators/QosSim';
import { evaluate, PODS, POLICIES, type Policy } from '../components/simulators/NetworkPolicySim';
import { reach } from '../components/simulators/HdNetpolMatrixSim';
import { buildConfig, parseUrl, routeRequest } from '../components/simulators/GatewayApiSim';
import { pathMatches } from '../components/simulators/IngressSim';
import { sendRequest } from '../components/simulators/ServiceSim';
import { execute, initialCluster, podStatus, reconcile as reconcileCluster } from '../components/simulators/cluster';
import { tokenExposure, tokenYaml } from '../components/simulators/HdTokenSim';
import { auditLevel, matches, REQUESTS } from '../components/simulators/HdAuditPolicySim';
import { runtimeOutcome } from '../components/simulators/HdRuntimeSim';
import { anonAssess } from '../components/simulators/PtAnonSim';
import { findPath } from '../components/simulators/PtPrivescSim';
import { reachable, TARGETS } from '../components/simulators/PtLateralSim';
import { buildCrd, type CrdInput } from '../components/simulators/OpCrdBuilderSim';
import { validateCR } from '../components/simulators/OpSchemaSim';
import { checkOperator, PERMS } from '../components/simulators/OpRbacSim';
import { simulateRetries } from '../components/simulators/OpKopfRetriesSim';
import { parse } from 'yaml';

const advance = <S,>(s: S, step: (s: S) => S, count: number): S => {
  for (let i = 0; i < count; i++) s = step(s);
  return s;
};

describe('CronJob / Job: Kubernetes 1.34, restartPolicy Never', () => {
  it('usa os defaults e não dispara antes do primeiro horário', () => {
    expect(initialCron().backoffLimit).toBe(6);
    expect(stepCron(initialCron()).jobs).toHaveLength(0);
    expect(advance(initialCron(), stepCron, 2).jobs[0].scheduledAt).toBe(2);
  });
  it('preserva o template dos Jobs já criados', () => {
    const started = advance(initialCron(), stepCron, 2);
    const changed = stepCron({ ...started, duration: 1, backoffLimit: 0 });
    expect(changed.jobs[0]).toMatchObject({ duration: 3, backoffLimit: 6, status: 'Running' });
    const next = stepCron(changed);
    expect(next.jobs[1]).toMatchObject({ duration: 1, backoffLimit: 0 });
  });
  it('Forbid recupera o último horário perdido após a conclusão', () => {
    const s = advance({ ...initialCron(), policy: 'Forbid' as const }, stepCron, 5);
    expect(s.jobs.find((j) => j.name === 'backup-2')?.status).toBe('Complete');
    expect(s.jobs.find((j) => j.name === 'backup-4')).toMatchObject({ scheduledAt: 4, attemptStart: 300 });
    expect(s.skipped).toBe(1);
  });
  it('respeita atrasos de 10s e 20s antes de criar os próximos Pods', () => {
    let s = advance({ ...initialCron(), every: 1, duration: 1, failing: true, policy: 'Forbid' as const }, stepCron, 2);
    expect(s.jobs[0]).toMatchObject({ attempt: 1, retryAt: 130 });
    s = tickCron(s);
    expect(s.jobs[0]).toMatchObject({ attempt: 2, attemptStart: 130, retryAt: undefined });
    s = advance(s, tickCron, 6);
    expect(s.jobs[0].retryAt).toBe(210);
    expect(tickCron(s).jobs[0].attempt).toBe(2);
    expect(advance(s, tickCron, 2).jobs[0].attempt).toBe(3);
  });
  it('backoffLimit=0 falha no primeiro Pod', () => {
    const s = advance({ ...initialCron(), every: 1, duration: 1, failing: true, backoffLimit: 0 }, stepCron, 2);
    expect(s.jobs[0]).toMatchObject({ status: 'Failed', attempt: 1 });
  });
  it('limita o atraso de falhas de Pod a 600s no controlador v1.34', () => {
    let s: ReturnType<typeof initialCron> = { ...initialCron(), every: 1, duration: 1, failing: true, backoffLimit: 10, policy: 'Forbid' as const };
    for (let i = 0; i < 250 && !(s.jobs[0]?.attempt === 7 && s.jobs[0].retryAt); i++) s = tickCron(s);
    expect(s.jobs[0].retryAt! - s.second).toBe(600);
  });
  it('não duplica horários e conserva somente o histórico configurado', () => {
    const s = advance({ ...initialCron(), every: 1, duration: 1 }, stepCron, 30);
    expect(s.jobs.filter((j) => j.status === 'Complete')).toHaveLength(3);
    expect(new Set(s.jobs.map((j) => j.scheduledAt)).size).toBe(s.jobs.length);
  });
});

describe('controladores e recursos', () => {
  it('HPA limita o primeiro crescimento a +4 Pods e o seguinte a 100%', () => {
    const s = advance({ ...initialHpa(), load: 2000, max: 15 }, stepHpa, 3);
    expect(s.pods).toHaveLength(6);
    expect(advance(s, stepHpa, 3).pods).toHaveLength(12);
  });
  it('HPA conserva o maior cálculo nos últimos 300 segundos', () => {
    const peak = advance({ ...initialHpa(), load: 1000 }, stepHpa, 9);
    expect(peak.pods).toHaveLength(10);
    const cooling = advance({ ...peak, load: 0 }, stepHpa, 57);
    expect(cooling.pods).toHaveLength(10);
    expect(advance(cooling, stepHpa, 3).pods).toHaveLength(2);
  });
  it('HPA não ultrapassa maxReplicas após mudança de limite', () => {
    const peak = advance({ ...initialHpa(), load: 1000 }, stepHpa, 9);
    expect(advance({ ...peak, max: 5, load: 0 }, stepHpa, 3).pods).toHaveLength(5);
  });
  it('HPA conserva réplicas na borda da tolerância de 10%', () => {
    expect(advance({ ...initialHpa(), load: 220 }, stepHpa, 3).pods).toHaveLength(2);
  });
  it('nó perdido mantém Pod Terminating enquanto o ReplicaSet cria outro', () => {
    const initial = initialDeployment();
    const victim = initial.pods[0];
    const down = { ...initial, nodes: initial.nodes.map((n) => ({ ...n, ready: n.name !== victim.node })) };
    const s = advance(down, stepDeployment, 20);
    expect(s.pods.find((p) => p.name === victim.name)?.phase).toBe('Terminating');
    expect(s.pods.filter((p) => p.phase === 'Running')).toHaveLength(3);
    const recovered = advance({ ...s, nodes: s.nodes.map((n) => ({ ...n, ready: true })) }, stepDeployment, 2);
    expect(recovered.pods.some((p) => p.name === victim.name)).toBe(false);
  });
  it.each([0, 1, 2])('rollout preserva disponibilidade com maxUnavailable=%i', (unavailable) => {
    let s: ReturnType<typeof initialRollout> = { ...initialRollout(), target: 'v2' as const, maxUnavailable: unavailable };
    for (let i = 0; i < 25; i++) {
      s = stepRollout(s);
      expect(s.pods.filter((p) => p.phase !== 'Terminating').length).toBeLessThanOrEqual(5);
      expect(s.pods.filter((p) => p.phase === 'Ready').length).toBeGreaterThanOrEqual(4 - unavailable);
    }
    expect(s.pods.every((p) => p.version === 'v2' && p.phase === 'Ready')).toBe(true);
  });
  it('QoS exige limites iguais em CPU e memória; configuração inválida não agenda', () => {
    const pod = { name: 'web', request: 512, limit: 512, usage: 100, priority: 0 };
    expect(qosClass(pod)).toBe('Burstable');
    expect(qosClass({ ...pod, cpuRequest: 200, cpuLimit: 200 })).toBe('Guaranteed');
    expect(qosClass({ ...pod, request: 0, limit: 0, cpuRequest: 200 })).toBe('Burstable');
    expect(simulateNode([{ ...pod, request: 1024 }])).toMatchObject({ invalid: ['web'], usage: 0 });
  });
});

describe('volumes', () => {
  const pvc: PVC = { name: 'data', size: 1, accessMode: 'RWO', storageClass: 'fast-ssd', phase: 'Pending', hasConsumer: false };
  it('WaitForFirstConsumer também adia o binding de PV estático', () => {
    const s = { pvs: [{ ...initialStorage().pvs[0], storageClass: 'fast-ssd' }], pvcs: [pvc] };
    expect(reconcile(s).state.pvcs[0].phase).toBe('Pending');
    expect(reconcile({ ...s, pvcs: [{ ...pvc, hasConsumer: true }] }).state.pvcs[0].volume).toBe('pv-a');
  });
  it('pvc-protection adia exclusão e reclaim até o Pod ser removido', () => {
    const bound = reconcile({ pvs: [], pvcs: [{ ...pvc, hasConsumer: true }] }).state;
    const deleting = deleteClaim(bound, 'data').state;
    expect(deleting.pvcs[0].deleting).toBe(true);
    expect(deleting.pvs).toHaveLength(1);
    const removed = reconcile({ ...deleting, pvcs: deleting.pvcs.map((p) => ({ ...p, hasConsumer: false })) }).state;
    expect(removed.pvcs).toHaveLength(0);
    expect(removed.pvs).toHaveLength(0);
  });
  it('classe inexistente fica Pending, sem lançar exceção', () => {
    expect(reconcile({ pvs: [], pvcs: [{ ...pvc, storageClass: 'missing' }] }).state.pvcs[0].message).toContain('não encontrada');
  });
});

describe('rede', () => {
  const api = PODS.find((p) => p.id === 'api')!;
  const external = PODS.find((p) => p.external)!;
  it('peer {} e ports [] significam todos', () => {
    const p: Policy = { ...POLICIES[0], ingress: [{ peers: [{}], ports: [] }] };
    expect(evaluate(external, api, 8080, [p]).allowed).toBe(true);
    expect(evaluate(external, api, 8080, [{ ...p, ingress: [{ peers: [{ labels: {} }] }] }]).allowed).toBe(false);
  });
  it('Pod pode se comunicar consigo mesmo sob default-deny', () => {
    expect(evaluate(api, api, 80, [POLICIES[0], POLICIES[4]]).allowed).toBe(true);
  });
  it('allow DNS sozinho também isola egress', () => {
    expect(reach(new Set(['allowDns']), 'api', 'internet')).toBe(false);
    expect(reach(new Set(['allowDns']), 'api', 'kube-dns')).toBe(true);
  });
  it('allow frontend isola ingress da API mesmo sem default-deny', () => {
    expect(reach(new Set(['allowFrontToApi']), 'db', 'api')).toBe(false);
    expect(reach(new Set(['allowFrontToApi']), 'frontend', 'api')).toBe(true);
  });
  it('ipBlock amplo inclui outros destinos IPv4 e except não é um deny global', () => {
    expect(reach(new Set(['allowApiInternet', 'denyEgress']), 'api', 'db')).toBe(true);
    expect(reach(new Set(['blockMetadata']), 'api', 'metadata')).toBe(true);
    expect(reach(new Set(['allowApiInternet', 'blockMetadata']), 'api', 'metadata')).toBe(false);
  });
  it('Prefix respeita os segmentos, inclusive barras internas', () => {
    expect(pathMatches('/foo/bar', 'Prefix', '/foo//bar')).toBe(false);
    expect(pathMatches('/foo/', 'Prefix', '/foo/bar')).toBe(true);
    expect(pathMatches('/', 'Prefix', '/foo/bar')).toBe(true);
    expect(pathMatches('/foo', 'Prefix', '/foobar')).toBe(false);
  });
  it('Service sem endpoints falha na conexão, sem inventar resposta HTTP 503', () => {
    const s = sendRequest({ pods: [], rr: 0, lastHit: null, ok: 0, failed: 0, log: [] });
    expect(JSON.stringify(s.log)).toContain('connection refused');
    expect(JSON.stringify(s.log)).not.toContain('503');
  });
  it.each(['web', 'loja', 'kube-system'] as const)('default-deny bloqueia todos os alvos em %s', (pos) => {
    expect(TARGETS.every((t) => !reachable(pos, t.id, { defaultDeny: true, metadataBlocked: false, nsIsolation: false, egressRestricted: false }))).toBe(true);
  });
});

describe('terminal', () => {
  const cmd = (s: ReturnType<typeof initialCluster>, c: string) => execute(`kubectl ${c}`, s).state;
  it('admite Pods Pending e os agenda após uncordon, preservando identidade', () => {
    let s = initialCluster();
    for (const n of s.nodes) s = cmd(s, `cordon ${n.name}`);
    s = cmd(s, 'create deploy web --image=nginx --replicas=2');
    s = cmd(s, 'run debug --image=busybox');
    expect(s.pods).toHaveLength(3);
    expect(s.pods.every((p) => podStatus(p, s.now + 10000) === 'Pending')).toBe(true);
    expect(execute('kubectl describe pod debug', s).output).toContain('FailedScheduling');
    const names = s.pods.map((p) => p.name);
    s = reconcileCluster(cmd(s, 'uncordon worker-1'));
    expect(s.pods.map((p) => p.name)).toEqual(names);
    expect(s.pods.every((p) => p.node === 'worker-1')).toBe(true);
    expect(s.pods.every((p) => podStatus(p, s.now) === 'ContainerCreating')).toBe(true);
  });
  it('get nome e seletor run retornam só o Pod correto', () => {
    const s = cmd(cmd(initialCluster(), 'run a --image=nginx'), 'run b --image=nginx');
    expect(execute('kubectl get pod/a', s).output.split('\n')).toHaveLength(2);
    expect(execute('kubectl get pods -l run=b', s).output).toMatch(/\nb\s/);
    expect(execute('kubectl get pod missing', s).error).toBe(true);
    expect(execute('kubectl get pods -l unknown=b', s).output).toContain('No resources');
  });
  it('contagem de ReplicaSet e rollout é isolada por namespace', () => {
    let s = cmd(initialCluster(), 'create ns other');
    s = cmd(s, 'create deploy web --image=nginx --replicas=3');
    s = cmd(s, 'create deploy web --image=nginx --replicas=1 -n other');
    s = { ...s, pods: s.pods.map((p) => p.namespace === 'default' ? { ...p, created: p.created - 10000 } : p) };
    expect(execute('kubectl rollout status deploy/web -n other', s).output).toContain('0 of 1');
    expect(execute('kubectl describe deploy web -n other', s).output).toContain('1 desired | 1 updated');
    for (const kind of ['rs', 'svc', 'deploy']) expect(execute(`kubectl get ${kind} -A`, s).output).toContain('NAMESPACE');
  });
  it('valida namespace, portas e revisão de rollback', () => {
    const s = cmd(initialCluster(), 'create deploy web --image=nginx:1');
    expect(execute('kubectl run bad --image=nginx -n missing', s).error).toBe(true);
    expect(execute('kubectl expose deploy web --port=70000', s).error).toBe(true);
    expect(execute('kubectl delete ns missing', s).error).toBe(true);
    const revisions = cmd(cmd(s, 'set image deploy/web nginx=nginx:2'), 'set image deploy/web nginx=nginx:3');
    expect(execute('kubectl rollout undo deploy/web --to-revision=1', revisions).state.pods[0].image).toBe('nginx:1');
    expect(execute('kubectl rollout undo deploy/web --to-revision=9', revisions).error).toBe(true);
  });
});

describe('segurança: permissões e evidências', () => {
  it('view não concede Secrets; edit concede e anonymous-auth=false retorna 401', () => {
    const cfg = { anonymousAuth: true, anonBoundView: true, unauthBoundEdit: false, discoveryOpen: false };
    expect(anonAssess(cfg).find((p) => p.cmd.includes('secrets'))?.ok).toBe(false);
    expect(anonAssess({ ...cfg, unauthBoundEdit: true }).find((p) => p.cmd.includes('secrets'))?.ok).toBe(true);
    expect(anonAssess({ ...cfg, anonymousAuth: false }).every((p) => p.result === '401 Unauthorized')).toBe(true);
  });
  it.each(['ns-token-min', 'ns-exec'] as const)('%s não ganha create Pods implicitamente', (start) => {
    expect(findPath(start, { podSecurity: 'none', privilegedSaInNs: false, nodeMetadataOpen: true, editBoundToDevs: false }).hops).toHaveLength(0);
  });
  it('PSS restricted não impede criar Pod com SA privilegiada do namespace', () => {
    expect(findPath('ns-create-pods', { podSecurity: 'restricted', privilegedSaInNs: true, nodeMetadataOpen: false, editBoundToDevs: false }).reachedAdmin).toBe(true);
  });
  it('token Vault usa projeção explícita sem montar segundo token para API', () => {
    const cfg = { kind: 'projected' as const, automount: true, audience: 'vault' as const, expirationSeconds: 600, rbac: 'cluster-admin' as const };
    const spec = parse(tokenYaml(cfg)).spec;
    expect(spec.automountServiceAccountToken).toBe(false);
    expect(spec.volumes[0].projected.sources[0].serviceAccountToken.audience).toBe('vault');
    expect(spec.containers[0].volumeMounts[0].name).toBe('token');
    expect(parse(tokenYaml({ ...cfg, automount: false })).spec.volumes).toBeUndefined();
    expect(tokenExposure({ ...cfg, kind: 'legacy' }).apiUsable).toBe(true);
  });
  it('auditoria combina usuário/verbo com nonResourceURLs; GET não tem corpo de Secret', () => {
    const q = REQUESTS.find((r) => r.nonResource)!;
    expect(matches({ level: 'None', nonResource: true, users: ['maria'], note: '' }, q)).toBe(false);
    expect(matches({ level: 'Metadata', users: [], verbs: [], resources: [], note: '' }, q)).toBe(true);
    expect(auditLevel([{ level: 'Request', note: '' }], REQUESTS[0]).warning).toBeUndefined();
    expect(auditLevel([{ level: 'RequestResponse', note: '' }], REQUESTS[0]).warning).toContain('Secret');
  });
  it('rootfs somente leitura não bloqueia execução em memória ou volume', () => {
    expect(runtimeOutcome('miner', new Set(['readOnlyRoot'])).outcome).toBe('unnoticed');
    expect(runtimeOutcome('write-bin', new Set(['readOnlyRoot'])).outcome).toBe('prevented');
  });
});

describe('operadores', () => {
  const crd: CrdInput = { group: 'db.example.com', version: 'v1', kind: 'Database', plural: 'databases', singular: 'database', shortName: 'db', scope: 'Namespaced' };
  it('kind pode começar com minúscula e singular omitido recebe default', () => {
    const result = buildCrd({ ...crd, kind: 'database', singular: '' });
    expect(result.errors).toEqual([]);
    expect(parse(result.yaml).spec.names.singular).toBe('database');
  });
  it.each([{ group: 'db..example.com' }, { plural: '1databases' }, { shortName: 'a'.repeat(64) }, { version: '1alpha' }])('rejeita nomes inválidos %j', (patch) => {
    expect(buildCrd({ ...crd, ...patch }).errors.length).toBeGreaterThan(0);
  });
  it('null não nullable é removido antes dos defaults, inclusive em Strict', () => {
    const result = validateCR({ spec: { engine: 'postgres', storageGB: 1, replicas: null, backup: null } }, { fieldValidation: 'Strict', op: 'create', oldStorageGB: 0 });
    expect(result.accepted).toBe(true);
    expect(result.stored?.spec).toEqual({ engine: 'postgres', storageGB: 1, replicas: 1 });
  });
  it('Kopf pausa ambas as réplicas com prioridade padrão igual', () => {
    const cfg = { granted: new Set(PERMS.map((p) => p.id)), scope: 'cluster' as const, replicas: 2 as const, peering: 'installed' as const };
    expect(checkOperator(cfg).healthy).toBe(false);
    expect(checkOperator(cfg).logs.some((l) => l.text.includes('ambas pausadas'))).toBe(true);
    expect(checkOperator({ ...cfg, distinctPriorities: true }).healthy).toBe(true);
  });
  it('retries=0 não executa o handler, nem mesmo um resultado de sucesso', () => {
    expect(simulateRetries(['ok'], { retries: 0, backoff: 60, temporaryDelay: 10, sideEffectBeforeFailure: false, idempotent: true }).final).toBe('failed');
  });
});


describe('relógio do kubelet', () => {
  it('primeira falha aguarda 10s antes de contar o primeiro restart', () => {
    let s = initialLifecycle('crash');
    while (s.container !== 'terminated') s = stepLifecycle(s);
    expect(s.restarts).toBe(0);
    expect(s.backoff).toBe(10);
    const failedAt = s.t;
    s = advance(s, stepLifecycle, 9);
    expect(s.restarts).toBe(0);
    s = stepLifecycle(s);
    expect(s.restarts).toBe(1);
    expect(s.t - failedAt).toBe(10);
  });
  it('10min saudável zera backoff sem zerar o contador de reinícios', () => {
    const s = advance({ ...initialLifecycle(), scheduled: true, imagePulled: true, container: 'running' as const, phaseTime: 598, failures: 5, restarts: 5 }, stepLifecycle, 2);
    expect(s.failures).toBe(0);
    expect(s.restarts).toBe(5);
  });
  it('readiness falhando não reinicia o container', () => {
    const s = advance(initialLifecycle('readiness'), stepLifecycle, 120);
    expect(s.container).toBe('running');
    expect(s.restarts).toBe(0);
    expect(s.ready).toBe(false);
  });
  it('retentativas de pull aumentam o atraso sem contar restart', () => {
    const first = advance(initialLifecycle('image'), stepLifecycle, 2);
    expect(first.backoff).toBe(10);
    const second = advance(first, stepLifecycle, 10);
    expect(second.backoff).toBe(20);
    expect(second.restarts).toBe(0);
  });
});


describe('Gateway API routing', () => {
  const config = () => buildConfig({ allowedFrom: 'All', referenceGrant: true, canary: 10 });
  const request = (url: string) => ({ ...parseUrl(url)!, method: 'GET', headers: {} });
  it('redirect substitui prefixos completos e mantém a query string', () => {
    const cfg = config();
    const rule = cfg.routes.find((r) => r.name === 'vitrine')!.rules[0];
    rule.matches[0].path = '/promo/';
    expect(routeRequest(cfg, request('https://www.loja.com/promo/natal?coupon=x')).location).toBe('https://www.loja.com/ofertas/natal?coupon=x');
    rule.filters = [{ type: 'RequestRedirect', replacePrefix: '', statusCode: 301 }];
    expect(routeRequest(cfg, request('https://www.loja.com/promo/natal')).location).toBe('https://www.loja.com/natal');
  });
  it('hostname curinga mais específico vence independentemente da criação', () => {
    const cfg = config();
    const base = cfg.routes.find((r) => r.name === 'api')!;
    cfg.routes = [{ ...base, name: 'broad', hostnames: ['*.loja.com'], created: 1 }, { ...base, name: 'specific', hostnames: ['*.sub.loja.com'], created: 2 }];
    expect(routeRequest(cfg, request('https://a.sub.loja.com/')).route?.name).toBe('specific');
  });
  it('sem listener não inventa uma resposta HTTP 404', () => {
    expect(routeRequest(config(), request('https://www.loja.com:9443/')).status).toBe(0);
  });
});
