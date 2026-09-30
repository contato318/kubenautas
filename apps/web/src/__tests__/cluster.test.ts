import { describe, expect, it } from 'vitest';
import { execute, initialCluster, type ClusterState } from '../components/simulators/cluster';

const runAll = (cmds: string[], start: ClusterState = initialCluster()) =>
  cmds.reduce<{ state: ClusterState; outputs: string[]; errors: boolean[] }>(
    (acc, c) => {
      const r = execute(c, acc.state);
      return { state: r.state, outputs: [...acc.outputs, r.output], errors: [...acc.errors, !!r.error] };
    },
    { state: start, outputs: [], errors: [] },
  );

describe('cluster simulado', () => {
  it('cria deployment com as réplicas pedidas espalhadas pelos workers', () => {
    const { state, errors } = runAll(['kubectl create deployment web --image=nginx:1.27 --replicas=3']);
    expect(errors).toEqual([false]);
    const pods = state.pods.filter((p) => p.owner === 'web');
    expect(pods).toHaveLength(3);
    expect(new Set(pods.map((p) => p.node)).size).toBe(3);
    expect(pods.every((p) => p.node !== 'control-plane')).toBe(true);
  });

  it('recria o pod deletado com outro nome (self-healing)', () => {
    const { state } = runAll(['k create deploy web --image=nginx:1.27 --replicas=2']);
    const victim = state.pods[0].name;
    const r = execute(`kubectl delete pod ${victim}`, state);
    expect(r.error).toBeFalsy();
    expect(r.state.pods.filter((p) => p.owner === 'web')).toHaveLength(2);
    expect(r.state.pods.some((p) => p.name === victim)).toBe(false);
  });

  it('escala para cima e para baixo', () => {
    const { state } = runAll(['kubectl create deployment web --image=nginx', 'kubectl scale deployment web --replicas=5']);
    expect(state.pods).toHaveLength(5);
    const r = execute('kubectl scale deploy/web --replicas=1', state);
    expect(r.state.pods).toHaveLength(1);
  });

  it('set image troca todos os pods e rollout undo volta', () => {
    const { state } = runAll([
      'kubectl create deployment web --image=nginx:1.27 --replicas=3',
      'kubectl set image deployment/web nginx=nginx:1.28',
    ]);
    expect(state.pods.every((p) => p.image === 'nginx:1.28')).toBe(true);
    const r = execute('kubectl rollout undo deployment/web', state);
    expect(r.state.pods.every((p) => p.image === 'nginx:1.27')).toBe(true);
    expect(execute('kubectl rollout history deployment/web', r.state).output).toContain('3');
  });

  it('valida o nome do container no set image', () => {
    const { state } = runAll(['kubectl create deployment web --image=nginx:1.27']);
    expect(execute('kubectl set image deployment/web app=nginx:1.28', state).error).toBe(true);
  });

  it('expose cria service e describe mostra endpoints', () => {
    const { state } = runAll(['kubectl create deployment web --image=nginx --replicas=2', 'kubectl expose deployment web --port=80']);
    expect(state.services.find((s) => s.name === 'web')?.port).toBe(80);
    const aged = { ...state, pods: state.pods.map((p) => ({ ...p, created: p.created - 10_000 })) };
    const d = execute('kubectl describe svc web', aged);
    expect(d.output).toMatch(/Endpoints:\s+10\.244/);
  });

  it('cordon impede novos pods no nó', () => {
    const { state } = runAll(['kubectl cordon worker-1', 'kubectl cordon worker-2', 'kubectl create deployment web --image=nginx --replicas=3']);
    expect(state.pods.every((p) => p.node === 'worker-3')).toBe(true);
    expect(execute('kubectl get nodes', state).output).toContain('SchedulingDisabled');
  });

  it('retorna erros no estilo do kubectl', () => {
    const s = initialCluster();
    expect(execute('kubectl get banana', s).error).toBe(true);
    expect(execute('kubectl delete pod nada', s).output).toContain('NotFound');
    expect(execute('ls', s).error).toBe(true);
    expect(execute('kubectl create deployment x', s).output).toContain('image');
  });

  it('get all lista pods, services, deployments e replicasets', () => {
    const { state } = runAll(['kubectl create deployment web --image=nginx']);
    const out = execute('kubectl get all', state).output;
    expect(out).toContain('pod/web-');
    expect(out).toContain('service/kubernetes');
    expect(out).toContain('deployment.apps/web');
    expect(out).toContain('replicaset.apps/web-');
  });
});
