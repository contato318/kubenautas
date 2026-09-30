# A API parou de achar o banco depois de "só mudar o log"

## Contexto

Para investigar um problema em produção, um desenvolvedor alterou o `values-prod.yaml` para aumentar o nível de log. O deploy passou no lint e no CI. Minutos depois, a API começou a falhar no startup.

## Sintomas

```yaml
# values.yaml do chart (padrão)
env:
  - name: LOG_LEVEL
    value: info
  - name: DB_HOST
    value: loja-postgresql
  - name: DB_NAME
    value: loja

# values-prod.yaml — a única mudança do PR
env:
  - name: LOG_LEVEL
    value: debug
```

```text
$ kubectl logs deploy/loja-api -n loja
FATAL: variável DB_HOST não definida
```

<!-- solucao -->

## Investigação

```text
$ helm get values loja -n loja --all | yq '.env'
- name: LOG_LEVEL
  value: debug
```

Só sobrou uma variável.

## Causa raiz

No merge de values do Helm, **mapas são mesclados, mas listas são substituídas inteiras**. O `env` de produção (1 item) substituiu o `env` padrão (3 itens) — `DB_HOST` e `DB_NAME` desapareceram.

## Correção

Imediata: repetir a lista completa no `values-prod.yaml` (ou fazer rollback). Definitiva: modelar variáveis como **mapa** e converter no template:

```yaml
# values.yaml
env:
  LOG_LEVEL: info
  DB_HOST: loja-postgresql
  DB_NAME: loja
```

```yaml
# templates/deployment.yaml
env:
  {{- range $name, $value := .Values.env }}
  - name: {{ $name }}
    value: {{ $value | quote }}
  {{- end }}
```

Agora `env: {LOG_LEVEL: debug}` em produção mescla com o padrão. Para listas inevitáveis, ofereça um campo separado (`extraEnv`) que o template concatena à lista base.

## Prevenção

- Evite listas em values que os ambientes precisam sobrescrever parcialmente.
- No CI, gere `helm template` com os values de cada ambiente e compare (helm-diff / diff no PR).
- `values.schema.json` com `required` para variáveis essenciais.

Veja o comportamento no simulador de values, cenário "Listas são substituídas".
