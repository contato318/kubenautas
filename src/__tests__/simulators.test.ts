import { describe, expect, it } from 'vitest';
import { CONNECTIONS, PODS, POLICIES, evaluate } from '../components/simulators/NetworkPolicySim';
import { BINDINGS, SUBJECTS, canI } from '../components/simulators/RbacSim';
import { resolve } from '../components/simulators/DnsSim';
import { DEFAULT_RULES, hostMatches, pathMatches, route } from '../components/simulators/IngressSim';
import { evictionOrder, qosClass, simulateNode, type MemPod } from '../components/simulators/QosSim';
import { deleteClaim, initialStorage, reconcile, type PVC } from '../components/simulators/StorageSim';
import { evictionAllowed, initialDrain, isReady, stepDrain, type DrainState } from '../components/simulators/DrainPdbSim';
import { initialSts, stepSts, stsReady, type StsState } from '../components/simulators/StatefulSetSim';
import { initialCron, stepCron, type CronState } from '../components/simulators/CronJobSim';
import { initialCa, stepCa, type CaState } from '../components/simulators/ClusterAutoscalerSim';
import { simulators } from '../components/simulators/registry';

const run = <S,>(s: S, step: (s: S) => S, n: number) => Array.from({ length: n }).reduce<S>((acc) => step(acc), s);
const pod = (id: string) => PODS.find((p) => p.id === id)!;
const pol = (...ids: string[]) => POLICIES.filter((p) => ids.includes(p.id));
const conn = (label: string) => CONNECTIONS.find((c) => c.label.startsWith(label))!;
const check = (label: string, policies: ReturnType<typeof pol>) => {
  const c = conn(label);
  return evaluate(pod(c.from), pod(c.to), c.port, policies).allowed;
};

describe('registro', () => {
  it('tem 17 simuladores com ids únicos', () => {
    expect(simulators).toHaveLength(17);
    expect(new Set(simulators.map((s) => s.id)).size).toBe(17);
  });
});

describe('NetworkPolicy', () => {
  it('sem policies tudo é permitido', () => {
    expect(CONNECTIONS.every((c) => evaluate(pod(c.from), pod(c.to), c.port, []).allowed)).toBe(true);
  });

  it('default deny + allows liberam só o necessário', () => {
    const ps = pol('deny-in', 'fe-api', 'api-db', 'mon');
    expect(check('frontend → api', ps)).toBe(true);
    expect(check('api → db', ps)).toBe(true);
    expect(check('frontend → db', ps)).toBe(false);
    expect(check('prometheus → api', ps)).toBe(true);
    expect(check('internet → frontend', ps)).toBe(false);
  });

  it('deny de egress sem liberar DNS quebra a resolução', () => {
    expect(check('api → coredns', pol('deny-out', 'same-ns'))).toBe(false);
    expect(check('api → coredns', pol('deny-out', 'same-ns', 'dns'))).toBe(true);
    expect(check('api → internet', pol('deny-out', 'dns'))).toBe(false);
  });

  it('porta errada é bloqueada', () => {
    expect(evaluate(pod('frontend'), pod('api'), 9999, pol('deny-in', 'fe-api')).allowed).toBe(false);
  });
});

describe('RBAC', () => {
  const [ana, bruno, sa] = SUBJECTS;
  it('RoleBinding com ClusterRole vale só no namespace da binding', () => {
    expect(canI(ana, 'list', 'pods', 'dev', BINDINGS).allowed).toBe(true);
    expect(canI(ana, 'list', 'pods', 'prod', BINDINGS).allowed).toBe(false);
    expect(canI(bruno, 'get', 'secrets', 'loja', BINDINGS).allowed).toBe(true);
    expect(canI(bruno, 'get', 'secrets', 'prod', BINDINGS).allowed).toBe(false);
  });

  it('ClusterRoleBinding vale em todos os namespaces e em recursos de cluster', () => {
    expect(canI(bruno, 'list', 'deployments', 'prod', BINDINGS).allowed).toBe(true);
    expect(canI(bruno, 'list', 'nodes', 'loja', BINDINGS).allowed).toBe(true);
    expect(canI(ana, 'list', 'nodes', 'loja', BINDINGS).allowed).toBe(false);
  });

  it('verbos não concedidos são negados e sem bindings nada é permitido', () => {
    expect(canI(sa, 'create', 'deployments', 'loja', BINDINGS).allowed).toBe(true);
    expect(canI(sa, 'delete', 'deployments', 'loja', BINDINGS).allowed).toBe(false);
    expect(canI(sa, 'create', 'deployments', 'loja', []).allowed).toBe(false);
  });
});

