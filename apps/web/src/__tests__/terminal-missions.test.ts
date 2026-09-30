import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatorSession } from '../components/simulators/kube-sim/session';

const sessions: SimulatorSession[] = [];
const create = () => { const session = new SimulatorSession(); sessions.push(session); return session; };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T12:00:00Z')); });
afterEach(async () => { sessions.splice(0).forEach((session) => session.stop()); await vi.advanceTimersByTimeAsync(1000); vi.useRealTimers(); });
const step = async (session: SimulatorSession, ms = 500) => { await vi.advanceTimersByTimeAsync(ms); session.tick(); };
async function execute(session: SimulatorSession, command: string) {
  let settled = false;
  const promise = session.submit(command).finally(() => { settled = true; });
  for (let elapsed = 0; !settled && elapsed < 180000; elapsed += 500) {
    await step(session);
    if (/get pods -w$/.test(command) && elapsed >= 10000) session.interrupt();
  }
  expect(settled, `Command did not finish: ${command}`).toBe(true);
  return await promise;
}

describe('imported terminal missions', () => {
  it('completes all 23 missions using their supplied solutions', async () => {
    const session = create();
    expect(session.missions).toHaveLength(23);
    expect(session.levels).toHaveLength(5);
    expect(session.getSnapshot().nodes).toHaveLength(3);
    for (const [index, mission] of session.missions.entries()) {
      session.select(index);
      if (mission.scenario) {
        session.prepare();
        for (let tick = 0; tick < 40; tick++) await step(session);
        const pods = session.getSnapshot().pods;
        if (mission.id === 'image-pull') expect(pods.some((pod) => pod.name.startsWith('shop-') && /ImagePull|ErrImage/.test(pod.status))).toBe(true);
        if (mission.id === 'crashloop') expect(pods.some((pod) => pod.name.startsWith('db-') && /CrashLoop|Error/.test(pod.status))).toBe(true);
        if (mission.id === 'pending') expect(pods.find((pod) => pod.name === 'bigjob')?.status).toBe('Pending');
        if (mission.id === 'control-plane') {
          expect(pods.find((pod) => pod.name === 'waiting')?.status).toBe('Pending');
          expect(pods.find((pod) => pod.name === 'kube-scheduler-sim-control-plane')?.status).toMatch(/ImagePull|ErrImage/);
        }
      }
      for (const [taskIndex, task] of mission.tasks.entries()) {
        if (mission.id === 'storage' && taskIndex === 2) {
          await execute(session, "kubectl exec writer -- sh -c 'echo preserved-before-recreation >> /data/log.txt'");
        }
        const code = await execute(session, task.sol);
        if (!/get pods -w$|auth can-i delete|diff -f/.test(task.sol)) {
          expect(code, `${mission.id}: solution failed\n${session.getSnapshot().lines.slice(-3).map((line) => line.text).join('')}`).toBe(0);
        }
        if (mission.id === 'storage' && taskIndex === 2) expect(session.getSnapshot().lines.at(-1)?.text).toContain('preserved-before-recreation');
        for (let elapsed = 0; !session.getSnapshot().done[index][taskIndex] && elapsed < 90000; elapsed += 500) await step(session);
        expect(session.getSnapshot().done[index][taskIndex], `${mission.id}: ${task.text}\n${session.getSnapshot().lines.slice(-3).map((line) => line.text).join('')}`).toBe(true);
      }
    }
    expect(session.getSnapshot().done.every((tasks) => tasks.every(Boolean))).toBe(true);
  }, 60000);

  it('isolates cluster, files and progress between sessions and resets pending commands', async () => {
    const first = create(), second = create();
    await execute(first, 'kubectl run private-pod --image=nginx:1.25');
    await execute(first, 'echo private > secret.txt');
    expect(second.getSnapshot().pods.some((pod) => pod.name === 'private-pod')).toBe(false);
    await execute(second, 'cat secret.txt');
    expect(second.getSnapshot().lines.at(-1)?.text).toContain('No such file');
    const watch = first.submit('kubectl get pods -w');
    await step(first);
    first.reset();
    const banner = first.getSnapshot().lines;
    await step(first, 2000);
    await watch;
    expect(first.getSnapshot().lines).toEqual(banner);
    expect(first.history).toEqual([]);
    expect(first.getSnapshot().pods.some((pod) => pod.name === 'private-pod')).toBe(false);
  });

  it('opens and saves simulated files in the editor', async () => {
    const session = create();
    const pending = session.submit('vi sample.yaml');
    await step(session);
    expect(session.getSnapshot().editing?.path).toBe('/root/sample.yaml');
    session.finishEdit('apiVersion: v1\nkind: Namespace\nmetadata:\n  name: edited\n');
    await pending;
    await execute(session, 'kubectl apply -f sample.yaml');
    expect(session.getSnapshot().lines.at(-1)?.text).toContain('namespace/edited created');
  });
});
