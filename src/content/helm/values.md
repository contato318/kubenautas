# Values: configuração e precedência

Os values são a **interface pública** do seu chart. Entender como eles se combinam evita metade dos incidentes com Helm.

## De onde vêm os values

Do menor para o maior precedência:

1. `values.yaml` do chart (padrões).
2. Values do chart **pai**, na seção com o nome do subchart (quando é uma dependência).
3. Arquivos `-f`/`--values`, **na ordem** em que aparecem — o último vence.
4. `--set-json`, `--set`, `--set-string`, `--set-file` e `--set-literal`.

```bash
helm upgrade --install loja ./loja \
  -f values.yaml \
  -f values-prod.yaml \
  -f values-prod-sudeste.yaml \
  --set image.tag=2.3.1
```

## Como o merge funciona

| Tipo | Comportamento |
| --- | --- |
| Mapas (objetos) | **Mesclados** chave a chave, recursivamente |
| Listas | **Substituídas inteiras** — nunca concatenadas |
| Escalares | Substituídos |
| `null` | **Remove** a chave herdada |

O caso das listas é o mais traiçoeiro. Com este padrão:

```yaml
# values.yaml
env:
  - name: LOG_LEVEL
    value: info
  - name: DB_HOST
    value: postgres
```

e este override:

```yaml
# values-prod.yaml
env:
  - name: LOG_LEVEL
    value: warn
```

o resultado tem **só** `LOG_LEVEL`. O `DB_HOST` sumiu. Soluções: modelar como **mapa** (`env: {LOG_LEVEL: warn}`) e converter para lista no template com `range`, ou separar listas "base" e "extra" (`extraEnv`) que o template concatena.

Para remover algo que vem do padrão:

```yaml
podAnnotations:
  sidecar.istio.io/inject: null   # remove a annotation padrão do chart
```

## --set em detalhe

```bash
--set replicaCount=3                          # número
--set image.tag=v2.3.1                        # caminho com pontos
--set ingress.hosts[0].host=loja.com          # índice de lista
--set tolerations={a,b}                       # lista literal
--set nodeSelector."kubernetes\.io/os"=linux  # ponto escapado na chave
--set-string image.tag=0123                   # força string
--set-file config=./app.conf                  # conteúdo de arquivo
--set-json 'resources={"limits":{"cpu":"1"}}' # JSON
```

Regras de tipo do `--set`: `true`/`false` viram booleanos, `null` vira nulo, inteiros viram `int64` e o resto vira string. Use `--set-string` para tags, versões e códigos numéricos.

## A armadilha dos números em arquivos YAML

O Helm converte YAML para JSON internamente: **todo número de um arquivo de values vira `float64`**. Consequências:

| No values.yaml | No template `{{ .Values.x }}` |
| --- | --- |
| `tag: 1.10` | `1.1` (o zero sumiu!) |
| `tag: 20240501` | `2.0240501e+07` |
| `port: 8080` | `8080` (inteiros pequenos aparecem normais) |
| `tag: "20240501"` | `20240501` |

Regra prática: **coloque aspas** em tudo que é identificador — tags, versões, CEPs, códigos. Números de verdade (réplicas, portas) podem ficar sem aspas.

## Reaproveitando values em upgrades

| Flag | O que faz no `upgrade` |
| --- | --- |
| (nenhuma) | Usa os padrões do chart **novo** + o que você passar agora |
| `--reuse-values` | Reusa os values da revisão anterior e aplica os novos por cima (ignora padrões novos do chart — perigoso ao trocar de versão) |
| `--reset-values` | Descarta os anteriores e usa só os padrões do chart + os passados agora |
| `--reset-then-reuse-values` | Padrões do chart novo + values anteriores + os novos |

Em pipelines, o mais previsível é **sempre passar todos os arquivos** de values explicitamente e não depender de `--reuse-values`.

## Globals

Values em `global:` são visíveis para o chart pai **e para todos os subcharts** como `.Values.global` — útil para registry de imagens, domínio e labels comuns.

## Organização recomendada

```
deploy/
├── values.yaml              # comum a todos os ambientes
├── values-staging.yaml
├── values-prod.yaml
└── secrets-prod.yaml        # criptografado (SOPS) ou gerado por External Secrets
```

No simulador, combine camadas e veja a origem e o **tipo Go** de cada chave no resultado final.