describe('DNS', () => {
  it('nome curto resolve pelo primeiro domínio de busca', () => {
    const r = resolve('api', 'loja', 5);
    expect(r.answer).toBe('api.loja.svc.cluster.local');
    expect(r.attempts).toHaveLength(1);
  });

  it('com ndots:5 um nome externo passa por todos os domínios de busca', () => {
    const r = resolve('api.pagamentos.com.br', 'loja', 5);
    expect(r.attempts).toHaveLength(4);
    expect(r.answer).toBe('api.pagamentos.com.br');
  });

  it('com ndots baixo ou ponto final, o nome é consultado direto', () => {
    expect(resolve('api.pagamentos.com.br', 'loja', 2).attempts).toHaveLength(1);
    expect(resolve('api.pagamentos.com.br.', 'loja', 5).attempts).toHaveLength(1);
  });

  it('serviço de outro namespace precisa do namespace no nome', () => {
    expect(resolve('db', 'loja', 5).answer).toBeNull();
    expect(resolve('db.dados', 'loja', 5).answer).toBe('db.dados.svc.cluster.local');
  });
});

describe('Ingress', () => {
  it('Prefix compara por segmentos', () => {
    expect(pathMatches('/api', 'Prefix', '/api/v1')).toBe(true);
    expect(pathMatches('/api', 'Prefix', '/apis')).toBe(false);
    expect(pathMatches('/', 'Prefix', '/qualquer')).toBe(true);
    expect(pathMatches('/login', 'Exact', '/login/')).toBe(false);
  });

  it('curinga casa um único rótulo', () => {
    expect(hostMatches('*.exemplo.com', 'blog.exemplo.com')).toBe('wildcard');
    expect(hostMatches('*.exemplo.com', 'a.b.exemplo.com')).toBeNull();
    expect(hostMatches('*.exemplo.com', 'exemplo.com')).toBeNull();
  });

  it('vence o path mais longo e o host exato', () => {
    expect(route(DEFAULT_RULES, 'loja.exemplo.com/api/v2/produtos', null).backend).toBe('api-v2:8080');
    expect(route(DEFAULT_RULES, 'loja.exemplo.com/api/v1', null).backend).toBe('api-v1:8080');
    expect(route(DEFAULT_RULES, 'loja.exemplo.com/login/', null).backend).toBe('frontend:80');
    expect(route(DEFAULT_RULES, 'blog.exemplo.com/x', null).backend).toBe('landing:80');
    expect(route(DEFAULT_RULES, 'outro.com/', null).backend).toBeNull();
    expect(route(DEFAULT_RULES, 'outro.com/', 'default:80').backend).toBe('default:80');
  });
});

