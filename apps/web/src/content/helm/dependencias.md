# Dependências e subcharts

Um chart pode depender de outros: um banco, um cache, ou um chart interno reutilizado. As dependências ficam declaradas no `Chart.yaml` e são empacotadas em `charts/`.

## Declarando

```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "~16.0.0"
    repository: oci://registry-1.docker.io/bitnamicharts
    condition: postgresql.enabled
  - name: redis
    version: "^20.0.0"
    repository: https://charts.bitnami.com/bitnami
    tags: [cache]
  - name: app                     # mesmo chart, duas vezes
    alias: api
    version: 0.3.0
    repository: file://../app
  - name: app
    alias: worker
    version: 0.3.0
    repository: file://../app
    condition: worker.enabled
```

| Campo | Para quê |
| --- | --- |
| `version` | Restrição SemVer (`~16.0.0`, `^20.0.0`, `16.x`) |
| `repository` | URL de repositório, `oci://…` ou `file://` (caminho local) |
| `condition` | Caminho(s) nos values que ligam/desligam a dependência |
| `tags` | Grupos de dependências ligados/desligados juntos |
| `alias` | Instala o mesmo chart mais de uma vez, com nomes e values diferentes |
| `import-values` | Traz values do subchart para o pai |

## Baixando: update × build

```bash
helm dependency update ./loja   # resolve as restrições, baixa, grava Chart.lock
helm dependency build ./loja    # baixa exatamente o que está no Chart.lock
helm dependency list ./loja     # status de cada dependência
```

- `update` pode trazer versões novas (dentro da restrição) — rode ao atualizar dependências conscientemente.
- `build` é **reprodutível** — use no CI.
- **Versione o `Chart.lock`.** O diretório `charts/` normalmente não vai para o Git (o CI roda `build`).
- Sem os pacotes em `charts/`, `helm install` falha: *found in Chart.yaml, but missing in charts/ directory*.

## Ligando e desligando

- `condition`: caminhos separados por vírgula; o **primeiro que existir** nos values decide.
- `tags`: a dependência é habilitada se **alguma** das suas tags for `true`.
- **condition tem prioridade sobre tags.**
- Sem condition e sem tags, a dependência é sempre renderizada.

```yaml
# values.yaml do pai
postgresql:
  enabled: false        # usa um banco gerenciado (RDS, Cloud SQL…)
tags:
  cache: true
```

## Values de subcharts: escopo

O subchart **não enxerga** os values do pai. Ele recebe:

1. Os seus próprios padrões (`values.yaml` do subchart);
2. **mesclados** com a seção do pai que tem o nome (ou alias) dele;
3. mais o bloco `global`.

```yaml
# values.yaml do pai
global:
  imageRegistry: registry.exemplo.com   # visível em todos: .Values.global.imageRegistry
postgresql:
  auth:
    database: loja                       # o subchart vê .Values.auth.database
api:
  replicaCount: 3                        # o alias "api" vê .Values.replicaCount
worker:
  role: worker
```

O pai, por outro lado, enxerga tudo, inclusive `.Values.postgresql.auth.database`.

## Referenciando recursos do subchart

Nomes gerados por subcharts seguem o helper **deles**. Com release `loja` e dependência `postgresql`, o Service costuma se chamar `loja-postgresql`. No pai:

```yaml
env:
  - name: DB_HOST
    value: {{ printf "%s-postgresql" .Release.Name | quote }}
```

Documente isso — trocar `fullnameOverride` do subchart muda o endereço.

## Library charts

Um chart `type: library` como dependência fornece `define`s para o pai, sem gerar recursos. É o padrão para dezenas de microsserviços terem os mesmos labels, probes e securityContext, mantidos em um só lugar.

## Umbrella charts

Um chart "guarda-chuva" que só agrega dependências (frontend, api, worker, banco) instala um sistema inteiro com um comando. Vantagem: versão única do conjunto. Desvantagem: um upgrade mexe em tudo, e o histórico fica agregado. Em times grandes, prefira releases separadas coordenadas por GitOps (Argo CD, Flux) ou helmfile.

No simulador, altere os values do pai e veja quais subcharts são renderizados e **exatamente** que `.Values` cada um recebe.
