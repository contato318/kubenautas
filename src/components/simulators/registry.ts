import type { SimulatorId } from '../../types';

export interface SimulatorInfo {
  id: SimulatorId;
  title: string;
  emoji: string;
  description: string;
}

export const simulators: SimulatorInfo[] = [
  { id: 'terminal', title: 'Terminal kubectl', emoji: '⌨️', description: 'Um cluster simulado com 3 nós que responde aos principais comandos do kubectl, com missões guiadas.' },
  { id: 'deployment', title: 'Self-healing', emoji: '♻️', description: 'Mate Pods, derrube nós e mude réplicas: veja o ReplicaSet e o scheduler reconciliarem o estado.' },
  { id: 'rolling-update', title: 'Rolling update', emoji: '🚀', description: 'Ajuste maxSurge e maxUnavailable, faça deploy de uma versão quebrada e execute o rollback.' },
  { id: 'service', title: 'Service e endpoints', emoji: '🔀', description: 'Envie requisições e veja o balanceamento. Remova labels ou quebre a readiness e observe os endpoints.' },
  { id: 'scheduler', title: 'Scheduler', emoji: '🧩', description: 'Crie Pods com requests diferentes, taints e tolerations. Veja filtragem, pontuação e Pods Pending.' },
  { id: 'hpa', title: 'HPA', emoji: '📈', description: 'Aumente a carga e acompanhe o Horizontal Pod Autoscaler calcular réplicas com a fórmula real.' },
  { id: 'pod-lifecycle', title: 'Ciclo de vida e falhas', emoji: '🩺', description: 'Provoque CrashLoopBackOff, OOMKilled, ImagePullBackOff e falhas de probes, e leia os eventos.' },
];
