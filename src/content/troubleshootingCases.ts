import type { CaseMeta } from './helmCases';
import type { Question } from '../types';

/** Metadados dos estudos de caso de troubleshooting (conteúdo em casos/ts-*.md). */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const troubleshootingCaseMeta: CaseMeta[] = [
  {
    slug: 'ts-no-notready-containerd', title: 'Um nó NotReady que "está ligado"', area: 'Troubleshooting', severity: 'Alta', simulator: 'ts-node',
    summary: 'Ready=False com "PLEG is not healthy" numa VM que responde a ping.',
    diagnosis: q('O que a mensagem PLEG is not healthy indica?', ['Rede do nó fora', 'O kubelet não consegue falar com o container runtime (travado ou sobrecarregado)', 'Certificado expirado', 'Disco do etcd lento'], 1, 'O kubelet está vivo (Ready=False, não Unknown), mas o runtime não responde.'),
  },
  {
    slug: 'ts-namespace-terminating', title: 'Namespace preso em Terminating há dois dias', area: 'Troubleshooting', severity: 'Média', simulator: 'ts-diagnosis',
    summary: 'O ambiente foi removido, mas o namespace nunca some e impede a recriação.',
    diagnosis: q('Qual a causa mais provável?', ['Falta de CPU', 'Objetos com finalizers de um operador que já foi desinstalado', 'Bug do kubectl', 'RBAC'], 1, 'Sem o controller, ninguém remove os finalizers.'),
  },
  {
    slug: 'ts-multi-attach', title: 'O CMS não volta depois que o nó morreu', area: 'Troubleshooting', severity: 'Alta', simulator: 'ts-volume',
    summary: 'Pod reagendado preso em ContainerCreating com Multi-Attach error.',
    diagnosis: q('Como liberar o volume com segurança?', ['Apagar o PVC', 'Confirmar que o nó antigo não existe mais e removê-lo do cluster, liberando o VolumeAttachment', 'Mudar para RWX na hora', 'Reiniciar o Pod'], 1, 'O volume RWO continua anexado ao nó morto.'),
  },
  {
    slug: 'ts-pod-preso-terminating', title: 'Pods que não terminam de terminar', area: 'Troubleshooting', severity: 'Média', simulator: 'ts-exit-code',
    summary: 'Um Pod segue Terminating há 25 minutos e trava o drain.',
    diagnosis: q('Nó saudável e sem finalizers. O que mais explicaria?', ['O scheduler', 'terminationGracePeriodSeconds muito alto e a aplicação terminando o trabalho após o SIGTERM', 'Falta de memória', 'O CoreDNS'], 1, 'O kubelet espera o grace period antes do SIGKILL.'),
  },
  {
    slug: 'ts-liveness-sob-carga', title: 'A cada pico de tráfego, todos os Pods reiniciam', area: 'Troubleshooting', severity: 'Crítica', simulator: 'ts-exit-code',
    summary: 'Reinícios em cascata sem nenhum erro nos logs da aplicação.',
    diagnosis: q('O que está reiniciando os containers?', ['OOMKilled', 'A liveness probe com timeout curto falhando quando a app está ocupada', 'O HPA', 'Um bug no kernel'], 1, 'Eventos Killing … failed liveness probe confirmam.'),
  },
  {
    slug: 'ts-coredns-loop', title: 'CoreDNS em CrashLoopBackOff num cluster novo', area: 'Troubleshooting', severity: 'Crítica', simulator: 'ts-network-path',
    summary: 'Nenhum Pod resolve nomes e o CoreDNS reinicia sem parar.',
    diagnosis: q('O log diz "Loop … detected". Por quê?', ['Falta de memória', 'O CoreDNS encaminha para 127.0.0.53 (systemd-resolved), que dentro do Pod é ele mesmo', 'NetworkPolicy', 'Certificado inválido'], 1, 'Configure o kubelet com o resolv.conf real do nó.'),
  },
  {
    slug: 'ts-webhook-fora-do-ar', title: 'Ninguém consegue fazer deploy: "failed calling webhook"', area: 'Troubleshooting', severity: 'Crítica', simulator: 'ts-control-plane',
    summary: 'Todos os deploys e o HPA falham ao mesmo tempo, em todos os namespaces.',
    diagnosis: q('Qual a causa?', ['O etcd caiu', 'O serviço de um webhook de admission com failurePolicy: Fail está fora do ar', 'Quota estourada', 'O scheduler travou'], 1, 'O API server rejeita tudo que o webhook intercepta.'),
  },
  {
    slug: 'ts-certificados-expirados', title: 'Na segunda-feira, o kubectl parou de funcionar', area: 'Troubleshooting', severity: 'Crítica', simulator: 'ts-control-plane',
    summary: 'x509: certificate has expired num cluster kubeadm nunca atualizado.',
    diagnosis: q('Por que os certificados expiraram?', ['A CA foi revogada', 'Certificados kubeadm valem 1 ano e só são renovados em upgrades ou manualmente', 'O relógio do nó', 'Um ataque'], 1, 'kubeadm certs renew all resolve.'),
  },
  {
    slug: 'ts-conntrack-cheio', title: 'Timeouts aleatórios só nos nós do gateway', area: 'Troubleshooting', severity: 'Alta', simulator: 'ts-network-path',
    summary: 'Cerca de 3% de timeouts sob tráfego alto, sem erros nas aplicações.',
    diagnosis: q('Qual evidência no nó confirma a causa?', ['OOMKilled no dmesg', '"nf_conntrack: table full, dropping packet" no dmesg', 'DiskPressure', 'PLEG not healthy'], 1, 'Com a tabela cheia, conexões novas são descartadas.'),
  },
  {
    slug: 'ts-ips-esgotados', title: 'Pods novos presos em ContainerCreating com o cluster "vazio"', area: 'Troubleshooting', severity: 'Alta', simulator: 'ts-diagnosis',
    summary: 'FailedCreatePodSandBox: o CNI não consegue atribuir IP aos Pods.',
    diagnosis: q('Onde está o problema?', ['No scheduler', 'No IPAM do CNI: a subnet/pool de IPs de Pods esgotou', 'No registry', 'No etcd'], 1, 'O Pod já tem nó; falha ao criar a rede do sandbox.'),
  },
];
