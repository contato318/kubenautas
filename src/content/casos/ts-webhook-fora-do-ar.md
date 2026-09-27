# Ninguém consegue fazer deploy: "failed calling webhook"

## Contexto

Sexta à tarde, todos os pipelines de deploy começaram a falhar ao mesmo tempo, em todos os namespaces. Nada mudou nas aplicações. Pior: o HPA de vários serviços não consegue criar Pods novos, e o tráfego está crescendo.

## Sintomas

```text
$ kubectl apply -f deployment.yaml
Error from server (InternalError): error when applying patch: Internal error occurred: failed calling webhook
"validate.kyverno.svc-fail": failed to call webhook: Post "https://kyverno-svc.kyverno.svc:443/validate/fail?timeout=10s":
context deadline exceeded

$ kubectl describe rs -n loja api-6d8f7c9b5
  Warning  FailedCreate  replicaset-controller  Error creating: Internal error occurred: failed calling webhook "validate.kyverno.svc-fail" …
```

<!-- solucao -->

## Investigação

```text
$ kubectl get pods -n kyverno
NAME                                READY   STATUS             RESTARTS
kyverno-admission-controller-…      0/1     CrashLoopBackOff   14

$ kubectl logs -n kyverno kyverno-admission-controller-… --previous | tail -1
… OOMKilled …

$ kubectl get validatingwebhookconfiguration kyverno-resource-validating-webhook-cfg -o yaml | grep failurePolicy
  failurePolicy: Fail
```

O controlador de admission do Kyverno roda com **uma réplica** e limit de memória baixo; com o crescimento do número de políticas e recursos, passou a ser OOMKilled.

## Causa raiz

O webhook está configurado com `failurePolicy: Fail`: se o API server não consegue consultá-lo, **rejeita** a requisição. Com o serviço do webhook fora do ar, toda criação ou alteração interceptada falha — deploys, HPA e até Pods que o próprio Kyverno precisaria para se recuperar, se o namespace dele não estiver excluído.

## Correção

1. Recuperar o webhook: aumentar o limit de memória e as réplicas do admission controller (o namespace `kyverno` é excluído dos webhooks, então os Pods dele podem ser criados).
2. Se o próprio webhook bloqueasse a recuperação, remover temporariamente a configuração do webhook (`kubectl delete validatingwebhookconfiguration …`) — o operador recria quando voltar.

## Prevenção

- Webhooks críticos com **réplicas ≥ 2**, **PDB** e recursos adequados.
- `namespaceSelector` excluindo `kube-system` e o namespace do próprio webhook.
- `failurePolicy: Ignore` para políticas de auditoria/boas práticas; `Fail` só onde a segurança exige.
- Alerta em `apiserver_admission_webhook_rejection_count` e na saúde dos Pods do webhook.

Reproduza no simulador de control plane com o webhook fora do ar em Fail e em Ignore.
