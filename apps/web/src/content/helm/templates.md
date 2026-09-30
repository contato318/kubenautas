# Templates: Go templates + Sprig

Os templates do Helm usam a linguagem de templates do Go (`text/template`) com as funções da biblioteca **Sprig** e algumas do próprio Helm. Tudo entre `{{ }}` é uma **ação**; o resto é texto copiado para a saída.

## Objetos disponíveis

| Objeto | Exemplos |
| --- | --- |
| `.Values` | `.Values.image.repository` |
| `.Release` | `.Release.Name`, `.Release.Namespace`, `.Release.IsInstall`, `.Release.IsUpgrade`, `.Release.Revision` |
| `.Chart` | `.Chart.Name`, `.Chart.Version`, `.Chart.AppVersion` |
| `.Capabilities` | `.Capabilities.KubeVersion.Version`, `.Capabilities.APIVersions.Has "monitoring.coreos.com/v1"` |
| `.Template` | `.Template.Name`, `.Template.BasePath` |
| `.Files` | `.Files.Get "config/app.conf"`, `.Files.Glob "dashboards/*.json"` |

O **ponto** (`.`) é o contexto atual. No início do template ele é o objeto raiz; dentro de `with` e `range` ele muda.

## Pipelines e funções

```yaml
image: {{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
name: {{ .Values.name | lower | trunc 63 | trimSuffix "-" | quote }}
```

O valor à esquerda do `|` vira o **último argumento** da função à direita. Funções mais usadas:

| Função | Uso |
| --- | --- |
| `default "x" .Values.y` | Valor padrão quando vazio (nil, "", 0, false, lista/mapa vazio) |
| `required "msg" .Values.y` | Falha o render se estiver vazio |
| `quote` / `squote` | Aspas duplas / simples |
| `toYaml` | Serializa um mapa/lista como YAML |
| `indent N` / `nindent N` | Indenta (nindent adiciona uma quebra de linha antes) |
| `include "nome" .` | Renderiza um template nomeado e **retorna string** (dá para usar em pipeline) |
| `tpl .Values.x .` | Renderiza uma string dos values como template |
| `printf "%s-%s" a b` | Formatação |
| `trunc`, `trimSuffix`, `replace`, `upper`, `lower`, `contains` | Strings |
| `eq`, `ne`, `lt`, `gt`, `and`, `or`, `not`, `empty` | Lógica |
| `b64enc`, `sha256sum`, `toJson` | Codificação |
| `lookup "v1" "Secret" "ns" "nome"` | Lê um objeto do cluster (vazio em `helm template`) |

## Controle de fluxo

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}

{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}

env:
{{- range $name, $value := .Values.env }}
  - name: {{ $name }}
    value: {{ $value | quote }}
{{- end }}
```

- `if` / `else if` / `else` usam "verdade" no estilo Go: `false`, `0`, `nil`, `""` e coleções vazias são falsos.
- `with X` executa o bloco só se X não for vazio **e muda o ponto para X**.
- `range` itera listas (`$i, $v`) e mapas (`$chave, $valor`, em ordem alfabética de chave).

### Escopo e o `$`

Dentro de `with .Values.image`, o ponto é o mapa da imagem — `.Release.Name` **não existe ali** e gera erro. Use `$` para voltar à raiz:

```yaml
{{- with .Values.image }}
image: {{ .repository }}:{{ .tag }}
release: {{ $.Release.Name }}
{{- end }}
```

Variáveis: `{{ $nome := .Values.nome }}` declara; `{{ $nome = "outro" }}` reatribui.

## Espaços em branco: `{{-` e `-}}`

O hífen remove **todos** os espaços e quebras de linha daquele lado da ação. Sem ele, cada `{{ if }}`/`{{ end }}` deixa uma linha em branco — o que às vezes quebra a indentação do YAML.

```yaml
# Padrão seguro para blocos
resources:
  {{- toYaml .Values.resources | nindent 2 }}
```

Regra de ouro: **`nindent` numa linha própria**, com `{{-` para comer a quebra anterior. `indent` na mesma linha da chave (`resources: {{ toYaml . | indent 4 }}`) gera YAML inválido.

## Erros que você vai encontrar

| Mensagem | Causa |
| --- | --- |
| `nil pointer evaluating interface {}.tag` | Acessou `.Values.image.tag` e `.Values.image` não existe. Use `default dict`, `with` ou garanta o padrão no values.yaml |
| `can't evaluate field Name in type interface {}` | Usou `.Release` dentro de `with`/`range` — faltou `$` |
| `execution error at (...): X é obrigatório` | Um `required` sem valor |
| `error converting YAML to JSON: yaml: line N` | O template gerou YAML inválido (quase sempre indentação) |
| `%!d(float64=8080)` na saída | `printf "%d"` com número de values (float64) — use `int` |

## Depurando

```bash
helm template loja ./loja -f values-prod.yaml             # renderiza tudo localmente
helm template loja ./loja -s templates/deployment.yaml     # um arquivo só
helm template loja ./loja --debug                          # mostra o YAML mesmo se inválido
helm install loja ./loja --dry-run=server                  # renderiza e valida no API server, sem aplicar
```

O simulador abaixo é um motor de templates de verdade (um subconjunto do Go template + Sprig): edite o template e os values e veja a saída — ou o erro, com a mesma mensagem que o Helm mostraria.
