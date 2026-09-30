import type { Level, SimulatorId } from '../types';

export const learningStages: { level: Level; title: string; description: string }[] = [
  { level: 'Básico', title: 'Construa a base', description: 'Entenda containers, conheça o cluster e coloque suas primeiras aplicações para rodar.' },
  { level: 'Intermediário', title: 'Conecte sua aplicação', description: 'Faça os serviços se comunicarem, configure a aplicação e preserve seus dados.' },
  { level: 'Avançado', title: 'Opere com confiança', description: 'Aprofunde-se em escala, Helm, diagnóstico, Operators e segurança de clusters.' },
];

interface SimulatorGroup {
  id: string;
  title: string;
  description: string;
  experiments: { id: SimulatorId; outcome: string }[];
}

export const simulatorGroups: SimulatorGroup[] = [
  {
    id: 'workloads', title: 'Deploy e escala',
    description: 'Descubra como o cluster mantém aplicações disponíveis e responde a mudanças de versão ou de carga.',
    experiments: [
      { id: 'deployment', outcome: 'Entender como o ReplicaSet repõe Pods e mantém o número desejado de réplicas.' },
      { id: 'rolling-update', outcome: 'Relacionar os limites do rollout à disponibilidade e saber quando fazer rollback.' },
      { id: 'hpa', outcome: 'Entender como utilização, requests e meta de CPU influenciam o número de réplicas.' },
    ],
  },
  {
    id: 'network', title: 'Rede e acesso',
    description: 'Acompanhe o caminho de uma requisição e entenda por que ela chega à aplicação ou é bloqueada.',
    experiments: [
      { id: 'service', outcome: 'Identificar como selectors e readiness determinam quais Pods recebem tráfego.' },
      { id: 'gateway-api', outcome: 'Entender a ligação entre listeners, rotas e backends no roteamento de uma requisição.' },
      { id: 'network-policy', outcome: 'Reconhecer as permissões de rede necessárias para uma aplicação funcionar, incluindo DNS.' },
    ],
  },
  {
    id: 'diagnosis', title: 'Diagnóstico',
    description: 'Parta do sintoma, teste uma hipótese e escolha a próxima investigação com base nas evidências.',
    experiments: [
      { id: 'ts-diagnosis', outcome: 'Transformar o status de um Pod em uma sequência de investigação.' },
      { id: 'ts-scheduling', outcome: 'Ler FailedScheduling e distinguir falta de recursos de restrições de agendamento.' },
      { id: 'ts-network-path', outcome: 'Localizar em qual ponto do caminho de rede uma falha afeta o cliente.' },
    ],
  },
  {
    id: 'helm', title: 'Helm',
    description: 'Inspecione o que um chart vai produzir antes de instalar e entenda o que muda durante um upgrade.',
    experiments: [
      { id: 'helm-values', outcome: 'Prever qual valor prevalece ao combinar arquivos e opções da linha de comando.' },
      { id: 'helm-template', outcome: 'Relacionar values e templates ao manifesto final e interpretar erros de renderização.' },
      { id: 'helm-upgrade', outcome: 'Entender como o Helm considera alterações feitas diretamente no cluster.' },
    ],
  },
  {
    id: 'operators', title: 'Operators',
    description: 'Explore os mecanismos usados para estender a API e automatizar a operação de aplicações.',
    experiments: [
      { id: 'op-reconcile', outcome: 'Entender por que um controller reconcilia estados e precisa lidar com eventos perdidos.' },
      { id: 'op-schema', outcome: 'Ver como schemas, defaults e regras de validação afetam um recurso customizado.' },
      { id: 'op-finalizers', outcome: 'Identificar o que impede a exclusão de um recurso e como funciona a limpeza dos dependentes.' },
    ],
  },
  {
    id: 'security', title: 'Segurança',
    description: 'Avalie controles de proteção e pratique decisões de segurança em cenários simulados.',
    experiments: [
      { id: 'hd-attack-path', outcome: 'Identificar em que etapa cada defesa interrompe ou detecta uma cadeia de ataque.' },
      { id: 'hd-pss', outcome: 'Reconhecer configurações de Pods que violam os níveis baseline e restricted.' },
      { id: 'pt-scope', outcome: 'Decidir se uma ação está dentro da autorização, do escopo e da janela de um teste.' },
    ],
  },
];
