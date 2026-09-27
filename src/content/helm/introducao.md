# Helm: o gerenciador de pacotes do Kubernetes

Uma aplicação real no Kubernetes é um punhado de objetos: Deployment, Service, ConfigMap, Secret, Ingress/HTTPRoute, HPA, PDB, ServiceAccount, RBAC… multiplicados por ambientes (dev, homologação, produção) que diferem em poucos valores. Copiar e colar YAML não escala. O **Helm** resolve três problemas de uma vez:

1. **Empacotamento**: um *chart* agrupa todos os manifestos de uma aplicação, parametrizados.
2. **Configuração**: *values* diferentes por ambiente, sem duplicar YAML.
3. **Ciclo de vida**: instalar, atualizar, voltar versão e remover a aplicação **como uma unidade** — com histórico.

## Os quatro conceitos

| Conceito | O que é | Analogia |
| --- | --- | --- |
| **Chart** | Pacote com templates, values padrão e metadados | Um pacote `.deb`/`.rpm` |
| **Values** | Parâmetros que personalizam o chart | Arquivo de configuração |
| **Release** | Uma instalação de um chart no cluster, com nome | Um programa instalado |
| **Revision** | Cada versão de uma release (install, upgrade, rollback) | Um commit no histórico |

O mesmo chart pode ser instalado várias vezes, com nomes e values diferentes: `loja-staging` e `loja-prod` são duas **releases** do chart `loja`.

## Como o Helm 3 funciona

```
 helm CLI ──(renderiza templates + values)──► manifestos YAML ──► API server
    │                                                               │
    └────────── grava/lê o estado da release em Secrets ◄───────────┘
```

- **Não há componente no cluster.** O Helm 2 tinha o *Tiller*, um servidor com permissões amplas; o Helm 3 o eliminou. O `helm` usa as suas credenciais do kubeconfig — portanto o **seu RBAC**.
- O estado de cada revisão fica em um **Secret** no namespace da release: `sh.helm.release.v1.<release>.v<N>`, com o manifesto renderizado, os values e o chart (comprimidos).
- Releases são **por namespace**: o mesmo nome pode existir em namespaces diferentes.

> O **Helm 4**, lançado no fim de 2025, mantém charts `apiVersion: v2` e os comandos que você vai aprender aqui. As novidades estão por baixo: aplicação via *server-side apply*, um novo sistema de plugins e esperas (`--wait`) mais precisas. Tudo neste módulo vale para Helm 3 e 4.

## Primeiros comandos

```bash
# Instalar a CLI (macOS) — ou baixe o binário em github.com/helm/helm/releases
brew install helm

# Adicionar um repositório e procurar charts
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx

# Ver o que um chart oferece antes de instalar
helm show chart bitnami/nginx
helm show values bitnami/nginx > values-padrao.yaml

# Instalar (release "site" no namespace "web")
helm install site bitnami/nginx -n web --create-namespace --set replicaCount=2

# Inspecionar
helm list -n web
helm status site -n web
helm get values site -n web          # values que VOCÊ passou
helm get values site -n web --all    # values efetivos (com os padrões)
helm get manifest site -n web        # YAML aplicado no cluster
```

## O ciclo de vida

```bash
helm upgrade site bitnami/nginx -n web --set replicaCount=3   # nova revisão
helm history site -n web                                      # todas as revisões
helm rollback site 1 -n web                                   # volta ao conteúdo da revisão 1 (cria a revisão 3!)
helm uninstall site -n web                                    # remove recursos e histórico
```

Cada revisão tem um **status**:

| Status | Significado |
| --- | --- |
| `deployed` | Revisão em vigor |
| `superseded` | Substituída por uma revisão mais nova |
| `failed` | A operação falhou (a anterior continua em vigor) |
| `pending-install` / `pending-upgrade` / `pending-rollback` | Operação em andamento — ou interrompida no meio |
| `uninstalled` | Removida com `--keep-history` |

### Flags que você vai usar sempre

- `helm upgrade --install`: instala se não existir, atualiza se existir — **idempotente**, ideal para pipelines.
- `--wait`: só considera sucesso quando os recursos ficarem prontos (Pods Ready, etc.).
- `--timeout 10m`: limite para o `--wait` e para hooks (padrão 5m).
- `--atomic`: se falhar, desfaz automaticamente (rollback no upgrade, uninstall no install). Implica `--wait`.
- `--history-max 10`: quantas revisões manter (o padrão do `upgrade` é 10; 0 = ilimitado).
- `--dry-run` e `helm template`: renderizam sem aplicar — veremos em detalhe mais adiante.

> **Rollback cria uma revisão nova.** Voltar para a revisão 1 a partir da 2 gera a revisão 3 com o conteúdo da 1. O histórico nunca é reescrito.

Use o simulador abaixo para ver status, histórico e os Secrets mudando a cada comando — inclusive o que acontece quando um `helm upgrade` é interrompido no meio.
