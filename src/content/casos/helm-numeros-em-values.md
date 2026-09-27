# A imagem 2.0240501e+07 não existe

## Contexto

O time adotou tags de imagem baseadas em data (`20240501`) e uma aplicação legada com versão `1.10`. O pipeline escreve a tag no `values-prod.yaml` e roda o `helm upgrade`. Os Pods novos não sobem.

## Sintomas

```yaml
# values-prod.yaml gerado pelo pipeline
image:
  repository: registry.exemplo.com/loja/api
  tag: 20240501
legado:
  versao: 1.10
```

```text
$ kubectl describe pod loja-api-7d9f… -n loja
  Failed to pull image "registry.exemplo.com/loja/api:2.0240501e+07": not found

$ kubectl get cm loja-legado -o jsonpath='{.data.VERSAO}'
1.1
```

<!-- solucao -->

## Investigação

```text
$ helm template loja ./chart -f values-prod.yaml | grep image:
          image: "registry.exemplo.com/loja/api:2.0240501e+07"
```

## Causa raiz

O Helm converte os arquivos de values de **YAML para JSON** internamente, e todo número vira **`float64`**. Na hora de imprimir no template, o Go formata floats grandes em **notação científica** (`2.0240501e+07`) e remove zeros à direita (`1.10` → `1.1`). O YAML estava "correto" — o tipo é que estava errado.

## Correção

Coloque aspas em tudo que é identificador:

```yaml
image:
  tag: "20240501"
legado:
  versao: "1.10"
```

E no pipeline, use `--set-string image.tag=$TAG` em vez de escrever o número cru. No template, `{{ .Values.image.tag | toString }}` **não** resolve (o valor já é float); o que resolve é o tipo correto na origem.

## Prevenção

- `values.schema.json` com `"tag": {"type": "string"}`: o lint e o install passam a rejeitar números.
- Convenção de quoting para tags, versões, CEPs e códigos.
- `helm template | kubeconform` e um teste que confere a imagem renderizada.

Veja os tipos no simulador de values ("Números e tipos") e no simulador de templates ("Números: float64 e printf").
