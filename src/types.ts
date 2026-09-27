export type SimulatorId =
  | 'deployment'
  | 'rolling-update'
  | 'service'
  | 'scheduler'
  | 'hpa'
  | 'pod-lifecycle'
  | 'terminal'
  | 'network-policy'
  | 'rbac'
  | 'drain-pdb'
  | 'qos'
  | 'storage'
  | 'ingress'
  | 'dns'
  | 'statefulset'
  | 'cronjob'
  | 'cluster-autoscaler'
  | 'gateway-api'
  | 'rbac-lab'
  | 'helm-release'
  | 'helm-lint'
  | 'helm-values'
  | 'helm-template'
  | 'helm-helpers'
  | 'helm-dependencies'
  | 'helm-hooks'
  | 'helm-semver'
  | 'helm-upgrade'
  | 'ts-diagnosis'
  | 'ts-exit-code'
  | 'ts-scheduling'
  | 'ts-network-path'
  | 'ts-node'
  | 'ts-volume'
  | 'ts-control-plane'
  | 'ts-tools'
  | 'op-reconcile'
  | 'op-crd-builder'
  | 'op-schema'
  | 'op-status'
  | 'op-kopf-handlers'
  | 'op-kopf-retries'
  | 'op-finalizers'
  | 'op-versions'
  | 'op-rbac';

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  content: string;
  simulator?: SimulatorId;
  /** Simuladores adicionais exibidos na lição. */
  extraSimulators?: SimulatorId[];
  quiz: Question[];
}

export type Level = 'Básico' | 'Intermediário' | 'Avançado';

export interface Module {
  id: string;
  title: string;
  description: string;
  level: Level;
  emoji: string;
  lessons: Lesson[];
}
