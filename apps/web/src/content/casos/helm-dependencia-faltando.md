# O pipeline passou a falhar depois de adicionar o Redis

## Contexto

Um desenvolvedor adicionou o Redis como dependência do chart `loja`, testou localmente com sucesso e abriu o PR. No CI, o deploy falha. Na máquina dele, funciona.

## Sintomas

```text
$ helm upgrade --install loja ./chart -n loja-hml -f values-hml.yaml
Error: An error occurred while checking for chart dependencies. You may need to run
`helm dependency build` to fetch missing dependencies: found in Chart.yaml, but missing in charts/ directory: redis
```

```text
$ git status --short chart/
 M chart/Chart.yaml
?? chart/charts/redis-20.1.3.tgz        # no .gitignore
```

<!-- solucao -->

## Investigação

Localmente, `helm dependency update` baixou `redis-20.1.3.tgz` para `charts/`. Esse diretório está no `.gitignore` (corretamente), e o **`Chart.lock` não foi commitado**. O CI clona o repositório sem o pacote, e o pipeline não roda nenhum comando de dependência.

## Causa raiz

Dependências precisam estar em `charts/` no momento do install. O CI não as baixa, e sem o `Chart.lock` também não haveria como reproduzir a mesma versão.

## Correção

1. Commitar o **`Chart.lock`** gerado pelo `helm dependency update`.
2. No pipeline, antes do lint/deploy:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami   # (dispensável para dependências oci://)
helm dependency build ./chart                               # baixa exatamente o que está no lock
helm lint ./chart -f values-hml.yaml
helm upgrade --install loja ./chart -n loja-hml -f values-hml.yaml --atomic
```

## Prevenção

- `Chart.lock` sempre versionado; `charts/*.tgz` fora do Git.
- No CI: `helm dependency build` (reprodutível), nunca `update` (que pode trazer versões novas).
- Um passo de CI que falha se `Chart.yaml` mudou e o `Chart.lock` não (ou se estiverem inconsistentes).
- Prefira dependências OCI: dispensam `helm repo add`.

Veja o erro e o escopo de values de cada subchart no simulador de dependências.
