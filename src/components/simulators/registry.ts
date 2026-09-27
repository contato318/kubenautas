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
  { id: 'network-policy', title: 'NetworkPolicy', emoji: '🛡️', description: 'Ligue e desligue policies e veja, conexão a conexão, o que é liberado ou bloqueado — inclusive o DNS.' },
  { id: 'gateway-api', title: 'Gateway API', emoji: '🚪', description: 'Gateway com listeners e allowedRoutes, HTTPRoutes com matches, filtros e canary por peso, ReferenceGrant e condições de status.' },
  { id: 'rbac-lab', title: 'RBAC: menor privilégio', emoji: '🧑‍🔧', description: 'Monte Roles para cumprir missões reais — com subrecursos, apiGroups e o mínimo de permissões.' },
  { id: 'rbac', title: 'RBAC (auth can-i)', emoji: '🔐', description: 'Monte Roles e bindings e descubra quem pode fazer o quê, em qual namespace, e por quê.' },
  { id: 'drain-pdb', title: 'Drain e PDB', emoji: '🔧', description: 'Drene nós para manutenção e veja o PodDisruptionBudget segurar (ou travar) as evictions.' },
  { id: 'qos', title: 'QoS e despejo', emoji: '⚖️', description: 'Ajuste requests, limits e uso de memória: veja a classe de QoS, OOMKilled e a ordem de despejo do kubelet.' },
  { id: 'storage', title: 'PV, PVC e StorageClass', emoji: '💾', description: 'Crie PVCs e veja o bind com PVs estáticos, o provisionamento dinâmico e o reclaimPolicy.' },
  { id: 'ingress', title: 'Roteamento de Ingress', emoji: '🌐', description: 'Edite regras de host e path (Prefix e Exact) e descubra qual backend atende cada URL.' },
  { id: 'dns', title: 'DNS e ndots', emoji: '📖', description: 'Veja cada consulta que o Pod faz ao resolver um nome, e por que ndots:5 multiplica o tráfego DNS.' },
  { id: 'statefulset', title: 'StatefulSet', emoji: '🗄️', description: 'Escale e mate Pods: nomes ordinais, ordem de criação e PVCs que sobrevivem aos Pods.' },
  { id: 'cronjob', title: 'CronJob e Jobs', emoji: '⏰', description: 'Um relógio acelerado com Allow, Forbid e Replace, retentativas (backoffLimit) e histórico.' },
  { id: 'cluster-autoscaler', title: 'Cluster Autoscaler', emoji: '🏗️', description: 'Pods Pending disparam novos nós; nós ociosos são removidos — a menos que algo impeça.' },
  { id: 'helm-release', title: 'Helm: ciclo de vida', emoji: '📦', description: 'install, upgrade, rollback e uninstall com histórico, status, Secrets de revisão, --atomic e a trava de operação pendente.' },
  { id: 'helm-lint', title: 'Helm: anatomia e lint', emoji: '🧾', description: 'Explore a estrutura de um chart e provoque erros clássicos para ver as mensagens reais do helm lint.' },
  { id: 'helm-values', title: 'Helm: merge de values', emoji: '🧮', description: 'Combine values.yaml, -f, --set e --set-string e veja o resultado, a origem e o tipo Go de cada chave.' },
  { id: 'helm-template', title: 'Helm: templates', emoji: '🧩', description: 'Um motor de Go templates + Sprig no navegador: edite template e values e veja o manifesto ou o erro.' },
  { id: 'helm-helpers', title: 'Helm: nomes, labels e checksum', emoji: '🏷️', description: 'Calcule o fullname (limite de 63), os labels padrão e veja o checksum decidir se os Pods reiniciam.' },
  { id: 'helm-dependencies', title: 'Helm: dependências', emoji: '🔗', description: 'condition, tags, alias e globals: quais subcharts são renderizados e quais values cada um enxerga.' },
  { id: 'helm-hooks', title: 'Helm: hooks e testes', emoji: '🪝', description: 'Fases, pesos, políticas de deleção, hooks que falham e o que sobra no cluster.' },
  { id: 'helm-semver', title: 'Helm: versões e restrições', emoji: '🔢', description: 'Qual versão ~, ^, x, intervalos e prereleases escolhem numa lista de versões publicadas.' },
  { id: 'helm-upgrade', title: 'Helm: three-way merge', emoji: '🔄', description: 'Drift, HPA e sidecars: compare o upgrade do Helm 3+ (3-way) com o do Helm 2 (2-way).' },
  { id: 'pod-lifecycle', title: 'Ciclo de vida e falhas', emoji: '🩺', description: 'Provoque CrashLoopBackOff, OOMKilled, ImagePullBackOff e falhas de probes, e leia os eventos.' },
];
