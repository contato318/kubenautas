# "invalid ownership metadata" ao migrar para Helm

## Contexto

A `loja` era implantada com `kubectl apply -f k8s/`. O time criou um chart e tentou o primeiro `helm install` no mesmo namespace, esperando que o Helm "assumisse" os recursos existentes.

## Sintomas

```text
$ helm install loja ./chart -n loja
Error: INSTALLATION FAILED: Unable to continue with install: Service "loja-api" in namespace "loja"
exists and cannot be imported into the current release: invalid ownership metadata;
label validation error: missing key "app.kubernetes.io/managed-by": must be set to "Helm";
annotation validation error: missing key "meta.helm.sh/release-name": must be set to "loja";
annotation validation error: missing key "meta.helm.sh/release-namespace": must be set to "loja"
```

<!-- solucao -->

## Investigação

```text
$ kubectl get svc loja-api -n loja -o jsonpath='{.metadata.labels}{"\n"}{.metadata.annotations}'
{"app":"loja-api"}
{"kubectl.kubernetes.io/last-applied-configuration":"…"}
```

## Causa raiz

O Helm só gerencia recursos que **pertencem** a uma release, identificados pelo label `app.kubernetes.io/managed-by: Helm` e pelas annotations `meta.helm.sh/release-name` e `meta.helm.sh/release-namespace`. Encontrando um recurso com o mesmo nome sem essa "etiqueta de dono", ele se recusa a sobrescrevê-lo — pode ser de outra release ou de outra ferramenta.

## Correção

**Adotar** os recursos existentes (sem recriá-los, sem downtime), marcando-os como da release:

```bash
for r in service/loja-api deployment/loja-api configmap/loja-config; do
  kubectl -n loja label "$r" app.kubernetes.io/managed-by=Helm --overwrite
  kubectl -n loja annotate "$r" meta.helm.sh/release-name=loja meta.helm.sh/release-namespace=loja --overwrite
done
helm install loja ./chart -n loja
```

Atenção: se o chart gerar um `spec.selector` diferente do Deployment existente, o install falha por campo imutável — alinhe os labels do selector ao que já existe.

## Prevenção

- Planeje a migração recurso a recurso (nomes e selectors iguais aos atuais).
- Nunca aplique manualmente (`kubectl apply`) recursos que um chart gerencia.
- Em ambientes compartilhados, use nomes com prefixo da release para evitar colisões entre charts.
