/**
 * A tiny in-memory Kubernetes cluster that understands a subset of kubectl.
 * Pure functions over ClusterState so it can be unit-tested.
 */
export interface KNode {
  name: string;
  role: 'control-plane' | 'worker';
  schedulable: boolean;
}

export interface KPod {
  name: string;
  namespace: string;
  owner: string | null; // deployment name
  hash: string | null;
  image: string;
  node: string;
  ip: string;
  created: number;
  restarts: number;
}

export interface KDeployment {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  /** revision history: images in order; last is current */
  revisions: { hash: string; image: string }[];
}

export interface KService {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  clusterIP: string;
  port: number;
  targetPort: number;
  nodePort?: number;
  selector: string; // app label
}

export interface ClusterState {
  now: number;
  nodes: KNode[];
  pods: KPod[];
  deployments: KDeployment[];
  services: KService[];
  namespaces: string[];
  /** commands executed successfully, for mission checks */
  history: string[];
}

const STARTUP_MS = 3000;
const alphabet = 'bcdfghjklmnpqrstvwxz2456789';
const rand = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
/** Deterministic pod-template-hash look-alike (10 chars, no vowels). */
const hashOf = (s: string) => {
  let h = 2166136261;
  let out = '';
  for (let round = 0; out.length < 10; round++) {
    for (const c of s + round) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    out += alphabet[h % alphabet.length] + alphabet[(h >>> 8) % alphabet.length];
  }
  return out.slice(0, 10);
};
let ipCounter = 5;
const nextIp = () => `10.244.${(ipCounter % 3) + 1}.${ipCounter++}`;

export function initialCluster(): ClusterState {
  const now = Date.now();
  return {
    now,
    nodes: [
      { name: 'control-plane', role: 'control-plane', schedulable: false },
      { name: 'worker-1', role: 'worker', schedulable: true },
      { name: 'worker-2', role: 'worker', schedulable: true },
      { name: 'worker-3', role: 'worker', schedulable: true },
    ],
    pods: [],
    deployments: [],
    services: [{ name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIP: '10.96.0.1', port: 443, targetPort: 6443, selector: '' }],
    namespaces: ['default', 'kube-system', 'kube-public', 'kube-node-lease'],
    history: [],
  };
}

const age = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m${s % 60}s` : `${Math.floor(m / 60)}h${m % 60}m`;
};

export const podStatus = (p: KPod, now: number) => (now - p.created < STARTUP_MS ? 'ContainerCreating' : 'Running');

function table(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i] + 3))).join('')).join('\n');
}

function pickNode(state: ClusterState, extra: KPod[] = []): string | null {
  const nodes = state.nodes.filter((n) => n.schedulable);
  if (!nodes.length) return null;
  const all = [...state.pods, ...extra];
  const load = (n: string) => all.filter((p) => p.node === n).length;
  return [...nodes].sort((a, b) => load(a.name) - load(b.name) || a.name.localeCompare(b.name))[0].name;
}

/** Makes the Pods of every Deployment match its current revision and replica count. */
export function reconcile(state: ClusterState): ClusterState {
  let pods = [...state.pods];
  for (const d of state.deployments) {
    const cur = d.revisions[d.revisions.length - 1];
    // Old revision Pods are replaced (rolling update collapsed into one step).
    pods = pods.filter((p) => p.owner !== d.name || p.namespace !== d.namespace || p.hash === cur.hash);
    const mine = pods.filter((p) => p.owner === d.name && p.namespace === d.namespace);
    if (mine.length > d.replicas) {
      const drop = new Set(mine.slice(d.replicas).map((p) => p.name));
      pods = pods.filter((p) => !drop.has(p.name));
    }
    for (let i = mine.length; i < d.replicas; i++) {
      const node = pickNode({ ...state, pods }, []);
      if (!node) break;
      pods.push({ name: `${d.name}-${cur.hash}-${rand(5)}`, namespace: d.namespace, owner: d.name, hash: cur.hash, image: cur.image, node, ip: nextIp(), created: state.now, restarts: 0 });
    }
  }
  return { ...state, pods };
}

interface Result {
  state: ClusterState;
  output: string;
  error?: boolean;
}

const HELP = `Comandos suportados (use "kubectl" ou "k"):
  get nodes|pods|deploy|rs|svc|ns|all [-o wide] [-l app=x] [-A|-n ns]
  describe pod|deploy|node|svc NOME
  create deployment NOME --image=IMG [--replicas=N]
  run NOME --image=IMG
  expose deployment NOME --port=P [--target-port=T] [--type=NodePort|LoadBalancer]
  scale deployment NOME --replicas=N
  set image deployment/NOME CONTAINER=IMG
  rollout status|history|undo deployment/NOME
  delete pod|deploy|svc NOME
  logs POD
  top nodes|pods
  cordon|uncordon NODE
  version