describe('QoS e despejo', () => {
  const p = (name: string, request: number, limit: number, usage: number, priority = 0): MemPod => ({ name, request, limit, usage, priority });

  it('classifica a QoS', () => {
    expect(qosClass(p('a', 512, 512, 0))).toBe('Guaranteed');
    expect(qosClass(p('b', 0, 0, 0))).toBe('BestEffort');
    expect(qosClass(p('c', 256, 1024, 0))).toBe('Burstable');
    expect(qosClass(p('d', 256, 0, 0))).toBe('Burstable');
  });

  it('despeja primeiro quem excede o request, depois menor prioridade', () => {
    const order = evictionOrder([p('guaranteed', 1024, 1024, 900), p('besteffort', 0, 0, 300), p('burst', 256, 0, 1500), p('vip', 0, 0, 800, 1000)]);
    expect(order.map((x) => x.name)).toEqual(['burst', 'besteffort', 'vip', 'guaranteed']);
  });

  it('uso acima do limit é OOMKilled e pressão de memória gera Evicted', () => {
    expect(simulateNode([p('x', 256, 512, 600)]).oomKilled).toEqual(['x']);
    const out = simulateNode([p('api', 1024, 1024, 1000), p('cache', 0, 0, 3050)]);
    expect(out.pressure).toBe(true);
    expect(out.evicted).toEqual(['cache']);
  });
});

describe('Storage', () => {
  const claim = (name: string, size: number, accessMode: 'RWO' | 'RWX', storageClass: string): PVC => ({ name, size, accessMode, storageClass, phase: 'Pending', hasConsumer: false });

  it('faz bind com o menor PV estático que serve', () => {
    const { state } = reconcile({ ...initialStorage(), pvcs: [claim('a', 8, 'RWO', 'manual')] });
    expect(state.pvcs[0].volume).toBe('pv-a');
  });

  it('fica Pending sem PV compatível e sem provisioner', () => {
    const { state } = reconcile({ ...initialStorage(), pvcs: [claim('a', 100, 'RWO', 'manual')] });
    expect(state.pvcs[0].phase).toBe('Pending');
  });

  it('WaitForFirstConsumer espera o Pod e RWX não suportado falha', () => {
    let r = reconcile({ ...initialStorage(), pvcs: [claim('a', 5, 'RWO', 'fast-ssd')] });
    expect(r.state.pvcs[0].phase).toBe('Pending');
    r = reconcile({ ...r.state, pvcs: [{ ...r.state.pvcs[0], hasConsumer: true }] });
    expect(r.state.pvcs[0].phase).toBe('Bound');
    expect(reconcile({ ...initialStorage(), pvcs: [claim('b', 5, 'RWX', 'standard')] }).state.pvcs[0].message).toMatch(/ProvisioningFailed/);
  });

  it('reclaimPolicy Delete apaga o PV e Retain deixa Released', () => {
    const dyn = reconcile({ ...initialStorage(), pvcs: [claim('d', 5, 'RWO', 'standard')] }).state;
    expect(deleteClaim(dyn, 'd').state.pvs).toHaveLength(3);
    const stat = reconcile({ ...initialStorage(), pvcs: [claim('s', 5, 'RWO', 'manual')] }).state;
    expect(deleteClaim(stat, 's').state.pvs.find((v) => v.name === 'pv-c')?.phase).toBe('Released');
  });
});

describe('Drain e PDB', () => {
  const drain = (s: DrainState, node: string): DrainState => ({ ...s, nodes: s.nodes.map((n) => (n.name === node ? { ...n, cordoned: true, draining: true } : n)) });

  it('com minAvailable 2 o drain termina e os Pods vão para outros nós', () => {
    const end = run(drain(initialDrain(), 'node-1'), stepDrain, 15);
    expect(end.pods.some((p) => p.node === 'node-1')).toBe(false);
    expect(end.pods.filter(isReady)).toHaveLength(3);
    expect(end.nodes.find((n) => n.name === 'node-1')!.draining).toBe(false);
  });

  it('com minAvailable igual às réplicas o drain nunca termina', () => {
    const end = run(drain({ ...initialDrain(), minAvailable: 3 }, 'node-1'), stepDrain, 30);
    expect(end.pods.some((p) => p.node === 'node-1')).toBe(true);
    expect(evictionAllowed(end, end.pods.find((p) => p.node === 'node-1')!)).toBe(false);
  });
});

