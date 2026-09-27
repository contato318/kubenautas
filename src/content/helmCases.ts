import type { Question, SimulatorId } from '../types';

/** Metadados dos estudos de caso de Helm (o conteúdo fica em casos/helm-*.md). */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export interface CaseMeta {
  slug: string;
  title: string;
  summary: string;
  area: string;
  severity: 'Média' | 'Alta' | 'Crítica';
  diagnosis: Question;
  simulator?: SimulatorId;
}

export const helmCaseMeta: CaseMeta[] = [
  {
    slug: 'helm-operacao-em-andamento', title: '"another operation is in progress" em todo deploy', area: 'Helm', severity: 'Alta', simulator: 'helm-release',
    summary: 'Um job de CI cancelado no meio do upgrade e, desde então, nenhum deploy passa.',
    diagnosis: q('Qual o caminho de correção mais seguro?', ['Apagar o namespace', 'helm rollback para a última revisão deployed', 'helm uninstall e install', 'Esperar 24 horas'], 1, 'A revisão ficou pending-upgrade; o rollback cria uma revisão nova consistente e destrava a release.'),
  },
  {
    slug: 'helm-listas-substituidas', title: 'A API parou de achar o banco depois de "só mudar o log"', area: 'Helm', severity: 'Crítica', simulator: 'helm-values',
    summary: 'Um override de uma variável de ambiente fez duas outras sumirem.',
    diagnosis: q('Por que DB_HOST sumiu?', ['Bug do Kubernetes', 'Listas não são mescladas no merge de values: a lista de prod substituiu a padrão inteira', 'O ConfigMap expirou', 'Falta de RBAC'], 1, 'Mapas se mesclam; listas são substituídas.'),
  },
  {
    slug: 'helm-numeros-em-values', title: 'A imagem 2.0240501e+07 não existe', area: 'Helm', severity: 'Alta', simulator: 'helm-values',
    summary: 'Tags numéricas no values.yaml viraram notação científica e 1.10 virou 1.1.',
    diagnosis: q('Qual a causa?', ['O registry converteu a tag', 'Números em arquivos de values viram float64 e o Go os imprime assim', 'O Kubernetes não aceita tags numéricas', 'Erro no Dockerfile'], 1, 'Coloque aspas (ou use --set-string) em tags e versões.'),
  },
  {
    slug: 'helm-recurso-sem-dono', title: '"invalid ownership metadata" ao migrar para Helm', area: 'Helm', severity: 'Média', simulator: 'helm-release',
    summary: 'O primeiro helm install falha porque os recursos já existem, criados com kubectl apply.',
    diagnosis: q('O que o Helm está exigindo?', ['Que o namespace seja apagado', 'Que o recurso tenha o label managed-by: Helm e as annotations meta.helm.sh/release-name e release-namespace', 'Uma versão nova do kubectl', 'Um ReferenceGrant'], 1, 'Com essas marcas, o Helm adota o recurso sem recriá-lo.'),
  },
  {
    slug: 'helm-selector-imutavel', title: 'Upgrade do chart 2.0 falha com "field is immutable"', area: 'Helm', severity: 'Alta', simulator: 'helm-helpers',
    summary: 'O novo helper de labels incluiu a versão da aplicação no selector.',
    diagnosis: q('Qual a causa do erro?', ['O Deployment está sem réplicas', 'spec.selector é imutável e passou a incluir um label que muda (version)', 'Falta de CPU', 'O chart está sem appVersion'], 1, 'O selector deve conter só labels estáveis (name e instance).'),
  },
  {
    slug: 'helm-crds-nao-atualizam', title: 'O operador novo não aceita os recursos novos', area: 'Helm', severity: 'Média', simulator: 'helm-lint',
    summary: 'Upgrade do chart do operador passou, mas o campo novo é rejeitado: unknown field.',
    diagnosis: q('Por que a API não conhece o campo novo?', ['O operador não reiniciou', 'CRDs no diretório crds/ não são atualizadas pelo helm upgrade', 'O kubectl está desatualizado', 'Falta um webhook'], 1, 'Atualize as CRDs explicitamente (ou gerencie-as como templates).'),
  },
  {
    slug: 'helm-hook-job-ja-existe', title: 'Deploy bloqueado por um Job de migração que "já existe"', area: 'Helm', severity: 'Alta', simulator: 'helm-hooks',
    summary: 'Uma migração falhou uma vez e, desde então, todo upgrade para no pre-upgrade.',
    diagnosis: q('O que faltou na annotation do hook?', ['hook-weight', 'before-hook-creation na hook-delete-policy', 'helm.sh/resource-policy: keep', 'Um ServiceAccount'], 1, 'Só hook-succeeded deixa o Job falho no cluster e bloqueia a próxima criação.'),
  },
  {
    slug: 'helm-config-sem-rollout', title: 'Mudei a configuração pelo Helm e nada mudou', area: 'Helm', severity: 'Média', simulator: 'helm-helpers',
    summary: 'ConfigMap atualizado, upgrade com sucesso, Pods com 6 dias e o valor antigo.',
    diagnosis: q('Por que os Pods não pegaram o valor novo?', ['O Helm não atualizou o ConfigMap', 'O template do Pod não mudou, então não houve rollout; env é lido só na criação do container', 'O cache do DNS', 'O HPA reverteu'], 1, 'A annotation checksum/config resolve.'),
  },
  {
    slug: 'helm-nome-maior-que-63', title: 'Ambiente efêmero falha por causa do nome da branch', area: 'Helm', severity: 'Média', simulator: 'helm-helpers',
    summary: 'Um nome de branch longo gerou um Service com mais de 63 caracteres.',
    diagnosis: q('Qual correção no chart?', ['Aumentar o limite no API server', 'trunc 63 | trimSuffix "-" no helper de nome (e releases curtas no pipeline)', 'Usar maiúsculas', 'Remover o Service'], 1, 'DNS labels têm no máximo 63 caracteres.'),
  },
  {
    slug: 'helm-senha-postgres-reinstalacao', title: 'Depois de reinstalar, a aplicação não autentica no PostgreSQL', area: 'Helm', severity: 'Alta', simulator: 'helm-hooks',
    summary: 'uninstall + install gerou uma senha nova, mas o banco manteve a antiga.',
    diagnosis: q('O que explica a falha de autenticação?', ['O PostgreSQL está fora do ar', 'O PVC sobreviveu ao uninstall com a senha antiga, e o install gerou uma senha nova no Secret', 'Falta de NetworkPolicy', 'Versão errada do chart'], 1, 'uninstall não apaga PVCs de StatefulSets.'),
  },
  {
    slug: 'helm-hpa-resetado-no-deploy', title: 'Cada deploy derruba a capacidade durante o pico', area: 'Helm', severity: 'Crítica', simulator: 'helm-upgrade',
    summary: 'O HPA escala para 17 réplicas; cada helm upgrade volta para 2.',
    diagnosis: q('Por que as réplicas voltam para 2?', ['O HPA está quebrado', 'O chart declara spec.replicas e o merge em três vias impõe o valor do chart', 'O scheduler removeu Pods', 'Falta de requests'], 1, 'Não renderize replicas quando o autoscaling estiver ligado.'),
  },
  {
    slug: 'helm-dependencia-faltando', title: 'O pipeline passou a falhar depois de adicionar o Redis', area: 'Helm', severity: 'Média', simulator: 'helm-dependencies',
    summary: 'Funciona na máquina do desenvolvedor, falha no CI: missing in charts/ directory.',
    diagnosis: q('Qual a correção?', ['Commitar charts/*.tgz', 'Commitar o Chart.lock e rodar helm dependency build no CI', 'Remover a dependência', 'Usar --force'], 1, 'build baixa exatamente o que está no lock.'),
  },
];
