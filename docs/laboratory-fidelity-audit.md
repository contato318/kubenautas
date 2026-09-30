# Revisão de comportamento dos laboratórios

Referência: Kubernetes **1.34**, versão anunciada pelo terminal. Revisão em 29/09/2026 dos **65 IDs** de `apps/web/src/components/simulators/registry.ts`. Escopo: regras dos motores, configurações iniciais, transições, mensagens e permissões dos cenários disponíveis. Não constitui teste de conformidade de uma distribuição Kubernetes nem execução de workloads reais.

Os laboratórios são independentes. Presets vulneráveis, valores editáveis, classes de armazenamento, controllers e integrações representam ambientes de exemplo, não a instalação padrão do Kubernetes. Hipóteses relevantes aparecem em **Sobre este cenário** ou no próprio laboratório. Helm usa a referência **3.17.4** para preservar a semântica dos exercícios existentes (`--atomic`, valores YAML como `float64`); não se apresenta como emulador do Helm 4.

## Controladores e infraestrutura

| ID | Resultado da revisão |
| --- | --- |
| `terminal` | Corrigidos Pods Pending sem nós disponíveis, agendamento posterior sem trocar identidade, taint do control plane separado de cordon, get por nome e seletor, namespace nas contagens e tabelas, validação de portas/namespace, NodePorts únicos e rollback para revisão escolhida. LoadBalancer sem integração fica pending. Rollout instantâneo, imagens, métricas e logs continuam didáticos e identificados. |
| `deployment` | Pod de nó inacessível não desaparece automaticamente ao entrar em Terminating; ReplicaSet pode criar substituto. Último status sem heartbeat não é apresentado como confirmação de execução. Tempos reduzidos explicitados. |
| `rolling-update` | Configuração inicial 4 réplicas/1 surge/1 unavailable, equivalente a 25%/25%; configuração zero/zero inválida não avança. Testados limites de disponibilidade e surge. Controles posteriores usam números absolutos. |
| `scheduler` | Revistos filtros de requests, taints/tolerations e reavaliação de Pending. Pontuação demonstra NodeResourcesFit, não a soma de todos os plugins do scheduler. |
| `hpa` | Corrigidos estabilização de 300s, crescimento máximo de 4 Pods ou 100% por 15s, limite após alteração de maxReplicas, tolerância e cálculo sem arredondamento prematuro. Métricas disponíveis e startup curto são hipóteses explícitas. |
| `drain-pdb` | Revistos cordon, eviction, orçamento, réplicas saudáveis e reposição. Cenário usa PDB minAvailable absoluto e o comportamento IfHealthyBudget; não representa DaemonSets ou todas as flags de drain. |
| `qos` | Guaranteed passa a exigir CPU **e** memória com requests/limits iguais e positivos. Recursos inválidos são rejeitados. Revistos OOM e ordem de despejo sob pressão de memória. Cenário de um container por Pod. |
| `storage` | WaitForFirstConsumer também adia PV estático. PVC em uso fica Terminating até remover o consumidor, antes do reclaim. Classe inexistente não quebra a tela. Drivers e topologia são exemplos. |
| `statefulset` | Mudança de podManagementPolicy recria explicitamente o StatefulSet, preservando PVCs, em vez de simular alteração de campo imutável. Revistos ordinais, OrderedReady/Parallel e retenção padrão de PVCs. |
| `cronjob` | backoffLimit padrão 6; template preservado em cada Job; retentativas com espera exponencial; Forbid recupera o último horário perdido quando possível. Revistos Allow/Replace, ausência de duplicação de horário e histórico 3/1. Job não indexado, um Pod, restartPolicy Never, sem deadline/suspend e sem simular indisponibilidade do controller. |
| `cluster-autoscaler` | Pods removidos com um nó recebem novas identidades ao serem recriados. Revistos requests, nó novo viável, mínimo/máximo e safe-to-evict. Add-on com um grupo homogêneo, apenas CPU e tempos reduzidos. |
| `pod-lifecycle` | Relógio e backoff agora usam os mesmos segundos simulados; restartCount cresce ao reiniciar, não ao morrer; espera de pull cresce; 10min saudável zera backoff. Readiness não reinicia. Probes de 3s são configuração explícita do exemplo. |

