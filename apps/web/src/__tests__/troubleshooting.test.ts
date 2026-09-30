import { describe, expect, it } from 'vitest';
import { troubleshootingModule } from '../content/troubleshootingModule';
import { troubleshootingCaseMeta } from '../content/troubleshootingCases';
import { simulators } from '../components/simulators/registry';
import { TREE, leaves } from '../components/simulators/TsDiagnosisSim';
import { backoffDelay, decodeExit } from '../components/simulators/TsExitCodeSim';
import { NODES, schedule } from '../components/simulators/TsSchedulingSim';
import { trace, type Fault } from '../components/simulators/TsNetworkPathSim';
import { GRACE, PLEG, TOLERATION, snapshot } from '../components/simulators/TsNodeSim';
import { volumeCheck, type VolumeInput } from '../components/simulators/TsVolumeSim';
import { evaluateOps, type CPState } from '../components/simulators/TsControlPlaneSim';
import { MISSIONS } from '../components/simulators/TsToolsSim';

describe('módulo de troubleshooting', () => {
  it('8 lições, 10 perguntas cada, um simulador diferente por lição', () => {
    const { lessons } = troubleshootingModule;
    expect(lessons).toHaveLength(8);
    lessons.forEach((l) => {
      expect(l.quiz).toHaveLength(10);
      expect(l.content.length).toBeGreaterThan(3000);
      expect(simulators.some((s) => s.id === l.simulator)).toBe(true);
    });
    expect(new Set(lessons.map((l) => l.simulator)).size).toBe(8);
  });

  it('10 casos, todos com simulador existente', () => {
    expect(troubleshootingCaseMeta).toHaveLength(10);
    troubleshootingCaseMeta.forEach((c) => expect(simulators.some((s) => s.id === c.simulator)).toBe(true));
  });
});

describe('árvore de diagnóstico', () => {
  it('todos os destinos existem e toda folha é alcançável a partir de start', () => {
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const n = TREE[id];
      expect(n, id).toBeDefined();
      if (n.kind === 'q') n.options.forEach((o) => walk(o.next));
    };
    walk('start');
    leaves().forEach((l) => expect(seen.has(l), l).toBe(true));
    expect(leaves().length).toBeGreaterThanOrEqual(15);
  });
});

describe('exit codes', () => {
  it('decodifica sinais e códigos especiais', () => {
    expect(decodeExit(137).title).toContain('SIGKILL');
    expect(decodeExit(143).tone).toBe('amber');
    expect(decodeExit(127).title).toBe('Comando não encontrado');
    expect(decodeExit(0).tone).toBe('green');
    expect(decodeExit(42).title).toContain('definido pela aplicação');
  });
  it('backoff dobra a partir de 10 s até o teto de 5 min', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelay)).toEqual([10, 20, 40, 80, 160, 300, 300]);
  });
});

describe('scheduling', () => {
  const base = { cpu: 500, mem: 512, tolerateGpu: false };
  it('agenda no primeiro nó que cabe', () => {
    expect(schedule(NODES, base).node).toBe('worker-1');
  });
  it('monta a mensagem FailedScheduling com os motivos agregados', () => {
    const r = schedule(NODES, { ...base, cpu: 5000 });
    expect(r.node).toBeNull();
    expect(r.message).toContain('0/4 nodes are available: 1 node(s) had untolerated taint {dedicated: gpu}, 3 Insufficient cpu.');
    const cordon = NODES.map((n) => (n.name === 'worker-4' ? { ...n, unschedulable: true } : n));
    expect(schedule(cordon, { ...base, cpu: 3900 }).message).toContain('1 node(s) were unschedulable');
  });
  it('toleration libera o nó com taint', () => {
    expect(schedule(NODES, { ...base, cpu: 3700, mem: 10000, tolerateGpu: true }).node).toBe('worker-3');
  });
});

describe('caminho da requisição', () => {
  const t = (...f: Fault[]) => trace(new Set(f));
  it('sem falhas → 200 OK em 5 saltos', () => {
    expect(t().ok).toBe(true);
    expect(t().hops).toHaveLength(5);
  });
  it('cada falha gera o sintoma característico', () => {
    expect(t('coredns').symptom).toContain('Could not resolve host');
    expect(t('selector').symptom).toContain('Connection refused');
    expect(t('netpol').symptom).toContain('timed out');
    expect(t('kubeproxy').symptom).toContain('timed out');
    expect(t('localhost').symptom).toContain('Connection refused');
  });
  it('a primeira falha no caminho é a que aparece', () => {
    expect(t('netpol', 'wrongName').hops).toHaveLength(1);
  });
});

