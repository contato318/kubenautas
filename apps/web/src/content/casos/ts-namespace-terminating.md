# Namespace preso em Terminating há dois dias

## Contexto

Um time removeu o ambiente de testes `promo-black-friday` com `kubectl delete namespace`. Dois dias depois o namespace continua lá, e o pipeline que recria o ambiente com o mesmo nome falha.

## Sintomas

```text
$ kubectl get ns promo-black-friday
NAME                 STATUS        AGE
promo-black-friday   Terminating   47d

$ kubectl create ns promo-black-friday
Error from server (AlreadyExists): object is being deleted: namespaces "promo-black-friday" already exists
```

<!-- solucao -->

## Investigação

O status do namespace conta o que está travando:

```text
$ kubectl get ns promo-black-friday -o jsonpath='{.status.conditions}' | jq '.[] | select(.status=="True")'
{ "type": "NamespaceContentRemaining", "message": "Some resources are remaining: certificates.cert-manager.io has 2 resource instances" }
{ "type": "NamespaceFinalizersRemaining", "message": "Some content in the namespace has finalizers remaining: cert-manager.io/finalizer in 2 resource instances" }

$ kubectl get certificates -n promo-black-friday -o jsonpath='{range .items[*]}{.metadata.name} {.metadata.finalizers}{"\n"}{end}'
promo-tls   ["cert-manager.io/finalizer"]
```

O cert-manager foi desinstalado do cluster na semana anterior.

## Causa raiz

Objetos com **finalizers** só são apagados quando o controller responsável remove o finalizer, depois de fazer sua limpeza. Com o cert-manager desinstalado, **ninguém** remove o finalizer: os Certificates nunca somem, e o namespace espera por eles para sempre.

Variação comum: um `APIService` indisponível (ex.: `v1beta1.metrics.k8s.io`) impede o controller de namespaces de listar todos os recursos — condição `NamespaceDeletionDiscoveryFailure`.

## Correção

Com consciência de que a limpeza externa (ex.: registros no DNS, certificados na CA) não será feita:

```bash
kubectl patch certificate promo-tls -n promo-black-friday --type=merge -p '{"metadata":{"finalizers":null}}'
kubectl get ns promo-black-friday   # some em segundos
```

Evite o atalho de editar os finalizers do **namespace** via API `/finalize`: ele apaga o namespace mas deixa objetos órfãos no etcd.

## Prevenção

- Apague os recursos customizados **antes** de desinstalar o operador que os gerencia.
- Monitore `APIService` indisponíveis (`kubectl get apiservices | grep False`).
- Em ambientes efêmeros, remova o namespace antes de remover operadores compartilhados.