CronJob usa o [comportamento documentado de concorrência e mudança de template](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/). Para falhas de Pods de Job, a implementação **v1.34** define espera inicial de 10s e teto de **10min**, embora algumas versões da página conceitual de Jobs mencionem 6min: prevaleceu o [código da versão usada](https://github.com/kubernetes/kubernetes/blob/v1.34.0/pkg/controller/job/job_controller.go). Não confundir com o teto de 5min de CrashLoopBackOff do kubelet.

Outras referências: [HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), [QoS](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/), [proteção de PVCs](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#storage-object-in-use-protection) e [binding de StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-binding-mode).

## Rede e autorização

| ID | Resultado da revisão |
| --- | --- |
| `service` | Service sem endpoints falha na conexão, sem inventar HTTP 503. Seletores/readiness revistos; distribuição cíclica identificada como didática, não promessa do kube-proxy. |
| `network-policy` | Corrigidos peer vazio, lista vazia de portas e tráfego do Pod consigo mesmo. Revistos isolamento por direção, namespace e união de regras. Não representa protocolos, NAT ou todos os seletores. |
| `gateway-api` | Corrigidos segmentos de path, precedência entre curingas, substituição de prefixo e preservação de query/porta no redirect. Ausência de listener não inventa HTTP 404. Revistos allowedRoutes, ReferenceGrant e pesos. |
| `ingress` | Prefix não colapsa barras internas. Revistos Exact, prefixo por segmento e wildcard de um rótulo. Assume controller com o comportamento de virtual hosts mostrado. |
| `dns` | Revistos search domains, nome absoluto e ndots. Resolver, cache e paralelismo A/AAAA não são emulados. |
| `rbac` | Revistos escopo de RoleBinding/ClusterRoleBinding, verbos, grupos e subrecursos. Papéis apresentados são os exemplos do cenário. |
| `rbac-lab` | Missão de CI exige list/watch em deployments para rollout status; GitOps inclui patch em ConfigMaps. Revistos apiGroups e subrecursos. |

Referências: [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/), [HTTPRoute v1.3](https://github.com/kubernetes-sigs/gateway-api/blob/v1.3.0/apis/v1/httproute_types.go), [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) e [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/).

## Helm

| ID | Resultado da revisão |
| --- | --- |
| `helm-release` | Upgrade recupera instalação failed e marca a revisão anterior superseded; upgrade --install reutiliza uninstalled com histórico; rollback padrão usa revisão imediatamente anterior; atomic sem revisão bem-sucedida produz erro, sem exceção JS. Lista padrão omite pending. |
| `helm-lint` | `version: "1.0"` é aceita pelo Helm; exemplo inválido passou a `1.0.0.0`. Nome de recurso inválido gera WARNING no lint padrão, embora a API rejeite o recurso. |
| `helm-values` | Overrides montados antes do coalesce com defaults; --set indexado substitui lista do chart; null preservado entre camadas; escapes em pontos/vírgulas; chaves especiais tratadas como mapas Go. YAML 1.1 explicitado. |
| `helm-template` | and/or fazem curto-circuito; lookup não herda propriedades JS; quote ignora nil; leitura YAML 1.1. Mantém apenas o subconjunto de funções anunciado, sem executar Go/Sprig completos. |
| `helm-helpers` | Revistos fullname, truncamento, labels e checksum. Helpers são convenções de charts, não nomes gerados obrigatoriamente pelo Helm. |
| `helm-dependencies` | Revistos primeiro condition booleano, prioridade de condition sobre tags, alias e globals. Não instala dependências reais. |
| `helm-hooks` | Ordem por peso, kind e nome; ausência de delete-policy aplica before-hook-creation. Revistos falhas e hooks de teste sem mudar estado deployed. |
| `helm-semver` | != parcial usa alternativas corretas; prerelease verificado por termo; versões parciais aceitas; identificadores prerelease inválidos rejeitados. |
| `helm-upgrade` | Revisto merge de três vias no subconjunto de campos apresentado. Não representa todas as estratégias de merge de listas nem patches de CRDs. |

Resultados de renderização, merge, escapes, restrições de versões e lint comparados offline com o executável oficial **Helm v3.17.4**, sem cluster. Lifecycle conferido no código de [upgrade](https://github.com/helm/helm/blob/v3.17.4/pkg/action/upgrade.go), [upgrade --install](https://github.com/helm/helm/blob/v3.17.4/cmd/helm/upgrade.go) e [rollback](https://github.com/helm/helm/blob/v3.17.4/pkg/action/rollback.go). Tipos de values seguem [ReadValues dessa versão](https://github.com/helm/helm/blob/v3.17.4/pkg/chartutil/values.go); versões posteriores podem usar `json.Number`. Restrições seguem [Masterminds semver](https://github.com/Masterminds/semver/blob/v3.3.1/constraints.go).

## Diagnóstico

| ID | Resultado da revisão |
| --- | --- |
| `ts-diagnosis` | port-forward e curl separados em terminais; LimitRange define defaults, ResourceQuota limita admissão. Revistos ramos e destinos da árvore. |
| `ts-exit-code` | Códigos compatíveis com sinais são hipóteses a confirmar por Reason/signal/logs; 137 não garante OOM. Revistos backoff 10…300s e restartPolicy Always. |
| `ts-scheduling` | Revistos filtros de requests, afinidade/taints e Pending. Ausência de vítimas elegíveis para preempção explicitada. |
| `ts-network-path` | Revistos Service, EndpointSlice, readiness, DNS e caminho de conexão. Assume o modelo kube-proxy/CNI mostrado, não todos os dataplanes. |
| `ts-node` | Grace period ajustado de 40 para 50s, padrão v1.34. Eventos futuros não aparecem antecipadamente. Tolerância 300s e StatefulSet Terminating revistos. Generic PLEG é hipótese do cenário. |
| `ts-volume` | Quota que impede criar PVC também impede criar o Pod do StatefulSet; não mostra Pod Pending inexistente. Revistos classe ausente, multi-attach e permissões do volume. |
| `ts-control-plane` | Grace period 50s; explicitadas leituras possíveis em cache durante falha de etcd. Revistas dependências dos componentes. |
| `ts-tools` | Debug privilegiado do nó usa --profile=sysadmin para chroot; perfil padrão não é privilegiado. Revistas missões e comandos. |

Referências: [default de node-monitor-grace-period v1.34](https://github.com/kubernetes/kubernetes/blob/v1.34.0/pkg/controller/nodelifecycle/config/v1alpha1/defaults.go) e [debug de nós](https://kubernetes.io/docs/tasks/debug/debug-cluster/kubectl-node-debug/).

## Operators

| ID | Resultado da revisão |
| --- | --- |
| `op-reconcile` | Revistos level-triggered, deriva, exclusão e nova reconciliação. Algoritmo é do operador de exemplo, não um controller nativo. |
| `op-crd-builder` | Validação de DNS e comprimentos; kind minúsculo aceito; singular omitido recebe default; grupos protegidos incluem raiz. Revistos nomes, escopo e endpoints. |
| `op-schema` | null de campo não nullable removido antes de default/required, inclusive em Strict. Unknown fields continuam rejeitados em Strict. CEL limitado às regras do Database mostrado. |
| `op-status` | Escrita idêntica não incrementa generation sem subrecurso; mudança real de status incrementa. Revistos observedGeneration e status via endpoint principal. |
| `op-kopf-handlers` | Revistos create/update/field/delete/resume/event e mudanças ignoradas em status. Conjunto de handlers e filtros é o mostrado. |
| `op-kopf-retries` | retries=0 não executa handler; limite é observado antes da próxima tentativa. Revistos backoff, TemporaryError, PermanentError e idempotência. |
| `op-finalizers` | Revistos deletionTimestamp, remoção de finalizer, filhos e cascade. Cleanup externo depende do handler, não do garbage collector. |
| `op-versions` | Mensagem de None corrigida: não renomeia campos e pode causar pruning/perda. Revistos served/storage/storedVersions e webhook indisponível. |
| `op-rbac` | Peering padrão com prioridade igual pausa ambas as réplicas; prioridades distintas são opção explícita. Presença do objeto default, além de CRDs, identificada. |

Referências: [validação CRD v1.34](https://github.com/kubernetes/kubernetes/blob/v1.34.0/staging/src/k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/validation/validation.go), [defaulting e nullable](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#defaulting-and-nullable), [Kopf peering](https://docs.kopf.dev/en/stable/peering/) e [retentativas](https://docs.kopf.dev/en/stable/errors/).

## Hardening e avaliação de segurança

| ID | Resultado da revisão |
| --- | --- |
| `hd-attack-path` | Scan só bloqueia a vulnerabilidade efetivamente corrigida. Bloqueio de metadata após comprometer nó depende de proteção do host, não de NetworkPolicy de Pod. Cadeia é um cenário específico. |
| `hd-cis-audit` | Perfil kubeadm com API pública identificado como exemplo. Checklist inspirado em CIS, sem alegar execução de benchmark completo. |
| `hd-rbac-risk` | Risco potencial separado de permissões efetivas. Secrets não equivalem a tokens projetados; escalate/bind e aprovação de CSR precisam permissões adicionais; nodes/proxy não garante cluster-admin. YAML é conjunto de regras, não uma Role que magicamente concede recursos de cluster. |
| `hd-token` | Projeção explícita desliga automount, evitando segundo token de API no exemplo Vault; volume e mount refletem opção escolhida. TTL não promete extensão de um ano para qualquer token; legado não herda audiência Vault. |
| `hd-pss` | Revistos campos Linux representados em Baseline/Restricted. Subconjunto e dependência de versão explicitados. |
| `hd-netpol-matrix` | Policies allow também isolam; 0.0.0.0/0 inclui destinos IPv4 representados; except não vira deny global. DNS e direção de ingresso/saída revistos. |
| `hd-secrets` | Cenário cifrado assume Secrets regravados; configuração não cifra dados antigos automaticamente. Revistos RBAC, env, logs, Git e backups. |
| `hd-admission` | Revistos Enforce/Audit e condições das políticas. Assinatura/CVE/registry exigem integração adicional; não são defaults do Kubernetes. |
| `hd-runtime` | Rootfs somente leitura não impede minerador em memória/volume. Controles e detecção qualificados pelas ações, runtime e regras habilitadas. |
| `hd-audit-policy` | Regras nonResource combinam usuário/verbo; listas vazias não restringem. Request de GET não contém o Secret da resposta; RequestResponse pode expô-lo. |
| `pt-scope` | Revistos escopo, autorização, janela e operações. Política de exercício, sem inferir permissões técnicas do cluster. |
| `pt-recon` | Revistas exposições e pontuação; porta aberta não comprova bypass de autenticação. |
| `pt-anon` | view exclui Secrets; edit permite leitura/escrita correspondente; anonymous-auth=false responde 401. Descoberta anônima deixou de ser ativada inicialmente. |
| `pt-enum` | Revisto alcance dos verbos; ClusterRoleBindings não representam todo o mapa de bindings namespaced. |
| `pt-privesc` | Token mínimo/exec não ganham create Pods. PSS restricted não impede selecionar SA do namespace. Nó/IAM não equivalem automaticamente a cluster-admin; SA privilegiada é hipótese explícita. |
| `pt-workload` | Root no container/token comum não significam nó; nó não significa cluster-admin. Alcance apresentado como potencial, conforme capacidades e credenciais. |
| `pt-lateral` | Default-deny bloqueia inclusive API/mesmo namespace; kube-system não tem bypass automático. Exceções do preset e ausência de hostNetwork explicitadas. |
| `pt-loot` | Revistas fontes expostas; IMDSv2/hop limit não resolve host comprometido nem reduz IAM por si só. |
| `pt-tools` | Revistas missões; impersonação --as exige autorização correspondente. |
| `pt-report` | Revistas ordenação e classificação. Matriz de risco é convenção didática, não resultado nativo do Kubernetes. |

Referências: [RBAC e papéis padrão](https://kubernetes.io/docs/reference/access-authn-authz/rbac/), [Node authorization](https://kubernetes.io/docs/reference/access-authn-authz/node/), [tokens de ServiceAccount](https://kubernetes.io/docs/reference/access-authn-authz/service-accounts-admin/), [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/) e [auditoria](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/).

## Validação reproduzível

```sh
pnpm --filter @jack-academy/web test
pnpm --filter @jack-academy/web build
```

Regressões novas: `kubernetes-fidelity.test.ts` e `helm-fidelity.test.ts`. Casos antigos que codificavam comportamentos incorretos foram corrigidos junto da lógica. A revisão visual abre os 65 IDs em desktop e celular; não é um teste de conformidade Kubernetes e não substitui testes de integração de um cluster real.

Resultado em 29/09/2026: **334 testes passando em 21 arquivos**, incluindo **75 novos casos de regressão**, e build de produção concluído. Os 65 laboratórios renderizaram em 1440px e 375px, sem exceções JavaScript. Fluxos de CronJob (Forbid e avanço do relógio), proteção de PVC e Pods Pending no terminal foram exercitados no navegador. A versão corrigida do CronJob também foi conferida em `https://kubenautas.sysko.io/simuladores/cronjob`.
