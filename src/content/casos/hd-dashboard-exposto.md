# O Dashboard que minerava criptomoedas

## Contexto

Um cluster de homologação ganhou o Kubernetes Dashboard "para facilitar a vida dos devs". Para não lidar com login, alguém vinculou a ServiceAccount do Dashboard a `cluster-admin` e habilitou o botão "Skip". Um LoadBalancer expôs o painel na internet. Semanas depois, a fatura da nuvem triplicou.

## Sintomas

```text
$ kubectl top nodes
NAME        CPU(cores)   CPU%
worker-1    3890m        97%
worker-2    3902m        97%

$ kubectl get pods -A | grep -v -E "kube-system|loja"
kube-public   kube-proxy-x7k2m    1/1   Running   0   9d      ← não é o kube-proxy de verdade
```

```text
$ kubectl get svc -n kubernetes-dashboard
NAME                   TYPE           EXTERNAL-IP     PORT(S)
kubernetes-dashboard   LoadBalancer   34.120.87.11    443:31902/TCP
```

<!-- solucao -->

## Investigação

```text
$ kubectl get clusterrolebinding dashboard-admin -o jsonpath='{.roleRef.name} {.subjects[*].name}'
cluster-admin kubernetes-dashboard

$ kubectl get pod kube-proxy-x7k2m -n kube-public -o jsonpath='{.spec.containers[0].image} {.spec.containers[0].args}'
docker.io/xmrig/xmrig:latest [-o pool.minexmr.com:443 …]
```

O audit log mostra a criação do Pod feita pela ServiceAccount `kubernetes-dashboard`, a partir de um IP externo, sem nenhum usuário autenticado.

## Causa raiz

Três decisões somadas: o painel **exposto na internet**, **sem autenticação** (skip login) e operando com **cluster-admin**. Qualquer visitante tinha controle total do cluster. O atacante criou um "kube-proxy" falso num namespace pouco observado para minerar.

## Correção

- Remover o Service LoadBalancer e o binding `cluster-admin`; apagar o Pod malicioso e procurar persistência (DaemonSets, CronJobs, ServiceAccounts e bindings criados no período).
- Rotacionar credenciais acessíveis pelo cluster (Secrets, tokens, credenciais de nuvem dos nós).
- Se o Dashboard for necessário: acesso só por `kubectl port-forward` ou atrás de SSO, **com o token do próprio usuário** (sem permissões próprias).

## Prevenção

- Nenhuma ferramenta administrativa exposta publicamente; política de admission que bloqueia Services `LoadBalancer` fora de namespaces aprovados.
- Alertas para bindings de `cluster-admin` e para Pods em `kube-public`/`default`.
- Admission restringindo registries (a imagem veio do Docker Hub).
- Monitoramento de custo e de CPU anômala como sinal de segurança.

Analise o binding no simulador de risco de RBAC (marque "* em *").