Outros: clear, help`;

function parseFlags(args: string[]) {
  const flags: Record<string, string | true> = {};
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (args[i + 1] && !args[i + 1].startsWith('-') && ['replicas', 'image', 'port', 'target-port', 'type', 'namespace', 'to-revision'].includes(k)) flags[k] = args[++i];
      else flags[k] = true;
    } else if (a === '-o' || a === '-l' || a === '-n') {
      flags[a.slice(1)] = args[++i] ?? '';
    } else if (a.startsWith('-o')) {
      flags.o = a.slice(2);
    } else if (a === '-A') {
      flags.A = true;
    } else if (a === '-f' || a === '-w' || a === '-it' || a === '-i' || a === '-t') {
      flags[a.slice(1)] = true;
    } else {
      pos.push(a);
    }
  }
  if (flags.namespace) flags.n = flags.namespace;
  return { flags, pos };
}

const kinds: Record<string, string> = {
  po: 'pods', pod: 'pods', pods: 'pods',
  no: 'nodes', node: 'nodes', nodes: 'nodes',
  deploy: 'deployments', deployment: 'deployments', deployments: 'deployments',
  rs: 'replicasets', replicaset: 'replicasets', replicasets: 'replicasets',
  svc: 'services', service: 'services', services: 'services',
  ns: 'namespaces', namespace: 'namespaces', namespaces: 'namespaces',
  all: 'all',
};

/** Accepts "deploy web", "deployment/web", "deploy/web". */
function resolveTarget(pos: string[]): { kind: string | undefined; name: string | undefined } {
  if (pos[0]?.includes('/')) {
    const [k, n] = pos[0].split('/');
    return { kind: kinds[k], name: n };
  }
  return { kind: kinds[pos[0]], name: pos[1] };
}

export function execute(input: string, prev: ClusterState): Result {
  const state = reconcile({ ...prev, now: Date.now() });
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts[0] !== 'kubectl' && parts[0] !== 'k') {
    if (parts[0] === 'help') return { state, output: HELP };
    if (['docker', 'helm', 'minikube', 'kind'].includes(parts[0])) return { state, output: `${parts[0]}: não disponível neste simulador — só kubectl 😉`, error: true };
    return { state, output: `zsh: command not found: ${parts[0]}`, error: true };
  }
  const [verb, ...rest] = parts.slice(1);
  const { flags, pos } = parseFlags(rest);
  const ns = (flags.n as string) || 'default';
  const ok = (s: ClusterState, output: string): Result => ({ state: { ...s, history: [...s.history, input.trim()] }, output });
  const err = (output: string): Result => ({ state, output, error: true });
  const now = state.now;

  switch (verb) {
    case undefined:
    case 'help':
      return { state, output: HELP };

    case 'version':
      return ok(state, 'Client Version: v1.34.1\nKustomize Version: v5.7.1\nServer Version: v1.34.0 (kubenautas-sim)');

    case 'get': {
      const kind = kinds[pos[0]];
      if (!kind) return err(`error: the server doesn't have a resource type "${pos[0] ?? ''}"`);
      const wide = flags.o === 'wide';
      const all = !!flags.A;
      const inNs = <T extends { namespace: string }>(x: T) => all || x.namespace === ns;
      const selector = typeof flags.l === 'string' ? flags.l.split('=')[1] : null;
      const outputs: string[] = [];

      if (kind === 'nodes') {
        const rows = [wide ? ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', 'INTERNAL-IP', 'CONTAINER-RUNTIME'] : ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION']];
        state.nodes.forEach((n, i) => {
          const st = n.schedulable || n.role === 'control-plane' ? 'Ready' : 'Ready,SchedulingDisabled';
          const r = [n.name, st, n.role === 'control-plane' ? 'control-plane' : '<none>', '12d', 'v1.34.0'];
          rows.push(wide ? [...r, `172.18.0.${i + 2}`, 'containerd://2.1.4'] : r);
        });
        return ok(state, table(rows));
      }
      if (kind === 'namespaces') {
        return ok(state, table([['NAME', 'STATUS', 'AGE'], ...state.namespaces.map((n) => [n, 'Active', '12d'])]));
      }
      if (kind === 'pods' || kind === 'all') {
        const pods = state.pods.filter(inNs).filter((p) => !selector || p.owner === selector);
        if (pods.length) {
          const head = kind === 'all' ? 'pod/' : '';
          const rows = [[...(all ? ['NAMESPACE'] : []), 'NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', ...(wide ? ['IP', 'NODE'] : [])]];
          pods.forEach((p) => {
            const st = podStatus(p, now);
            rows.push([...(all ? [p.namespace] : []), head + p.name, st === 'Running' ? '1/1' : '0/1', st, String(p.restarts), age(now - p.created), ...(wide ? [p.ip, p.node] : [])]);
          });
          outputs.push(table(rows));
        } else if (kind === 'pods') {
          return ok(state, `No resources found in ${all ? 'any' : ns} namespace.`);
        }
      }
      if (kind === 'services' || kind === 'all') {
        const svcs = state.services.filter(inNs);
        if (svcs.length) {
          const head = kind === 'all' ? 'service/' : '';
          const rows = [['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE', ...(wide ? ['SELECTOR'] : [])]];
          svcs.forEach((s) =>
            rows.push([
              head + s.name,
              s.type,
              s.clusterIP,
              s.type === 'LoadBalancer' ? '203.0.113.10' : '<none>',
              s.nodePort ? `${s.port}:${s.nodePort}/TCP` : `${s.port}/TCP`,
              s.name === 'kubernetes' ? '12d' : '1m',
              ...(wide ? [s.selector ? `app=${s.selector}` : '<none>'] : []),
            ]),
          );
          outputs.push(table(rows));
        } else if (kind === 'services') return ok(state, `No resources found in ${ns} namespace.`);
      }
      if (kind === 'deployments' || kind === 'all') {
        const deps = state.deployments.filter(inNs);
        if (deps.length) {
          const head = kind === 'all' ? 'deployment.apps/' : '';
          const rows = [['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE', ...(wide ? ['IMAGES'] : [])]];
          deps.forEach((d) => {
            const pods = state.pods.filter((p) => p.owner === d.name && p.namespace === d.namespace);
            const ready = pods.filter((p) => podStatus(p, now) === 'Running').length;
            rows.push([head + d.name, `${ready}/${d.replicas}`, String(pods.length), String(ready), '1m', ...(wide ? [d.revisions.at(-1)!.image] : [])]);
          });
          outputs.push(table(rows));
        } else if (kind === 'deployments') return ok(state, `No resources found in ${ns} namespace.`);
      }
      if (kind === 'replicasets' || kind === 'all') {
        const deps = state.deployments.filter(inNs);
        if (deps.length) {
          const head = kind === 'all' ? 'replicaset.apps/' : '';
          const rows = [['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE']];
          deps.forEach((d) =>
            d.revisions.forEach((r, i) => {
              const isCur = i === d.revisions.length - 1;
              const pods = state.pods.filter((p) => p.owner === d.name && p.hash === r.hash);
              const ready = pods.filter((p) => podStatus(p, now) === 'Running').length;
              if (rows.some((row) => row[0] === `${head}${d.name}-${r.hash}`)) return;
              rows.push([`${head}${d.name}-${r.hash}`, isCur ? String(d.replicas) : '0', String(pods.length), String(ready), '1m']);
            }),
          );
          outputs.push(table(rows));
        } else if (kind === 'replicasets') return ok(state, `No resources found in ${ns} namespace.`);
      }
      return ok(state, outputs.join('\n\n') || `No resources found in ${ns} namespace.`);
    }

    case 'create': {
      if (pos[0] === 'namespace' || pos[0] === 'ns') {
        if (!pos[1]) return err('error: exactly one NAME is required');
        if (state.namespaces.includes(pos[1])) return err(`Error from server (AlreadyExists): namespaces "${pos[1]}" already exists`);
        return ok({ ...state, namespaces: [...state.namespaces, pos[1]] }, `namespace/${pos[1]} created`);
      }
      if (pos[0] !== 'deployment' && pos[0] !== 'deploy') return err(`error: tipo não suportado no simulador: ${pos[0] ?? ''}. Tente: create deployment NOME --image=IMG`);
      const name = pos[1];
      const image = flags.image as string;
      if (!name) return err('error: exactly one NAME is required, got 0');
      if (!image || image === (true as unknown)) return err('error: required flag(s) "image" not set');
      if (!state.namespaces.includes(ns)) return err(`Error from server (NotFound): namespaces "${ns}" not found`);
      if (state.deployments.some((d) => d.name === name && d.namespace === ns)) return err(`error: failed to create deployment: deployments.apps "${name}" already exists`);
      const replicas = flags.replicas ? Number(flags.replicas) : 1;
      if (!Number.isInteger(replicas) || replicas < 0) return err('error: --replicas deve ser um inteiro >= 0');
      const dep: KDeployment = { name, namespace: ns, image, replicas, revisions: [{ hash: hashOf(name + image), image }] };
      return ok(reconcile({ ...state, deployments: [...state.deployments, dep] }), `deployment.apps/${name} created`);
    }

    case 'run': {
      const name = pos[0];
      const image = flags.image as string;
      if (!name || !image) return err('error: uso: kubectl run NOME --image=IMG');
      if (state.pods.some((p) => p.name === name && p.namespace === ns)) return err(`Error from server (AlreadyExists): pods "${name}" already exists`);
      const node = pickNode(state);
      if (!node) return err('pod ficaria Pending: nenhum nó schedulable');
      return ok({ ...state, pods: [...state.pods, { name, namespace: ns, owner: null, hash: null, image, node, ip: nextIp(), created: now, restarts: 0 }] }, `pod/${name} created`);
    }

    case 'expose': {
      const { kind, name } = resolveTarget(pos);
      if (kind !== 'deployments' || !name) return err('error: uso: kubectl expose deployment NOME --port=80');
      const d = state.deployments.find((x) => x.name === name && x.namespace === ns);
      if (!d) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
      if (!flags.port) return err("error: couldn't find port via --port flag or introspection");
      if (state.services.some((s) => s.name === name && s.namespace === ns)) return err(`Error from server (AlreadyExists): services "${name}" already exists`);
      const port = Number(flags.port);
      const type = ((flags.type as string) || 'ClusterIP') as KService['type'];
      if (!['ClusterIP', 'NodePort', 'LoadBalancer'].includes(type)) return err(`error: tipo de Service inválido: ${type}`);
      const svc: KService = {
        name, namespace: ns, type, port,
        targetPort: flags['target-port'] ? Number(flags['target-port']) : port,
        clusterIP: `10.96.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 250) + 2}`,
        nodePort: type === 'ClusterIP' ? undefined : 30000 + Math.floor(Math.random() * 2767),
        selector: name,
      };
      return ok({ ...state, services: [...state.services, svc] }, `service/${name} exposed`);
    }

    case 'scale': {
      const { kind, name } = resolveTarget(pos);
      if (kind !== 'deployments' || !name) return err('error: uso: kubectl scale deployment NOME --replicas=N');
      const replicas = Number(flags.replicas);
      if (flags.replicas === undefined || !Number.isInteger(replicas) || replicas < 0) return err('error: required flag(s) "replicas" not set');
      const d = state.deployments.find((x) => x.name === name && x.namespace === ns);
      if (!d) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
      const deployments = state.deployments.map((x) => (x === d ? { ...x, replicas } : x));
      return ok(reconcile({ ...state, deployments }), `deployment.apps/${name} scaled`);
    }

    case 'set': {
      if (pos[0] !== 'image') return err('error: só "kubectl set image" é suportado');
      const { kind, name } = resolveTarget(pos.slice(1));
      const assign = pos.find((p) => p.includes('=') && !p.startsWith('deploy'));
      if (kind !== 'deployments' || !name || !assign) return err('error: uso: kubectl set image deployment/NOME CONTAINER=IMG');
      const d = state.deployments.find((x) => x.name === name && x.namespace === ns);
      if (!d) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
      const [container, image] = assign.split('=');
      const containerName = d.image.split('/').pop()!.split(':')[0];
      if (container !== containerName && container !== '*') return err(`error: unable to find container named "${container}" (o container se chama "${containerName}")`);
      if (d.revisions.at(-1)!.image === image) return ok(state, `deployment.apps/${name} image updated (sem mudanças)`);
      const deployments = state.deployments.map((x) => (x === d ? { ...x, revisions: [...x.revisions, { hash: hashOf(name + image + x.revisions.length), image }] } : x));
      return ok(reconcile({ ...state, deployments }), `deployment.apps/${name} image updated`);
    }

    case 'rollout': {
      const sub = pos[0];
      const { kind, name } = resolveTarget(pos.slice(1));
      if (kind !== 'deployments' || !name) return err('error: uso: kubectl rollout status|history|undo deployment/NOME');
      const d = state.deployments.find((x) => x.name === name && x.namespace === ns);
      if (!d) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
      if (sub === 'status') {
        const pods = state.pods.filter((p) => p.owner === d.name);
        const ready = pods.filter((p) => podStatus(p, now) === 'Running').length;
        return ok(state, ready >= d.replicas ? `deployment "${name}" successfully rolled out` : `Waiting for deployment "${name}" rollout to finish: ${ready} of ${d.replicas} updated replicas are available...\n(rode de novo em alguns segundos)`);
      }
      if (sub === 'history') {
        return ok(state, `deployment.apps/${name}\n${table([['REVISION', 'CHANGE-CAUSE'], ...d.revisions.map((r, i) => [String(i + 1), `image=${r.image}`])])}`);
      }
      if (sub === 'undo') {
        if (d.revisions.length < 2) return err(`error: no rollout history found for deployment "${name}"`);
        const prevRev = d.revisions[d.revisions.length - 2];
        const deployments = state.deployments.map((x) => (x === d ? { ...x, revisions: [...x.revisions, prevRev] } : x));
        return ok(reconcile({ ...state, deployments }), `deployment.apps/${name} rolled back`);
      }
      if (sub === 'restart') {
        const deployments = state.deployments.map((x) => (x === d ? { ...x, revisions: [...x.revisions, { hash: hashOf(name + now), image: x.revisions.at(-1)!.image }] } : x));
        return ok(reconcile({ ...state, deployments }), `deployment.apps/${name} restarted`);
      }
      return err(`error: subcomando de rollout desconhecido: ${sub}`);
    }

    case 'delete': {
      const { kind, name } = resolveTarget(pos);
      if (!kind || !name) return err('error: uso: kubectl delete pod|deploy|svc NOME');
      if (kind === 'pods') {
        const p = state.pods.find((x) => x.name === name && x.namespace === ns);
        if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
        return ok(reconcile({ ...state, pods: state.pods.filter((x) => x !== p) }), `pod "${name}" deleted`);
      }
      if (kind === 'deployments') {
        if (!state.deployments.some((x) => x.name === name && x.namespace === ns)) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
        return ok(
          { ...state, deployments: state.deployments.filter((x) => !(x.name === name && x.namespace === ns)), pods: state.pods.filter((p) => !(p.owner === name && p.namespace === ns)) },
          `deployment.apps "${name}" deleted`,
        );
      }
      if (kind === 'services') {
        if (!state.services.some((x) => x.name === name && x.namespace === ns)) return err(`Error from server (NotFound): services "${name}" not found`);
        return ok({ ...state, services: state.services.filter((x) => !(x.name === name && x.namespace === ns)) }, `service "${name}" deleted`);
      }
      if (kind === 'namespaces') {
        if (['default', 'kube-system'].includes(name)) return err(`Error from server (Forbidden): namespace "${name}" é protegido`);
        return ok({ ...state, namespaces: state.namespaces.filter((n) => n !== name), pods: state.pods.filter((p) => p.namespace !== name), deployments: state.deployments.filter((d) => d.namespace !== name), services: state.services.filter((s) => s.namespace !== name) }, `namespace "${name}" deleted`);
      }
      return err(`error: delete de ${kind} não suportado no simulador`);
    }

    case 'describe': {
      const { kind, name } = resolveTarget(pos);
      if (!kind || !name) return err('error: uso: kubectl describe pod|deploy|node|svc NOME');
      if (kind === 'pods') {
        const p = state.pods.find((x) => x.name === name && x.namespace === ns);
        if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
        const st = podStatus(p, now);
        return ok(state, `Name:         ${p.name}
Namespace:    ${p.namespace}
Node:         ${p.node}
Labels:       ${p.owner ? `app=${p.owner}\n              pod-template-hash=${p.hash}` : `run=${p.name}`}
Status:       ${st === 'Running' ? 'Running' : 'Pending'}
IP:           ${p.ip}
Controlled By:  ${p.owner ? `ReplicaSet/${p.owner}-${p.hash}` : '<none>'}
Containers:
  ${p.image.split(':')[0].split('/').pop()}:
    Image:          ${p.image}
    State:          ${st === 'Running' ? 'Running' : 'Waiting\n      Reason:       ContainerCreating'}
    Ready:          ${st === 'Running' ? 'True' : 'False'}
    Restart Count:  ${p.restarts}
QoS Class:        BestEffort
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  ${age(now - p.created).padEnd(5)} default-scheduler  Successfully assigned ${p.namespace}/${p.name} to ${p.node}
  Normal  Pulling    ${age(now - p.created).padEnd(5)} kubelet            Pulling image "${p.image}"${st === 'Running' ? `
  Normal  Pulled     ${age(now - p.created - 1500).padEnd(5)} kubelet            Successfully pulled image "${p.image}"
  Normal  Created    ${age(now - p.created - 2500).padEnd(5)} kubelet            Created container
  Normal  Started    ${age(now - p.created - 3000).padEnd(5)} kubelet            Started container` : ''}`);
      }
      if (kind === 'deployments') {
        const d = state.deployments.find((x) => x.name === name && x.namespace === ns);
        if (!d) return err(`Error from server (NotFound): deployments.apps "${name}" not found`);
        const pods = state.pods.filter((p) => p.owner === d.name);
        const ready = pods.filter((p) => podStatus(p, now) === 'Running').length;
        return ok(state, `Name:                   ${d.name}
Namespace:              ${d.namespace}
Selector:               app=${d.name}
Replicas:               ${d.replicas} desired | ${pods.length} updated | ${pods.length} total | ${ready} available | ${pods.length - ready} unavailable
StrategyType:           RollingUpdate
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=${d.name}
  Containers:
   ${d.image.split(':')[0].split('/').pop()}:
    Image:  ${d.revisions.at(-1)!.image}
NewReplicaSet:   ${d.name}-${d.revisions.at(-1)!.hash} (${pods.length}/${d.replicas} replicas created)
Events:
  Type    Reason             From                   Message
  Normal  ScalingReplicaSet  deployment-controller  Scaled up replica set ${d.name}-${d.revisions.at(-1)!.hash} to ${d.replicas}`);
      }
      if (kind === 'nodes') {
        const n = state.nodes.find((x) => x.name === name);
        if (!n) return err(`Error from server (NotFound): nodes "${name}" not found`);
        const pods = state.pods.filter((p) => p.node === n.name);
        return ok(state, `Name:               ${n.name}
Roles:              ${n.role}
Taints:             ${n.role === 'control-plane' ? 'node-role.kubernetes.io/control-plane:NoSchedule' : n.schedulable ? '<none>' : 'node.kubernetes.io/unschedulable:NoSchedule'}
Unschedulable:      ${!n.schedulable}
Conditions:
  Type             Status
  MemoryPressure   False
  DiskPressure     False
  PIDPressure      False
  Ready            True
Capacity:
  cpu:     4
  memory:  8Gi
  pods:    110
Non-terminated Pods: (${pods.length} in total)
${pods.map((p) => `  ${p.namespace.padEnd(12)} ${p.name}`).join('\n') || '  <none>'}`);
      }
      if (kind === 'services') {
        const s = state.services.find((x) => x.name === name && x.namespace === ns);
        if (!s) return err(`Error from server (NotFound): services "${name}" not found`);
        const eps = state.pods.filter((p) => p.owner === s.selector && p.namespace === ns && podStatus(p, now) === 'Running');
        return ok(state, `Name:              ${s.name}
Namespace:         ${s.namespace}
Selector:          ${s.selector ? `app=${s.selector}` : '<none>'}
Type:              ${s.type}
IP:                ${s.clusterIP}
Port:              <unset>  ${s.port}/TCP
TargetPort:        ${s.targetPort}/TCP${s.nodePort ? `\nNodePort:          <unset>  ${s.nodePort}/TCP` : ''}
Endpoints:         ${eps.map((p) => `${p.ip}:${s.targetPort}`).join(',') || '<none>'}`);
      }
      return err(`error: describe de ${kind} não suportado no simulador`);
    }

    case 'logs': {
      const name = pos[0];
      const p = state.pods.find((x) => x.name === name && x.namespace === ns);
      if (!p) return err(`error: pods "${name ?? ''}" not found`);
      if (podStatus(p, now) !== 'Running') return err(`Error from server (BadRequest): container in pod "${name}" is waiting to start: ContainerCreating`);
      if (p.image.startsWith('nginx')) {
        return ok(state, `/docker-entrypoint.sh: Configuration complete; ready for start up
2026/09/27 12:00:01 [notice] 1#1: nginx/${p.image.split(':')[1] ?? 'latest'}
2026/09/27 12:00:01 [notice] 1#1: start worker processes
10.244.0.1 - - [27/Sep/2026:12:00:15 +0000] "GET / HTTP/1.1" 200 615 "-" "kube-probe/1.34"`);
      }
      return ok(state, `[${p.image}] iniciado com sucesso\n[${p.image}] escutando na porta 8080`);
    }

    case 'top': {
      if (kinds[pos[0]] === 'nodes') {
        return ok(state, table([['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)'], ...state.nodes.map((n) => {
          const c = state.pods.filter((p) => p.node === n.name).length;
          const cpu = (n.role === 'control-plane' ? 180 : 60) + c * 5;
          return [n.name, `${cpu}m`, `${Math.round(cpu / 40)}%`, `${900 + c * 12}Mi`, `${Math.round((900 + c * 12) / 81.92)}%`];
        })]));
      }
      if (kinds[pos[0]] === 'pods') {
        const pods = state.pods.filter((p) => p.namespace === ns && podStatus(p, now) === 'Running');
        if (!pods.length) return ok(state, `No resources found in ${ns} namespace.`);
        return ok(state, table([['NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...pods.map((p) => [p.name, `${1 + (p.ip.length % 4)}m`, `${3 + (p.name.length % 5)}Mi`])]));
      }
      return err('error: uso: kubectl top nodes|pods');
    }

    case 'cordon':
    case 'uncordon': {
      const n = state.nodes.find((x) => x.name === pos[0]);
      if (!n) return err(`Error from server (NotFound): nodes "${pos[0] ?? ''}" not found`);
      const schedulable = verb === 'uncordon';
      return ok({ ...state, nodes: state.nodes.map((x) => (x === n ? { ...x, schedulable } : x)) }, `node/${n.name} ${schedulable ? 'uncordoned' : 'cordoned'}`);
    }

    case 'apply':
      return err('apply -f não é suportado no terminal simulado (não há sistema de arquivos). Use create/expose/scale.');

    default:
      return err(`error: unknown command "${verb}" for "kubectl"\nDigite "help" para ver os comandos suportados.`);
  }
}

export const completions = (state: ClusterState) => [
  'kubectl', 'get', 'describe', 'create', 'deployment', 'expose', 'scale', 'delete', 'set', 'image', 'rollout', 'status', 'history', 'undo', 'restart', 'logs', 'top',
  'cordon', 'uncordon', 'run', 'nodes', 'pods', 'deploy', 'svc', 'rs', 'all', 'namespaces', '--image=', '--replicas=', '--port=', '--target-port=', '--type=', '-o', 'wide',
  ...state.nodes.map((n) => n.name), ...state.pods.map((p) => p.name), ...state.deployments.map((d) => d.name), ...state.deployments.map((d) => `deployment/${d.name}`),
];
