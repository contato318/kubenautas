# Mudei a configuração pelo Helm e nada mudou

## Contexto

Para desligar uma funcionalidade com problema, o time mudou `FEATURE_RECOMENDACOES: "false"` no `values-prod.yaml` e fez o deploy. O `helm upgrade` terminou com sucesso, o ConfigMap está correto no cluster — mas a funcionalidade continua ligada.

## Sintomas

```text
$ helm upgrade loja ./chart -n loja -f values-prod.yaml
Release "loja" has been upgraded. Happy Helming!
REVISION: 58

$ kubectl get cm loja-config -n loja -o jsonpath='{.data.FEATURE_RECOMENDACOES}'
false

$ kubectl exec deploy/loja-api -n loja -- printenv FEATURE_RECOMENDACOES
true

$ kubectl get pods -n loja -l app.kubernetes.io/name=loja
NAME                        READY   STATUS    RESTARTS   AGE
loja-api-6b8f7d9c5-2xk4p    1/1     Running   0          6d
```

<!-- solucao -->

## Investigação

Os Pods têm 6 dias: o upgrade não criou Pods novos. O Deployment consome o ConfigMap via `envFrom`, e o diff do upgrade só alterou o ConfigMap — o template do Pod ficou idêntico.

## Causa raiz

Variáveis de ambiente são lidas **apenas na criação do container**. O Deployment só faz rollout quando o **template do Pod** muda; mudar o ConfigMap não muda o template. O Helm fez exatamente o que o chart pediu.

## Correção

Adicionar ao chart o checksum da configuração como annotation do Pod:

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
```

Para destravar agora: `kubectl rollout restart deployment/loja-api -n loja`.

## Prevenção

- Checksum em todo workload que consome ConfigMaps/Secrets do próprio chart.
- Alternativa: ferramentas como o Reloader (reinicia workloads quando ConfigMaps/Secrets mudam) — útil para configurações externas ao chart.
- Teste de deploy que verifica a configuração **efetiva** no Pod, não só no ConfigMap.

Veja o checksum decidir o rollout no simulador de helpers.
