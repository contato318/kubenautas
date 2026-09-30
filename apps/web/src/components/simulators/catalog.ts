import type { SimulatorId } from '../../types';
import { simulators } from './registry';

interface SimulatorCategory {
  id: string;
  title: string;
  description: string;
  simulatorIds: SimulatorId[];
}

export const simulatorCategories: SimulatorCategory[] = [
  {
    id: 'cluster', title: 'Cluster e workloads',
    description: 'Crie aplicações, provoque falhas e descubra como o cluster mantém tudo funcionando.',
    simulatorIds: ['terminal', 'deployment', 'rolling-update', 'scheduler', 'hpa', 'drain-pdb', 'qos', 'storage', 'statefulset', 'cronjob', 'cluster-autoscaler', 'pod-lifecycle'],
  },
  {
    id: 'rede', title: 'Rede e tráfego',
    description: 'Siga o caminho das requisições, conecte serviços e experimente regras de acesso à rede.',
    simulatorIds: ['service', 'network-policy', 'gateway-api', 'ingress', 'dns'],
  },
  {
    id: 'helm', title: 'Helm',
    description: 'Explore charts, combine values e acompanhe o que acontece em cada etapa de uma release.',
    simulatorIds: ['helm-release', 'helm-lint', 'helm-values', 'helm-template', 'helm-helpers', 'helm-dependencies', 'helm-hooks', 'helm-semver', 'helm-upgrade'],
  },
  {
    id: 'diagnostico', title: 'Diagnóstico',
    description: 'Investigue sintomas, teste hipóteses e encontre a causa de falhas em Pods, nós e volumes.',
    simulatorIds: ['ts-diagnosis', 'ts-exit-code', 'ts-scheduling', 'ts-network-path', 'ts-node', 'ts-volume', 'ts-control-plane', 'ts-tools'],
  },
  {
    id: 'operators', title: 'Operators',
    description: 'Estenda a API do Kubernetes e entenda reconciliação, CRDs e automação com Kopf.',
    simulatorIds: ['op-reconcile', 'op-crd-builder', 'op-schema', 'op-status', 'op-kopf-handlers', 'op-kopf-retries', 'op-finalizers', 'op-versions', 'op-rbac'],
  },
  {
    id: 'seguranca', title: 'Segurança',
    description: 'Ajuste permissões, proteja workloads e observe como cada controle reduz a exposição do cluster.',
    simulatorIds: ['rbac-lab', 'rbac', 'hd-attack-path', 'hd-cis-audit', 'hd-rbac-risk', 'hd-token', 'hd-pss', 'hd-netpol-matrix', 'hd-secrets', 'hd-admission', 'hd-runtime', 'hd-audit-policy'],
  },
  {
    id: 'pentest', title: 'Pentest',
    description: 'Pratique uma avaliação de segurança em cenários simulados, do escopo ao relatório.',
    simulatorIds: ['pt-scope', 'pt-recon', 'pt-anon', 'pt-enum', 'pt-privesc', 'pt-workload', 'pt-lateral', 'pt-loot', 'pt-tools', 'pt-report'],
  },
];

export function simulatorCategory(id: SimulatorId) {
  return simulatorCategories.find((category) => category.simulatorIds.includes(id));
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function searchSimulators(categoryId: string, query: string) {
  const category = simulatorCategories.find((item) => item.id === categoryId);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return simulators.filter((simulator) => {
    if (categoryId !== 'todos' && !category?.simulatorIds.includes(simulator.id)) return false;
    const searchable = normalize(`${simulator.title} ${simulator.description} ${simulator.id} ${simulatorCategory(simulator.id)?.title ?? ''}`);
    return terms.every((term) => searchable.includes(term));
  });
}