describe('nó em apuros', () => {
  it('kubelet parado: Unknown após o grace e eviction após a tolerância', () => {
    expect(snapshot('kubelet', GRACE - 1).ready).toBe('True');
    const s = snapshot('kubelet', GRACE);
    expect(s.ready).toBe('Unknown');
    expect(s.taints).toContain('node.kubernetes.io/unreachable:NoExecute');
    expect(snapshot('kubelet', GRACE + TOLERATION).pods[1].status).toContain('Terminating');
  });
  it('containerd travado: Ready=False com PLEG', () => {
    expect(snapshot('containerd', PLEG - 1).ready).toBe('True');
    expect(snapshot('containerd', PLEG).ready).toBe('False');
    expect(snapshot('containerd', PLEG).taints[0]).toContain('not-ready');
  });
  it('disco cheio: nó continua Ready, com DiskPressure e eviction', () => {
    const s = snapshot('disk', 60);
    expect(s.ready).toBe('True');
    expect(s.diskPressure).toBe(true);
    expect(s.pods[0].status).toContain('Evicted');
  });
});

describe('volumes', () => {
  const ok: VolumeInput = { storageClass: 'ok', provisioner: 'up', secondReplicaOtherNode: false, nonRootWithoutFsGroup: false, quotaExceeded: false };
  it('cenário saudável', () => {
    expect(volumeCheck(ok).pvc).toBe('Bound');
    expect(volumeCheck(ok).pods.every((p) => p.ok)).toBe(true);
  });
  it('falhas e seus sinais', () => {
    expect(volumeCheck({ ...ok, quotaExceeded: true }).pvc).toBe('não criado');
    expect(volumeCheck({ ...ok, storageClass: 'missing' }).events[0]).toContain('not found');
    expect(volumeCheck({ ...ok, provisioner: 'down' }).pvc).toBe('Pending');
    expect(volumeCheck({ ...ok, secondReplicaOtherNode: true }).events.join()).toContain('Multi-Attach');
    expect(volumeCheck({ ...ok, nonRootWithoutFsGroup: true }).fix).toContain('fsGroup');
  });
});

describe('control plane', () => {
  const ok: CPState = { apiserver: true, etcd: true, scheduler: true, controllerManager: true, coredns: true, certsExpired: false, webhook: 'ok' };
  const byOp = (s: CPState) => Object.fromEntries(evaluateOps(s).map((r) => [r.op, r]));
  it('tudo saudável → todas as operações ok', () => {
    expect(evaluateOps(ok).every((r) => r.ok)).toBe(true);
  });
  it('API server fora: nada muda, mas Pods existentes continuam', () => {
    const r = evaluateOps({ ...ok, apiserver: false });
    expect(r[0].ok).toBe(false);
    expect(r.find((x) => x.op.startsWith('Pods que já'))!.ok).toBe(true);
  });
  it('scheduler fora: Pods criados mas não agendados', () => {
    const r = byOp({ ...ok, scheduler: false });
    expect(r['ReplicaSet e Pods criados pelo Deployment'].ok).toBe(true);
    expect(r['Pods novos agendados em nós'].ok).toBe(false);
  });
  it('webhook Fail bloqueia o apply; Ignore deixa passar', () => {
    expect(evaluateOps({ ...ok, webhook: 'fail' })[1].msg).toContain('failed calling webhook');
    expect(evaluateOps({ ...ok, webhook: 'ignore' })[1].ok).toBe(true);
  });
  it('certificados expirados → erro x509', () => {
    expect(evaluateOps({ ...ok, certsExpired: true })[0].msg).toContain('x509');
  });
});

describe('missões de ferramentas', () => {
  it('10 missões com resposta válida', () => {
    expect(MISSIONS).toHaveLength(10);
    MISSIONS.forEach((m) => expect(m.options[m.answer]).toBeDefined());
  });
});
