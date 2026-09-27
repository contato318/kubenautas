import type { Question, SimulatorId } from '../types';
import { helmCaseMeta } from './helmCases';
import { troubleshootingCaseMeta } from './troubleshootingCases';

/**
 * Estudos de caso de problemas recorrentes em Kubernetes.
 * O Markdown de cada caso é dividido no marcador SOLUTION_MARKER: antes dele ficam contexto e sintomas;
 * depois, investigação, causa raiz, correção e prevenção (reveladas após o diagnóstico).
 */

export const SOLUTION_MARKER = '<!-- solucao -->';

export type Severity = 'Média' | 'Alta' | 'Crítica';

export interface CaseStudy {
  slug: string;
  title: string;
  summary: string;
  area: string;
  severity: Severity;
  diagnosis: Question;
  simulator?: SimulatorId;
  symptoms: string;
  solution: string;
}

const files = import.meta.glob('./casos/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function load(slug: string) {
  const raw = files[`./casos/${slug}.md`];
  if (!raw) throw new Error(`Caso não encontrado: ${slug}`);
  const [symptoms, solution = ''] = raw.split(SOLUTION_MARKER);
  return { symptoms: symptoms.trim(), solution: solution.trim() };
}

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

const meta: Omit<CaseStudy, 'symptoms' | 'solution'>[] = [
  {
    slug: 'crashloop-config',
    title: 'CrashLoopBackOff logo após o deploy',
    summary: 'O container novo morre em menos de um segundo com exit code 1 — e mesmo assim ninguém ficou sem serviço.',
    area: 'Workloads',
    severity: 'Alta',
    simulator: 'pod-lifecycle',
    diagnosis: q(
      'Qual o próximo passo mais útil para descobrir a causa?',
      ['Aumentar o limit de memória', 'kubectl logs <pod> --previous', 'Reiniciar o nó', 'Apagar o namespace e recriar'],
      1,
      'Exit code 1 é erro da própria aplicação. Os logs da execução anterior mostram a mensagem de erro antes do crash.',
    ),
  },
  {
    slug: 'oomkilled-java',
    title: 'OOMKilled intermitente em uma aplicação Java',
    summary: 'O heap nunca passa de 70%, mas o container morre com exit code 137 nos picos.',
    area: 'Recursos',
    severity: 'Alta',
    simulator: 'qos',
    diagnosis: q(
      'Qual a causa mais provável?',
      ['Limit de CPU baixo demais', '-Xmx igual ao limit, sem espaço para a memória da JVM fora do heap', 'Liveness probe agressiva', 'Disco do nó cheio'],
      1,
      'Metaspace, threads, code cache e buffers diretos somam-se ao heap. O kernel mata o container quando o total passa do limit.',
    ),
  },
  {
    slug: 'pods-pending',
    title: 'Pods Pending com o cluster "vazio"',
    summary: 'Insufficient cpu com os nós a 35% de uso. O scheduler está quebrado?',
    area: 'Scheduling',
    severity: 'Média',
    simulator: 'scheduler',
    diagnosis: q(
      'Por que o scheduler recusa os Pods?',
      ['O uso real de CPU dos nós esgotou', 'A soma dos requests atingiu o allocatable, mesmo com uso real baixo', 'O kube-scheduler está parado', 'A imagem não existe'],
      1,
      'O scheduler considera apenas requests. Requests superdimensionados "enchem" nós ociosos.',
    ),
  },
  {
    slug: 'service-sem-endpoints',
    title: '503 no Ingress depois de "padronizar os labels"',
    summary: 'Pods Running e Ready, Service sem nenhum endpoint.',
    area: 'Rede',
    severity: 'Crítica',
    simulator: 'service',
    diagnosis: q(
      'O que provavelmente quebrou?',
      ['O Ingress Controller', 'O selector do Service não casa mais com os labels dos Pods', 'O CoreDNS', 'A readiness probe'],
      1,
      'Os Pods estão Ready, então a readiness não é o problema. Sem Pods selecionados, o Service não tem endpoints.',
    ),
  },
  {
    slug: 'dns-lento',
    title: 'Latências de exatamente 5 segundos',
    summary: 'p99 cravado em 5 s ao chamar uma API externa rápida. O tempo todo está no DNS.',
    area: 'Rede',
    severity: 'Alta',
    simulator: 'dns',
    diagnosis: q(
      'Qual combinação explica o sintoma?',
      [
        'A API externa está lenta',
        'ndots:5 multiplica as consultas e pacotes UDP de DNS perdidos custam o timeout de 5 s do resolver',
        'O Pod está sem CPU',
        'Falta um Ingress para a API externa',
      ],
      1,
      'Os NXDOMAIN com sufixos do cluster mostram a amplificação; o valor fixo de 5 s é o timeout do resolver da glibc.',
    ),
  },
  {
    slug: 'imagepullbackoff',
    title: 'ImagePullBackOff só em produção',
    summary: 'Mesmo manifesto, mesma imagem: funciona em staging e dá 401 em prod.',
    area: 'Workloads',
    severity: 'Média',
    simulator: 'pod-lifecycle',
    diagnosis: q(
      'Qual a causa mais provável?',
      ['A tag da imagem não existe', 'O Secret de credenciais do registry não existe no namespace prod', 'O nó está sem disco', 'O Docker Hub bloqueou o IP'],
      1,
      '401 indica falha de autenticação, não imagem inexistente. Secrets são por namespace.',
    ),
  },
  {
    slug: 'disk-pressure',
    title: 'Pods Evicted e nó com DiskPressure',
    summary: 'O kubelet despeja Pods de madrugada. A mensagem de eviction já entrega o culpado.',
    area: 'Recursos',
    severity: 'Alta',
    diagnosis: q(
      'Qual correção ataca a causa raiz?',
      ['Reiniciar o nó toda noite', 'Logar no stdout e limitar ephemeral-storage/emptyDir do container', 'Aumentar o limit de CPU', 'Apagar os Pods Evicted'],
      1,
      'A aplicação gravava 30Gi de logs no disco do nó. Apagar os Pods despejados só limpa o registro do incidente.',
    ),
  },
  {
    slug: 'cpu-throttling',
    title: 'API lenta com CPU "sobrando"',
    summary: 'Uso médio de 30% do limit, p99 de 900 ms e 62% dos períodos estrangulados.',
    area: 'Recursos',
    severity: 'Média',
    simulator: 'qos',
    diagnosis: q(
      'O que explica a latência alta com uso médio baixo?',
      ['Vazamento de memória', 'Throttling da CFS quota: rajadas multithread esgotam a cota de CPU em poucos milissegundos', 'DNS lento', 'Falta de réplicas no banco'],
      1,
      'A cota é aplicada a cada 100 ms. A média por minuto esconde as pausas; a métrica de períodos estrangulados revela.',
    ),
  },
  {
    slug: 'erros-502-no-deploy',
    title: 'Pico de 502 a cada deploy',
    summary: 'Rajadas de 502 por 10–20 s em todo rollout. O time parou de fazer deploy em horário comercial.',
    area: 'Workloads',
    severity: 'Alta',
    simulator: 'rolling-update',
    diagnosis: q(
      'Quais ajustes resolvem o problema?',
      [
        'Aumentar o número de réplicas',
        'Readiness probe + preStop com espera + tratamento de SIGTERM na aplicação',
        'Trocar RollingUpdate por Recreate',
        'Desativar o Ingress durante o deploy',
      ],
      1,
      'Sem readiness, Pods novos recebem tráfego cedo demais; sem preStop, Pods antigos encerram antes de saírem dos endpoints.',
    ),
  },
  {
    slug: 'drain-travado-pdb',
    title: 'Upgrade do cluster travado no drain',
    summary: 'Há 40 minutos: "Cannot evict pod as it would violate the pod’s disruption budget".',
    area: 'Operação',
    severity: 'Média',
    simulator: 'drain-pdb',
    diagnosis: q(
      'Por que o drain nunca termina?',
      [
        'O nó está sem rede',
        'O PDB exige minAvailable igual ao número de réplicas: nenhuma eviction é permitida',
        'O kubelet travou',
        'Falta a flag --force',
      ],
      1,
      'Com ALLOWED DISRUPTIONS = 0, o drain tenta de novo para sempre. Mais réplicas ou um PDB compatível resolvem.',
    ),
  },
  {
    slug: 'gateway-rota-nao-anexada',
    title: 'HTTPRoute criada, mas o site responde 404',
    summary: 'Gateway Programmed, rota aplicada sem erro, Service com endpoints — e 404 para todo mundo.',
    area: 'Gateway API',
    severity: 'Crítica',
    simulator: 'gateway-api',
    diagnosis: q(
      'Onde está o problema?',
      ['O Service não tem endpoints', 'O Gateway não aceitou a rota: allowedRoutes padrão (Same) só aceita rotas do namespace do Gateway', 'O certificado expirou', 'O DNS aponta para o IP errado'],
      1,
      'A condição Accepted=False com NotAllowedByListeners mostra que a rota nunca foi anexada ao listener.',
    ),
  },
  {
    slug: 'gateway-backend-outro-namespace',
    title: 'Checkout respondendo 500 depois da migração',
    summary: 'Rota aceita pelo Gateway, Service saudável em outro namespace, 100% de erros 500.',
    area: 'Gateway API',
    severity: 'Crítica',
    simulator: 'gateway-api',
    diagnosis: q(
      'Qual a causa mais provável?',
      ['O backend em outro namespace não foi autorizado por um ReferenceGrant', 'O Gateway está sem endereço', 'A rota não tem hostname', 'O Service precisa ser do tipo LoadBalancer'],
      0,
      'ResolvedRefs=False com RefNotPermitted: sem ReferenceGrant, o backend é inválido e a especificação manda responder 500.',
    ),
  },
  {
    slug: 'gateway-hostname-sem-intersecao',
    title: 'Um domínio antigo que o Gateway ignora',
    summary: 'A rota do domínio adquirido não funciona, enquanto as outras rotas do mesmo namespace funcionam.',
    area: 'Gateway API',
    severity: 'Alta',
    simulator: 'gateway-api',
    diagnosis: q(
      'Por que a rota não é aceita?',
      ['O namespace não tem acesso ao Gateway', 'O hostname da rota não intersecta com o hostname de nenhum listener (*.loja.com)', 'Falta um ReferenceGrant', 'HTTPRoute não suporta domínios .com'],
      1,
      'NoMatchingListenerHostname: é preciso um listener (e certificado) para api.pagamentos.com.',
    ),
  },
  {
    slug: 'rbac-apigroup-errado',
    title: 'Pipeline proibido de atualizar Deployments',
    summary: 'A Role lista "deployments" com o verbo patch, e mesmo assim o CI recebe Forbidden.',
    area: 'Segurança',
    severity: 'Média',
    simulator: 'rbac-lab',
    diagnosis: q(
      'O que está errado na Role?',
      ['Falta o verbo delete', 'deployments está no apiGroup "apps", mas a regra usa apiGroups [""] (core)', 'Roles não funcionam para ServiceAccounts', 'É preciso uma ClusterRole'],
      1,
      'A mensagem de Forbidden diz "in API group apps". Uma regra no grupo core não concede nada sobre deployments.',
    ),
  },
  {
    slug: 'rbac-logs-exec-proibidos',
    title: 'O suporte vê os Pods, mas não consegue ler logs',
    summary: 'get pods funciona; kubectl logs recebe Forbidden. Alguém sugere resources: ["*"].',
    area: 'Segurança',
    severity: 'Média',
    simulator: 'rbac-lab',
    diagnosis: q(
      'Qual a correção adequada?',
      ['resources: ["*"]', 'Adicionar get no subrecurso pods/log', 'Dar a ClusterRole cluster-admin', 'Adicionar o verbo list em pods'],
      1,
      'Subrecursos têm autorização própria. Curinga daria acesso a Secrets e exec — muito além do necessário.',
    ),
  },
  {
    slug: 'rbac-serviceaccount-superpoderosa',
    title: 'Uma aplicação invadida lendo Secrets do cluster todo',
    summary: 'O token de uma app de imagens listou Secrets de todos os namespaces após uma invasão.',
    area: 'Segurança',
    severity: 'Crítica',
    simulator: 'rbac',
    diagnosis: q(
      'Qual foi a falha de segurança que permitiu o vazamento?',
      ['O etcd sem criptografia', 'A ServiceAccount da app tinha leitura de Secrets via ClusterRoleBinding, e o token estava montado no Pod', 'Falta de NetworkPolicy', 'A imagem não era distroless'],
      1,
      'O invasor só usou as permissões que já existiam. Menor privilégio e automountServiceAccountToken: false evitariam o estrago.',
    ),
  },
];

export const cases: CaseStudy[] = [...meta, ...helmCaseMeta, ...troubleshootingCaseMeta].map((m) => ({ ...m, ...load(m.slug) }));

export const findCase = (slug: string) => cases.find((c) => c.slug === slug);
