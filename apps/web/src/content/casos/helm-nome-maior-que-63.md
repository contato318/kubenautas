# Ambiente efêmero falha por causa do nome da branch

## Contexto

Cada Pull Request ganha um ambiente efêmero: o pipeline instala o chart com o nome da branch como release. Funcionou por meses — até a branch `feature/integracao-gateway-pagamentos-parceiro-novo`.

## Sintomas

```text
$ helm upgrade --install pr-feature-integracao-gateway-pagamentos-parceiro-novo ./chart -n previews
Error: INSTALLATION FAILED: 1 error occurred:
	* Service "pr-feature-integracao-gateway-pagamentos-parceiro-novo-checkout-api" is invalid:
	  metadata.name: Invalid value: "pr-feature-integracao-gateway-pagamentos-parceiro-novo-checkout-api":
	  must be no more than 63 characters
```

O chart foi escrito à mão e o helper de nome é:

```yaml
{{- define "checkout.fullname" -}}
{{ printf "%s-%s" .Release.Name .Chart.Name }}
{{- end }}
```

<!-- solucao -->

## Investigação

`pr-feature-integracao-gateway-pagamentos-parceiro-novo` (54 caracteres) + `-checkout-api` (13) = 67. Nomes de Services, e valores de labels, são **DNS labels**: no máximo 63 caracteres, só minúsculas, números e hífen, começando e terminando com alfanumérico.

Há um limite adicional para o nome da **release**: no máximo 53 caracteres, porque o Helm e os charts derivam outros nomes a partir dele.

## Causa raiz

O helper não trunca o nome. Com nomes de release curtos, nunca apareceu; com o nome da branch, estourou.

## Correção

Usar o helper padrão do `helm create`:

```yaml
{{- define "checkout.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
```

E no pipeline, gerar nomes de release curtos e determinísticos:

```bash
RELEASE="pr-${PR_NUMBER}"                     # ex.: pr-1842
# ou: slug da branch cortado + hash curto
RELEASE="pr-$(echo "$BRANCH" | tr '/_' '--' | cut -c1-30 | sed 's/-*$//')-$(echo "$BRANCH" | sha1sum | cut -c1-6)"
```

## Prevenção

- `trunc 63 | trimSuffix "-"` em todo nome gerado; atenção a sufixos adicionados depois do corte (`-headless`, `-metrics`).
- Nomes de release pequenos e sem caracteres inválidos (maiúsculas, `_`, `/`).
- Teste de template com um nome de release longo no CI.

Teste nomes gigantes no simulador de helpers, com e sem o `trunc`.
