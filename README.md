# Kubenautas — Kubernetes na prática

Plataforma gratuita e interativa para aprender Kubernetes, inspirada no projeto
[Dinamos](https://github.com/flaviojmendes/dinamos) (sistemas distribuídos).

- **13 módulos / 80 lições** — começando pelo **pré-requisito de Containers (Docker)** (10 lições: kernel, imagens, Dockerfile, builds, volumes, redes, Compose, segurança e a ponte para o Kubernetes), depois do "o que é Kubernetes" até Gateway API, RBAC, um **curso completo de Helm** (9 lições), um **curso completo de Troubleshooting** (8 lições), um **curso completo de CRDs e Operators com Kopf** (9 lições), um **curso completo de Pentest em Kubernetes** (10 lições: metodologia e escopo, recon, acesso anônimo, enumeração, escalada de RBAC, workloads perigosos, movimento lateral, segredos, ferramentas e relatório — sempre com correção) e, por fim, um **curso completo de Hardening em Kubernetes** (10 lições: modelo de ameaças, control plane/kubelet/etcd, RBAC, tokens, Pod Security, rede zero trust, Secrets, supply chain, runtime e resposta a incidentes).
- **800 perguntas** de quiz (10 por lição, aprovação com 70%) + **prova final** com 20 perguntas sorteadas.
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
- Progresso salvo no navegador (localStorage) — sem backend, sem login.

## Rodando localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes (motor do kubectl simulado + integridade do conteúdo)
npm run build      # build de produção em dist/
npm run preview    # serve o build
```

## Rodando no Kubernetes

```bash
docker build -t kubenautas:1.0 .
kind load docker-image kubenautas:1.0
kubectl apply -f k8s/kubenautas.yaml
kubectl port-forward svc/kubenautas 8080:80
```

## Estrutura

```
src/
  content/<modulo>/<licao>.md   Texto das lições (Markdown)
  content/modules.ts            Catálogo de módulos, lições e quizzes
  content/quizzesExtra.ts       Perguntas adicionais por lição (mescladas em modules.ts)
  content/casos/<caso>.md       Estudos de caso (o marcador <!-- solucao --> separa sintomas da solução)
  content/cases.ts              Catálogo dos casos com a pergunta de diagnóstico
  content/helm/*.md             Lições do módulo de Helm (catálogo e quizzes em content/helmModule.ts)
  content/helmCases.ts          Metadados dos casos de Helm
  content/troubleshooting/*.md  Lições do módulo de Troubleshooting (catálogo e quizzes em content/troubleshootingModule.ts)
  content/troubleshootingCases.ts Metadados dos casos de troubleshooting
  content/operators/*.md        Lições do módulo de CRDs e Operators (catálogo e quizzes em content/operatorsModule.ts)
  content/operatorsCases.ts     Metadados dos casos de CRDs e Operators
  content/containers/*.md       Lições do módulo pré-requisito de Containers (catálogo e quizzes em content/containersModule.ts)
  content/containersCases.ts    Metadados dos casos de containers e Docker
  content/hardening/*.md        Lições do módulo de Hardening (catálogo e quizzes em content/hardeningModule.ts)
  content/hardeningCases.ts     Metadados dos casos de hardening
  content/pentest/*.md          Lições do módulo de Pentest (catálogo e quizzes em content/pentestModule.ts)
  content/pentestCases.ts       Metadados dos casos de pentest (avaliações autorizadas)
  components/simulators/helm/   Lógica dos simuladores de Helm: motor de templates, values, SemVer, sha256
  components/simulators/        Simuladores (cluster.ts = motor do kubectl)
  pages/                        Home, Trilha, Lição, Simuladores, Prova
  hooks/useProgress.ts          Progresso em localStorage
```

Para adicionar uma lição: crie o `.md` em `src/content/<modulo>/` e registre-o com o quiz em `modules.ts`.
# kubenautas
