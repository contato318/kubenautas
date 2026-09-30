import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatorSession } from '../components/simulators/kube-sim/session';

let session: SimulatorSession;
beforeEach(() => { vi.useFakeTimers(); session = new SimulatorSession(); });
afterEach(async () => { session.stop(); await vi.advanceTimersByTimeAsync(1000); vi.useRealTimers(); });
async function tick() { await vi.advanceTimersByTimeAsync(500); session.tick(); }
async function run(command: string, expected = 0) {
  session.clear();
  let done = false;
  const pending = session.submit(command).finally(() => { done = true; });
  for (let n = 0; !done && n < 100; n++) await tick();
  expect(done, command).toBe(true);
  expect(await pending, command).toBe(expected);
  return session.getSnapshot().lines.filter((line) => line.kind !== 'in').map((line) => line.text).join('');
}

describe('shell from the supplied ZIP', () => {
  it('lists and navigates real simulated directories and manipulates their files', async () => {
    expect(await run('ls')).toContain('examples');
    expect(await run('pwd')).toBe('/root\n');
    await run('cd examples');
    expect(session.getSnapshot().prompt).toContain('~/examples');
    expect(await run('ls -la')).toContain('nginx-deployment.yaml');
    expect(await run('cat nginx-deployment.yaml')).toContain('kind: Deployment');
    await run('cd ..; mkdir practice; cd practice; touch empty.txt');
    await run('echo first > notes.txt; echo second >> notes.txt; cp notes.txt copy.txt; mv copy.txt renamed.txt');
    expect(await run('cat renamed.txt')).toBe('first\nsecond\n');
    expect(await run('ls')).toContain('empty.txt');
    await run('rm renamed.txt empty.txt');
    expect(await run('ls')).not.toContain('renamed.txt');
    expect(await run('cat renamed.txt', 1)).toContain('No such file');
    await run('cd /etc/kubernetes/manifests');
    expect(await run('ls')).toContain('kube-scheduler.yaml');
    expect(session.getSnapshot().prompt).toContain('/etc/kubernetes/manifests');
  });

  it('executes pipes, redirects, aliases, variables, loops and command substitutions', async () => {
    expect(await run('ls examples | grep nginx')).toContain('nginx-deployment.yaml');
    await run("printf 'blue\nred\nblue\n' > colors.txt");
    expect(await run('cat colors.txt | sort | uniq | wc -l')).toMatch(/2\s*$/);
    expect(await run("sed 's/blue/green/g' colors.txt | head -1")).toBe('green\n');
    expect(await run("export COURSE=academy; echo $COURSE; alias where=pwd; where")).toBe('academy\n/root\n');
    expect(await run('for name in one two; do echo $name; done')).toBe('one\ntwo\n');
    expect(await run('echo $(pwd); false && echo wrong || echo recovered')).toBe('/root\nrecovered\n');
    expect(await run('missing-command', 127)).toContain('command not found');
  });

  it('accepts blank heredoc lines and keeps mission verification working after history -c', async () => {
    await session.submit("cat <<'EOF' > notes.txt");
    expect(session.getSnapshot().prompt).toBe('> ');
    await session.submit('hello');
    await session.submit('');
    await session.submit('world');
    await run('EOF');
    expect(await run('cat notes.txt')).toBe('hello\n\nworld\n');
    expect(session.complete('cat exam').value).toBe('cat examples/');
    await run('kubectl get nodes');
    session.select(1);
    await run('history -c');
    expect(session.history).toEqual([]);
    session.select(0);
    await run('kubectl get pods -A');
    expect(session.getSnapshot().done[0].slice(0, 2)).toEqual([true, true]);
    expect(await run('history')).toContain('kubectl get pods -A');
  });

  it('opens a container shell and restores the host prompt on exit', async () => {
    await run('kubectl run toolbox --image=busybox:1.36 --command -- sleep 3600');
    for (let n = 0; n < 15; n++) await tick();
    const interactive = session.submit('kubectl exec -it toolbox -- sh');
    for (let n = 0; !session.getSnapshot().interactive && n < 20; n++) await tick();
    expect(session.getSnapshot().interactive).toBe(true);
    expect(await run('ls /')).toContain('etc');
    await run('cd /tmp; echo inside > container.txt');
    expect(await run('cat container.txt')).toBe('inside\n');
    await run('exit');
    await interactive;
    expect(session.getSnapshot().interactive).toBe(false);
    expect(session.getSnapshot().prompt).toContain('root@sim-control-plane:~#');
    expect(await run('cat /tmp/container.txt', 1)).toContain('No such file');
  });
});
