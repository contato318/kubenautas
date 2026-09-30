import type { CaseMeta } from './helmCases';
import type { Question } from '../types';

/** Metadados dos estudos de caso de containers e Docker (conteúdo em casos/ct-*.md). */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const containersCaseMeta: CaseMeta[] = [
  {
    slug: 'ct-latest-mudou', title: 'Mesma imagem, comportamentos diferentes', area: 'Containers', severity: 'Alta',
    summary: 'Dois servidores com a mesma tag :latest rodando imagens diferentes.',
    diagnosis: q('Por que os servidores divergem?', ['Bug do Docker', 'latest é uma tag móvel: cada servidor rodava a imagem que tinha no último pull', 'Hardware diferente', 'Cache de DNS'], 1, 'Use tags imutáveis ou digests.'),
  },
  {
    slug: 'ct-imagem-gigante', title: 'A imagem de 2,3 GB que atrasa o autoscaling', area: 'Containers', severity: 'Média',
    summary: 'Pull de quase 4 minutos em cada nó novo.',
    diagnosis: q('Quais são as causas principais?', ['Registry lento', 'Sem .dockerignore e sem multi-stage: .git, node_modules e dependências de build na imagem final', 'Compressão desativada', 'Rede do cluster'], 1, 'Multi-stage + .dockerignore: de 2,3 GB para ~45 MB.'),
  },
  {
    slug: 'ct-segredo-na-imagem', title: 'A chave da nuvem que estava na imagem pública', area: 'Containers', severity: 'Crítica',
    summary: 'Credenciais passadas por ARG e um .env apagado depois do COPY.',
    diagnosis: q('Por que o segredo vazou mesmo com o rm?', ['O rm falhou', 'ARGs usados em RUN ficam no histórico e o arquivo continua na camada do COPY', 'O Docker Hub publicou o .env', 'O scanner copiou'], 1, 'Revogue e use RUN --mount=type=secret.'),
  },
  {
    slug: 'ct-localhost-no-container', title: 'Funciona com npm run dev, não funciona no container', area: 'Containers', severity: 'Média',
    summary: 'Porta publicada, app no ar, e curl responde Empty reply.',
    diagnosis: q('O que está errado?', ['A porta publicada', 'A aplicação escuta só em 127.0.0.1 dentro do container; precisa de 0.0.0.0', 'Firewall do host', 'Imagem corrompida'], 1, 'O tráfego chega pela interface do container.'),
  },
  {
    slug: 'ct-sigterm-ignorado', title: 'Todo deploy derruba requisições em andamento', area: 'Containers', severity: 'Alta', simulator: 'ts-exit-code',
    summary: 'docker stop sempre leva 10 s e termina com 137.',
    diagnosis: q('Por que o handler de SIGTERM nunca roda?', ['Bug do Node', 'CMD na forma shell: o sh é o PID 1 e não repassa o sinal', 'Falta de memória', 'Limite de CPU'], 1, 'Use a forma exec.'),
  },
  {
    slug: 'ct-dados-perdidos', title: 'O banco que voltou vazio depois da atualização', area: 'Containers', severity: 'Crítica',
    summary: 'Depois de trocar a tag do Postgres, o banco subiu vazio.',
    diagnosis: q('Onde estavam os dados?', ['No volume nomeado', 'Num volume anônimo: o volume nomeado estava montado no caminho errado', 'Na imagem', 'No registry'], 1, '/var/lib/postgresql/data, não /var/lib/postgres.'),
  },
  {
    slug: 'ct-permissao-volume', title: 'Permission denied ao gravar uploads', area: 'Containers', severity: 'Média',
    summary: 'Uploads falham depois de a aplicação passar a rodar como não-root.',
    diagnosis: q('Qual a causa?', ['SELinux sempre', 'O diretório montado pertence ao UID 0 e o processo roda como UID 1000', 'Disco cheio', 'Bug do Python'], 1, 'Ajuste o dono; não volte para root.'),
  },
  {
    slug: 'ct-exec-format-error', title: 'exec format error só no servidor', area: 'Containers', severity: 'Alta',
    summary: 'Imagem construída num Mac Apple Silicon falha num servidor x86_64.',
    diagnosis: q('O que significa exec format error aqui?', ['Arquivo corrompido', 'O binário é de outra arquitetura (arm64 num host amd64)', 'Falta permissão de execução', 'Kernel antigo'], 1, 'buildx --platform e builds só pelo CI.'),
  },
  {
    slug: 'ct-depends-on', title: 'A API sobe antes do banco e morre', area: 'Containers', severity: 'Média',
    summary: 'Metade das vezes, o compose up termina com connection refused.',
    diagnosis: q('Por que depends_on não resolveu?', ['Está com sintaxe errada', 'Só garante que o container do banco iniciou, não que o Postgres aceita conexões', 'Rede errada', 'Porta errada'], 1, 'condition: service_healthy + retry na aplicação.'),
  },
  {
    slug: 'ct-oom-137', title: 'O serviço Java que some sem deixar erro', area: 'Containers', severity: 'Alta', simulator: 'ts-exit-code',
    summary: 'Reinícios com exit 137 e OOMKilled=true, sem OutOfMemoryError no log.',
    diagnosis: q('Por que o container é morto?', ['Bug da JVM', '-Xmx igual ao limite: heap + memória fora do heap passam do cgroup e o kernel mata o processo', 'CPU throttling', 'Disco cheio'], 1, 'Use MaxRAMPercentage e deixe margem.'),
  },
  {
    slug: 'ct-cache-invalidado', title: 'Todo build reinstala todas as dependências', area: 'Containers', severity: 'Média',
    summary: 'Mudar um template dispara 8 minutos de pip install.',
    diagnosis: q('O que invalida o cache?', ['O registry', 'COPY . . antes do pip install: qualquer mudança no código invalida as camadas seguintes', 'A imagem base', 'O .dockerignore'], 1, 'Copie primeiro os manifestos de dependências.'),
  },
  {
    slug: 'ct-disco-cheio', title: 'O servidor de CI sem espaço em disco', area: 'Containers', severity: 'Alta',
    summary: 'no space left on device em /var/lib/docker.',
    diagnosis: q('O que ocupa o disco?', ['O kernel', 'Imagens antigas, cache de build, containers parados e logs json-file sem rotação', 'Swap', 'O registry remoto'], 1, 'docker system df, prune e rotação de logs.'),
  },
];
