# Jack Academy — Kubernetes na prática

Plataforma gratuita e interativa para aprender Kubernetes, inspirada no projeto
[Dinamos](https://github.com/flaviojmendes/dinamos) (sistemas distribuídos).

- **13 módulos / 80 lições** — começando pelo **pré-requisito de Containers (Docker)** (10 lições: kernel, imagens, Dockerfile, builds, volumes, redes, Compose, segurança e a ponte para o Kubernetes), depois do "o que é Kubernetes" até Gateway API, RBAC, um **curso completo de Helm** (9 lições), um **curso completo de Troubleshooting** (8 lições), um **curso completo de CRDs e Operators com Kopf** (9 lições), um **curso completo de Pentest em Kubernetes** (10 lições: metodologia e escopo, recon, acesso anônimo, enumeração, escalada de RBAC, workloads perigosos, movimento lateral, segredos, ferramentas e relatório — sempre com correção) e, por fim, um **curso completo de Hardening em Kubernetes** (10 lições: modelo de ameaças, control plane/kubelet/etcd, RBAC, tokens, Pod Security, rede zero trust, Secrets, supply chain, runtime e resposta a incidentes).
- **800 perguntas** de quiz (10 por lição, aprovação com 70%) + **prova final** com 35 perguntas sorteadas.
- **Certificado de aprovação em PDF**: após atingir 70% na prova final, o aluno informa seu nome completo e emite o documento, disponível também no perfil.
- **65 simuladores** interativos (também embutidos nas lições relacionadas):
  - ⌨️ Terminal `kubectl` com cluster simulado e missões guiadas
  - ♻️ Self-healing (ReplicaSet + scheduler + nós caindo)
  - 🚀 Rolling update (maxSurge / maxUnavailable / rollback)
  - 🔀 Service e endpoints (labels, readiness, balanceamento)
  - 🧩 Scheduler (requests, taints, LeastAllocated x MostAllocated)
  - 📈 HPA (fórmula real, tolerância, janela de estabilização)
  - 🩺 Ciclo de vida (CrashLoopBackOff, OOMKilled, ImagePullBackOff, probes)
  - 🛡️ NetworkPolicy (default deny, allows, namespaceSelector, DNS)
  - 🔐 RBAC (`kubectl auth can-i`, Role × ClusterRole, bindings)
  - 🧑‍🔧 RBAC: laboratório de menor privilégio (missões, subrecursos, apiGroups, YAML gerado)
  - 🚪 Gateway API (listeners, allowedRoutes, HTTPRoute, filtros, canary por peso, ReferenceGrant, condições de status)
  - ⎈ Helm (um por lição): ciclo de vida da release, anatomia e `helm lint`, merge de values e tipos, motor de templates Go + Sprig,
    nomes/labels/checksum, dependências, hooks e testes, restrições SemVer, three-way merge
  - 🧯 Troubleshooting (um por lição): árvore de diagnóstico, exit codes e backoff, mensagem FailedScheduling, caminho da requisição
    (DNS → Service → endpoints → NetworkPolicy → container), nó em apuros, PVC e volumes, control plane sob falha, desafio de ferramentas
  - 🧬 CRDs e Operators (um por lição): loop de reconciliação, montador de CRD, schema/pruning/CEL com editor YAML, status e observedGeneration,
    handlers do Kopf, erros e retentativas, finalizers e garbage collection, versões e conversão, RBAC/peering em produção
  - 🛡️ Hardening (um por lição): cadeia de ataque com defesa em profundidade, auditoria CIS, risco de RBAC, tokens de ServiceAccount,
    Pod Security Admission, zero trust com NetworkPolicy, vetores de vazamento de Secrets, políticas de imagem, runtime e política de auditoria
  - 🔧 Drain e PodDisruptionBudget (evictions bloqueadas, drain travado)
  - ⚖️ QoS e despejo (Guaranteed/Burstable/BestEffort, OOMKilled, ordem do kubelet)
  - 💾 PV, PVC e StorageClass (bind estático, provisionamento dinâmico, WaitForFirstConsumer, reclaimPolicy)
  - 🌐 Roteamento de Ingress (host exato × curinga, Prefix × Exact, defaultBackend)
  - 📖 DNS e ndots (domínios de busca, consultas geradas, FQDN)
  - 🗄️ StatefulSet (ordinais, OrderedReady × Parallel, PVCs persistentes)
  - ⏰ CronJob (Allow/Forbid/Replace, backoffLimit, histórico)
  - 🏗️ Cluster Autoscaler (scale up por Pods Pending, scale down, safe-to-evict)
- **86 estudos de caso** de problemas recorrentes: você lê os sintomas, dá o diagnóstico e só então vê investigação, causa raiz, correção e prevenção
  (CrashLoopBackOff por config, OOMKilled em Java, Pods Pending, Service sem endpoints, DNS de 5 s, ImagePullBackOff, DiskPressure,
  CPU throttling, 502 no deploy, drain travado por PDB, rota não anexada ao Gateway, backend sem ReferenceGrant, hostname sem
  interseção, apiGroup errado no RBAC, subrecursos pods/log e pods/exec, ServiceAccount com privilégio excessivo e 12 casos de Helm:
  operação pendente, listas substituídas, números em values, recurso sem dono, selector imutável, CRDs, hook já existente, config sem
  rollout, nome > 63, senha do PostgreSQL após reinstalação, HPA resetado e dependência faltando; e 10 casos de troubleshooting: nó NotReady por containerd, namespace preso em
  Terminating, Multi-Attach, Pod preso em Terminating, liveness sob carga, loop no CoreDNS, webhook fora do ar, certificados expirados,
  conntrack cheio e IPs de Pod esgotados; e 12 casos de CRDs/Operators: campos podados em silêncio, status ignorado, loop de reconcile,
  finalizer órfão, CRD apagada, RBAC do operador, réplicas sem peering, webhook de conversão, storedVersions, handler não idempotente,
  filhos órfãos e observedGeneration; e 12 casos de containers/Docker: tag latest móvel, imagem gigante, segredo na imagem, app escutando
  em localhost, SIGTERM ignorado, dados perdidos por volume no caminho errado, permissão em volume, exec format error, depends_on,
  OOM 137 na JVM, cache de build invalidado e disco cheio; e 12 casos de hardening: Dashboard exposto, kubelet anônimo, CNI sem
  NetworkPolicy, Pod privilegiado esquecido, token de CI vazado, escalada via create pods, backup do etcd exposto, typosquatting de
  imagem, auditoria sem registro, exfiltração por egress, exec sem detecção e impersonate sem escopo).
- **Login com Google ou GitHub**, sem formulário de cadastro ou senha própria. A conta é criada no primeiro login.
- **Progresso por usuário no PostgreSQL**: melhor nota dos quizzes, lições concluídas, melhor nota da prova e primeira resposta dos estudos de caso.

## Monorepo

Requisitos: **Node.js 22.13+**, **pnpm 10.33.4** e **PostgreSQL 17** (ou Docker para subir o banco).

```text
apps/
  web/                  React + Vite + Tailwind; conteúdo e simuladores
    src/auth/           Sessão, carregamento e sincronização do progresso
    src/content/        Lições Markdown, catálogos, quizzes e casos
    src/components/     Componentes e simuladores
  api/                  NestJS + Passport OAuth + PostgreSQL
    src/auth/           Login Google/GitHub e sessões
    src/progress/       Progresso vinculado ao usuário autenticado
    database/migrations/
packages/
  contracts/            Tipos compartilhados entre frontend e API
infra/                  Proxy Nginx
```

## Desenvolvimento local

```bash
npm install --global pnpm@10.33.4
pnpm install
cp apps/api/.env.example apps/api/.env
openssl rand -hex 32
```

Cole o valor gerado em `SESSION_SECRET` no arquivo `apps/api/.env`. Preencha as credenciais OAuth conforme a seção seguinte. Nunca coloque segredos em variáveis `VITE_*`.

```bash
docker compose up -d db
pnpm dev
```

Abra **http://localhost:5173**. A API escuta na porta 3000, e o Vite encaminha `/api` para ela. Use sempre o mesmo hostname para que a sessão e o retorno do OAuth coincidam.

O banco local padrão é `postgresql://kubenautas:kubenautas@localhost:5432/kubenautas`. Se usar outro PostgreSQL, ajuste `DATABASE_URL`. Se a porta 5432 estiver ocupada, suba o banco com `POSTGRES_PORT=5433 docker compose up -d db` e ajuste a porta no arquivo da API.

As migrações rodam automaticamente antes de a API aceitar conexões, com controle de versão e bloqueio para inicialização simultânea de réplicas. Para executá-las separadamente: `pnpm db:migrate`.

O arquivo `apps/web/.env.example` contém a configuração opcional `VITE_API_URL`. No desenvolvimento e no Docker, o padrão `/api` já funciona.

## Configurar Google e GitHub

Configure os aplicativos OAuth nos provedores e preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` em `apps/api/.env`.

| Ambiente | `FRONTEND_URL` | `API_PUBLIC_URL` |
| --- | --- | --- |
| `pnpm dev` | `http://localhost:5173` | `http://localhost:5173/api` |
| Docker Compose | `http://localhost:8080` | `http://localhost:8080/api` |
| Produção | `https://seu-dominio.com` | `https://seu-dominio.com/api` |

Os callbacks registrados precisam corresponder exatamente ao ambiente:

```text
<API_PUBLIC_URL>/auth/google/callback
<API_PUBLIC_URL>/auth/github/callback
```

- **Google:** no Google Cloud/Google Auth Platform, configure a tela de consentimento e crie um cliente OAuth do tipo **Web application**. Cadastre a URI de redirecionamento, por exemplo `http://localhost:5173/api/auth/google/callback`. Enquanto o aplicativo estiver em teste, adicione os usuários de teste permitidos. São solicitados somente `openid`, `profile` e `email`.
- **GitHub:** em Settings → Developer settings → OAuth Apps, crie um aplicativo, informe a URL do frontend e o callback, por exemplo `http://localhost:5173/api/auth/github/callback`. Gere um client secret. São solicitados `read:user` e `user:email`; use aplicativos separados para desenvolvimento e produção.

Referências: [OAuth web server do Google](https://developers.google.com/identity/protocols/oauth2/web-server) e [OAuth Apps do GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

A API pode iniciar sem credenciais OAuth; os respectivos botões ficam indisponíveis. O login real exige credenciais válidas e callbacks registrados. Reinicie a API depois de mudar o ambiente.

## Comportamento das contas

- Após o login com Google ou GitHub, o usuário retorna à página que pediu autenticação, incluindo parâmetros e fragmento da URL, inclusive no primeiro acesso. O destino fica na sessão durante o OAuth e é preservado se o login precisar ser tentado novamente. Ao abrir o login diretamente, o destino padrão é `/trilha`. A apresentação em `/boas-vindas` continua disponível por acesso direto, sem ser uma etapa obrigatória do login.
- O menu da conta abre **Meu perfil** (`/perfil`), que reúne o progresso do curso e dos casos e a melhor nota da prova. Visitantes são encaminhados ao login.
- Após salvar uma nota de pelo menos 70% na prova, a tela de resultado oferece a emissão do certificado com o nome completo informado pelo aluno. Quem já passou também pode emitir pelo perfil. A API verifica a aprovação e guarda um certificado por conta, com nome, nota, data e identificador; novas solicitações recuperam o mesmo documento. A página `/certificado` permite visualizar e baixar o PDF novamente. O nome é confirmado na emissão e o certificado permanece disponível mesmo após reiniciar o progresso. A tabela é criada automaticamente pela migração `003_certificates.sql` ao iniciar a API.
- Cada certificado emitido tem uma página pública em `/certificados/:id`, acessível sem login. Ela consulta o registro pelo UUID e exibe somente nome, nota, data e identificador, sem e-mail ou dados da conta. O PDF inclui o link clicável e um QR Code; em **Meu certificado**, o titular pode copiar o link. Certificados já emitidos recebem o recurso ao baixar novamente o PDF. Demonstrações não registradas no banco não são validadas.
- O endereço de validação é montado pela API a partir de `FRONTEND_URL`, sem depender do endereço usado pelo navegador. Em produção, configure essa variável com o domínio HTTPS público da plataforma e publique frontend e API. Links com `localhost` servem somente para teste local. A hospedagem deve encaminhar `/certificados/*` para o frontend, como as demais rotas da SPA. A validação pública usa `GET /api/certificates/:id`; a emissão e a consulta do próprio certificado continuam autenticadas em `/api/certificate`.
- A trilha destaca a primeira lição ainda não concluída e organiza os módulos por nível, com uma seção de lições aberta por vez. No celular, a navegação fica em um menu expansível; os indicadores de progresso ficam no perfil.
- O conteúdo continua público. Para **responder às perguntas** dos quizzes, da prova, dos estudos de caso e dos desafios de ferramentas, é preciso entrar. Visitantes podem ler os enunciados e as soluções dos casos, sem registrar respostas ou resultados. O progresso de quem está conectado fica salvo na conta para continuar em outro dispositivo.
- Cada identidade é identificada por **provedor + identificador do usuário**. Google e GitHub permanecem contas separadas mesmo quando informam o mesmo e-mail; use o mesmo provedor para recuperar seu progresso.
- A sessão fica no PostgreSQL; o navegador recebe apenas um cookie `HttpOnly`, com validade de sete dias e `Secure` em produção. Não há tokens OAuth no localStorage ou no banco.
- O progresso é lido e alterado exclusivamente pela sessão. O cabeçalho `X-Account-Id` funciona como verificação adicional de que a aba ainda pertence à mesma conta, nunca como autorização para escolher outro usuário.
- As gravações são transacionais, preservam a melhor nota e a primeira resposta de cada caso. Uma nota de pelo menos 70% conclui a lição. Reiniciar o progresso afeta somente a conta conectada.
- Falhas de gravação aparecem na interface com uma opção de tentar novamente. Tentativas pendentes permanecem na memória da aba até o reenvio; fechar a aba ou sair da conta descarta o que ainda não foi salvo.
- O antigo `kubenautas:progress:v1` do localStorage é preservado, mas não é importado automaticamente: os dados anteriores não têm identificação de proprietário.

## Termos, privacidade e exclusão de conta

O login e o rodapé apontam para as páginas públicas `/termos-de-uso`, `/privacidade` e `/lgpd`. Os textos descrevem os recursos e dados usados pela Jack Academy, incluindo acompanhamento administrativo e validação pública de certificados. As referências institucionais e o contato são os publicados em <https://jackexperts.com/politica.html>; os direitos dos titulares também apontam para a LGPD e a ANPD. Antes de publicar, a organização deve revisar os termos e confirmar o contato, as bases legais, os operadores e as regras reais de retenção/backups da implantação. Os links informativos não registram consentimento nem representam uma certificação de conformidade LGPD.

Em **Meu perfil → Excluir minha conta**, o usuário precisa digitar `EXCLUIR` e confirmar a ação permanente. `DELETE /api/auth/account` exige sessão, `X-Account-Id`, origem autorizada, proteção CSRF e o corpo `{ "confirmation": "EXCLUIR" }`. O backend remove o usuário, progresso, atividades, certificados e todas as sessões dessa conta em uma transação. Não existe parâmetro para excluir outra pessoa. Os certificados removidos passam a responder 404 na validação pública; cópias já compartilhadas externamente não podem ser apagadas pela aplicação.

A exclusão não remove contas nos provedores nem uma conta separada criada com outro provedor. Entrar novamente cria uma nova identidade interna, sem recuperar o progresso anterior. A interface descarta resultados pendentes, limpa os dados da conta e avisa as outras abas. Não há migração nova: as relações existentes usam `ON DELETE CASCADE`. Os testes de exclusão usam apenas contas fictícias em schema isolado; a tarefa de desenvolvimento não exclui contas reais.

## Área administrativa

Acesse `/admin` para ver os indicadores e os cadastros dos últimos 30 dias, `/admin/usuarios` para buscar e filtrar contas e `/admin/usuarios/:id` para acompanhar uma pessoa. O menu da conta mostra **Administração** somente para administradores.

Configure `ADMIN_EMAILS` no ambiente da API com os e-mails verificados dos administradores, separados por vírgula, por exemplo `ADMIN_EMAILS=gestor@exemplo.com,operacao@exemplo.com`. Reinicie a API após alterar a lista. No `pnpm dev`, use `apps/api/.env`; no Docker Compose, use o `.env` da raiz; no Kubernetes, adicione a variável ao Secret `kubenautas-api`. A lista vazia bloqueia todo acesso administrativo. A API verifica a sessão e a permissão a cada consulta; o frontend não concede permissões.

- **Cadastrados:** todas as identidades criadas via OAuth, inclusive administradores. Google e GitHub são contas distintas.
- **Iniciaram:** existe acesso a uma lição, caso ou simulador, início de prova ou resultado de aprendizado registrado. Concluir as boas-vindas, sozinho, não conta como início.
- **Concluíram:** todas as lições do catálogo atual estão concluídas. A aprovação na prova final aparece separadamente e exige 70%.
- **Certificados:** contas com documento emitido no banco.

A ficha individual reúne cadastro, último login, última atividade, melhores notas por lição, primeira resposta de cada caso, prova, certificado e histórico paginado. A migração `004_admin_activity.sql` inicia o registro de acessos às páginas de conteúdo e das novas tentativas de quiz/prova, respostas de casos e emissões. Resultados antigos entram nos indicadores e na ficha, mas visitas e tentativas anteriores não são inventadas. Simuladores abertos são os laboratórios acessados pela página de simuladores; não representam conclusão ou tempo de estudo. A telemetria de navegação depende da conexão; os resultados e seus eventos são salvos juntos em uma transação. Reenvios do mesmo resultado preservam o identificador do evento para não duplicar o histórico.

As métricas usam o catálogo compartilhado em `packages/contracts/src/learning-catalog.ts`. Depois de alterar lições, casos ou simuladores, execute `pnpm --filter @jack-academy/web catalog` e reconstrua os contratos. Os testes verificam a correspondência com o conteúdo do frontend.

## Comandos e testes

```bash
pnpm dev              # frontend + API
pnpm dev:web          # somente frontend
pnpm dev:api          # somente API
pnpm build            # compila os três pacotes
pnpm test             # frontend; integração da API exige TEST_DATABASE_URL
pnpm db:migrate       # aplica migrações
pnpm preview          # frontend compilado; mantenha a API rodando
```

Para testar também OAuth, sessões e isolamento no PostgreSQL:

```bash
TEST_DATABASE_URL=postgresql://kubenautas:kubenautas@localhost:5432/kubenautas pnpm test
```

Os testes criam e removem um schema exclusivo, sem apagar tabelas da aplicação. O usuário do banco de teste precisa poder criar schemas. Somente as chamadas HTTP aos provedores são simuladas: Passport, PKCE, estado OAuth, cookies, API e banco são exercitados de verdade. A CI executa essa suíte com PostgreSQL.

Os builds ficam em `apps/web/dist`, `apps/api/dist` e `packages/contracts/dist`. Para conferir o preview na porta 4173 com login, ajuste também `FRONTEND_URL`, `API_PUBLIC_URL` e os callbacks.

## Docker Compose

```bash
cp .env.example .env
openssl rand -hex 32
# Preencha SESSION_SECRET e as credenciais OAuth em .env.
docker compose up --build -d
```

Abra **http://localhost:8080**. O Compose sobe frontend Nginx, API e PostgreSQL; o volume `postgres-data` preserva contas, sessões e progresso. Neste modo, o Compose usa o `.env` da raiz, não `apps/api/.env`. `docker compose down` mantém o banco; a opção `-v` remove os dados.

Para produção, coloque o frontend atrás de um proxy HTTPS, configure `NODE_ENV=production`, `SESSION_COOKIE_SECURE=true` e as duas URLs públicas HTTPS. Use uma senha própria para o banco e um `SESSION_SECRET` aleatório persistente. O proxy externo deve sobrescrever `X-Forwarded-Proto`; a API confia no Nginx imediatamente à sua frente (`TRUST_PROXY=1`). Sirva frontend e `/api` no mesmo domínio.

## Kubernetes

O manifesto `k8s/kubenautas.yaml` usa duas imagens e um PostgreSQL já acessível pelo cluster. Crie um Secret chamado `kubenautas-api` com `DATABASE_URL`, `SESSION_SECRET` e as quatro credenciais OAuth. Não versione valores reais. Ajuste `FRONTEND_URL` e `API_PUBLIC_URL` no manifesto para seu domínio.

```bash
docker build --target api -t kubenautas-api:1.0 .
docker build --target web -t kubenautas-web:1.0 .
# Se usar kind:
kind load docker-image kubenautas-api:1.0 kubenautas-web:1.0
kubectl apply -f k8s/kubenautas.yaml
```

Exponha o serviço `kubenautas` por um Ingress HTTPS. O Nginx encaminha `/api` ao serviço `kubenautas-api`. Todas as réplicas compartilham o mesmo banco e segredo de sessão.

O workflow que publicava somente arquivos estáticos no GitHub Pages foi convertido em CI de testes e builds. A aplicação completa agora precisa hospedar também a API e o PostgreSQL; não há publicação automática configurada.

## Conteúdo

Para adicionar uma lição, crie o Markdown em `apps/web/src/content/<modulo>/` e registre-a com o quiz em `modules.ts` ou no catálogo específico do módulo. Simuladores ficam em `apps/web/src/components/simulators/`; estudos de caso usam o marcador `<!-- solucao -->` para separar sintomas e solução.

O catálogo `/simuladores` organiza os laboratórios em sete temas, com busca por título e descrição. Os filtros `tema` e `q` permanecem na URL ao abrir e voltar de um laboratório. Cada simulador mantém seu link `/simuladores/:id`. Ao adicionar um simulador, registre-o também em uma categoria de `apps/web/src/components/simulators/catalog.ts`; os testes verificam que todos aparecem exatamente uma vez.

Os laboratórios abrem em uma área que ocupa toda a janela, com menu recolhível, busca entre os 65 simuladores e navegação por tema. No celular, o menu abre em uma gaveta. O guia reúne a descrição e os links para lições e casos relacionados. O terminal `kubectl` oferece 23 missões em cinco níveis, com dicas, soluções e cenários de troubleshooting. Seu cluster Kubernetes v1.31 simulado tem um control plane e dois workers, shell, arquivos YAML, editor, recursos em tempo real, histórico e autocompletar. `Shift+Enter` insere uma nova linha e `Ctrl+C` interrompe comandos. Limpar preserva os recursos; reiniciar apaga cluster, arquivos e progresso. O motor e as missões foram adaptados do arquivo `kube-sim-main.zip`; veja [a documentação da integração](apps/web/src/components/simulators/kube-sim/README.md). `Shift+Tab` sai do campo do terminal. Os experimentos recomeçam ao trocar de laboratório, recarregar a página ou mudar de conta; os simuladores embutidos nas lições mantêm sua apresentação compacta.

## Identidade da plataforma

A marca pública é **Jack Academy**, uma iniciativa da Jack Experts. O logotipo vetorial, com a assinatura academy e os detalhes do frasco em azul, está em `apps/web/src/assets/jack-academy-logo.svg`. Na navbar, `jack-academy-horizontal.svg` combina Jack com o frasco e as bolhas amarelas originais (`jack-lettering.svg`) e academy azul, com o mesmo desenho geométrico, altura e espessura das letras. O símbolo próprio da Academy é um A geométrico com livro aberto em tons de azul, em `apps/web/src/assets/jack-academy-mark.svg`, também usado no favicon e no selo do certificado. O nome e o símbolo da navegação são compartilhados em `components/Brand.tsx`. A chamada da home usa a logo original da Jack Experts.

O domínio do tunnel permanece o mesmo. Os identificadores existentes do banco, dos serviços Kubernetes, das imagens de deploy e do cookie `kubenautas.sid` são mantidos por compatibilidade com a implantação e as sessões atuais. O nome antigo não é usado como marca na interface. As referências à Jack Experts identificam a organização responsável e seus canais institucionais.

A revisão de comportamento dos 65 laboratórios, versões de referência, correções e simplificações está em [docs/laboratory-fidelity-audit.md](docs/laboratory-fidelity-audit.md).