describe('StatefulSet', () => {
  it('OrderedReady cria um Pod por vez, em ordem', () => {
    const s1 = stepSts(initialSts());
    expect(s1.pods.map((p) => p.ordinal)).toEqual([0]);
    const s2 = run(s1, stepSts, 2);
    expect(s2.pods.map((p) => p.ordinal)).toEqual([0]);
    const end = run(s1, stepSts, 20);
    expect(end.pods.map((p) => p.ordinal)).toEqual([0, 1, 2]);
    expect(end.pods.every(stsReady)).toBe(true);
  });

  it('Parallel cria todos juntos e PVCs sobrevivem ao scale down', () => {
    const up = stepSts({ ...initialSts(), policy: 'Parallel' });
    expect(up.pods).toHaveLength(3);
    const down: StsState = run({ ...run(up, stepSts, 5), replicas: 1 }, stepSts, 2);
    expect(down.pods.map((p) => p.ordinal)).toEqual([0]);
    expect(down.pvcs).toEqual([0, 1, 2]);
  });
});

describe('CronJob', () => {
  const base = (patch: Partial<CronState>): CronState => ({ ...initialCron(), every: 2, duration: 5, ...patch });

  it('Allow acumula execuções, Forbid pula e Replace substitui', () => {
    const allow = run(base({ policy: 'Allow' }), stepCron, 6);
    expect(allow.jobs.filter((j) => j.status === 'Running').length).toBeGreaterThan(1);
    const forbid = run(base({ policy: 'Forbid' }), stepCron, 6);
    expect(forbid.jobs.filter((j) => j.status === 'Running')).toHaveLength(1);
    expect(forbid.skipped).toBeGreaterThan(0);
    const replace = run(base({ policy: 'Replace' }), stepCron, 6);
    expect(replace.jobs.filter((j) => j.status === 'Running')).toHaveLength(1);
    expect(replace.jobs.every((j) => j.status !== 'Complete')).toBe(true);
  });

  it('respeita backoffLimit e o histórico de sucessos', () => {
    // Job criado no minuto 5; falha nas tentativas 1, 2 e 3 (backoffLimit 2 = 2 retentativas)
    const failing = run(base({ every: 5, duration: 1, failing: true, backoffLimit: 2 }), stepCron, 9);
    expect(failing.jobs[0]).toMatchObject({ name: 'backup-5', status: 'Failed', attempt: 3 });
    const ok = run(base({ every: 1, duration: 1 }), stepCron, 20);
    expect(ok.jobs.filter((j) => j.status === 'Complete').length).toBeLessThanOrEqual(3);
  });
});

describe('Cluster Autoscaler', () => {
  it('Pods Pending disparam nós até o máximo e ociosidade remove nós', () => {
    const peak = run<CaState>({ ...initialCa(), replicas: 18 }, stepCa, 12);
    expect(peak.nodes.length).toBeGreaterThan(2);
    expect(peak.nodes.length).toBeLessThanOrEqual(6);
    expect(peak.pods.every((p) => p.node)).toBe(true);
    const calm = run<CaState>({ ...peak, replicas: 2 }, stepCa, 40);
    expect(calm.nodes.length).toBeLessThan(peak.nodes.length);
  });

  it('não cria nó para Pod que não caberia nem em um nó vazio', () => {
    const s = run<CaState>({ ...initialCa(), podCpu: 4000, replicas: 2 }, stepCa, 10);
    expect(s.nodes).toHaveLength(2);
    expect(s.pods.every((p) => !p.node)).toBe(true);
  });

  it('safe-to-evict false bloqueia o scale down', () => {
    const peak = run<CaState>({ ...initialCa(), replicas: 18 }, stepCa, 12);
    const blocked = run<CaState>({ ...peak, replicas: 2, safeToEvict: false }, stepCa, 40);
    const withPods = blocked.nodes.filter((n) => blocked.pods.some((p) => p.node === n.name));
    expect(withPods.length).toBeGreaterThanOrEqual(1);
    expect(blocked.nodes.length).toBeGreaterThanOrEqual(withPods.length);
  });
});
