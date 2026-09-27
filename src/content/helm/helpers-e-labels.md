# Helpers, nomes e labels

Charts bem feitos repetem pouco: nomes, labels e blocos comuns ficam em **templates nomeados** no `_helpers.tpl`.

## define, include e template

```yaml
{{/* templates/_helpers.tpl */}}
{{- define "loja.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "loja.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

```yaml
metadata:
  labels:
    {{- include "loja.labels" . | nindent 4 }}
```

- `define` cria o template. Os nomes são **globais** entre o chart e seus subcharts — prefixe sempre com o nome do chart (`loja.labels`) para evitar colisões.
- `include "nome" .` renderiza e **retorna uma string**, que pode seguir em pipeline (`| nindent 4`).
- `template "nome" .` também renderiza, mas escreve direto na saída e **não pode** ser usado em pipeline. Prefira `include`.
- O segundo argumento é o **contexto**. Esquecer o `.` (`include "loja.labels"`) faz o template receber `nil`.

## O helper fullname

O `helm create` gera este helper — vale entender cada linha:

```yaml
{{- define "loja.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
```

- Nome padrão: `<release>-<chart>` → `loja-producao-pagamentos-api`.
- Se o release já contém o nome do chart, não repete (`pagamentos-api`, e não `pagamentos-api-pagamentos-api`).
- **`trunc 63`**: nomes de Services, labels e muitos outros campos são *DNS labels* e aceitam no máximo **63 caracteres**.
- **`trimSuffix "-"`**: o corte pode terminar em hífen, o que também é inválido.
- `nameOverride` troca o nome do chart; `fullnameOverride` define o nome inteiro.

## Labels recomendados e o selector

| Label | Valor |
| --- | --- |
| `app.kubernetes.io/name` | Nome da aplicação |
| `app.kubernetes.io/instance` | Nome da release — distingue instalações do mesmo chart |
| `app.kubernetes.io/version` | Versão da aplicação |
| `app.kubernetes.io/component` | `api`, `worker`, `database`… |
| `app.kubernetes.io/part-of` | Sistema maior do qual faz parte |
| `app.kubernetes.io/managed-by` | `Helm` |
| `helm.sh/chart` | `<chart>-<versão>` |

O `selector` de Deployments e StatefulSets deve usar **somente** labels estáveis (`name` e `instance`) — o `spec.selector` é **imutável**. Se você incluir `version` ou `helm.sh/chart` no selector, o próximo upgrade que mudar esse valor falha com `field is immutable`.

```yaml
{{- define "loja.selectorLabels" -}}
app.kubernetes.io/name: {{ include "loja.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

## Forçando rollout quando a configuração muda

Pods leem ConfigMaps/Secrets via `env` **só na inicialização**. Se só o ConfigMap mudar, o template do Pod continua igual e **nada reinicia**. O truque clássico: um hash da configuração como annotation do Pod.

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```

Mudou a config → mudou o hash → mudou o template do Pod → rolling update.

## Outros helpers úteis

- `tpl`: permite que usuários coloquem templates **dentro dos values** (`host: "{{ .Release.Name }}.exemplo.com"`) e o chart renderiza com `{{ tpl .Values.host . }}`.
- `lookup`: consulta o cluster durante o render — ex.: reaproveitar uma senha gerada em instalações anteriores. Em `helm template` e `--dry-run` (cliente) ele retorna vazio; escreva o template para lidar com isso.
- `fail`: aborta com mensagem quando uma combinação de values é inválida.

No simulador, calcule nomes e labels para diferentes releases e overrides e veja o checksum decidir se os Pods reiniciam.
