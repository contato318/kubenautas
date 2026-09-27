# CrashLoopBackOff logo após o deploy

## Contexto

Sexta-feira, 17h. O time de pagamentos publica a versão **2.3** do `checkout-api` em produção. Em homologação tudo passou. Minutos depois, o painel de deploys mostra o rollout parado — mas, curiosamente, os clientes não reclamam.

## Sintomas

```text
$ kubectl get pods -n pagamentos -l app=checkout-api
NAME                            READY   STATUS             RESTARTS      AGE
checkout-api-7c9f8d6b5d-2kq8w   0/1     CrashLoopBackOff   5 (40s ago)   4m
checkout-api-6f4b7c8d9e-h7x2p   1/1     Running            0             3d
checkout-api-6f4b7c8d9e-m4n9t   1/1     Running            0             3d
checkout-api-6f4b7c8d9e-q8r1z   1/1     Running            0             3d

$ kubectl describe pod checkout-api-7c9f8d6b5d-2kq8w -n pagamentos
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
Events:
  Warning  BackOff  kubelet  Back-off restarting failed container checkout-api
```

O container novo sobe e morre em menos de um segundo, com **exit code 1** (não é 137, então não é falta de memória).

<!-- solucao -->

## Investigação

O `describe` diz *que* o container morre, mas não *por quê*. Como o container já reiniciou, os logs atuais podem estar vazios — o que interessa é a execução **anterior**:

```text
$ kubectl logs checkout-api-7c9f8d6b5d-2kq8w -n pagamentos --previous
2026-09-25T20:01:12Z FATAL config: variável obrigatória PAYMENT_GATEWAY_URL não definida
```

A versão 2.3 passou a exigir `PAYMENT_GATEWAY_URL`. Comparando os overlays do Kustomize:

```text
$ kustomize build overlays/staging | grep PAYMENT_GATEWAY_URL
  PAYMENT_GATEWAY_URL: https://sandbox.gateway.exemplo.com
$ kustomize build overlays/prod | grep PAYMENT_GATEWAY_URL
(nada)
```

## Causa raiz

A nova chave foi adicionada **somente** ao ConfigMap de homologação. Em produção, a aplicação valida a configuração no boot e encerra com erro — comportamento correto, que evitou rodar com configuração incompleta.

**Por que não houve indisponibilidade?** O Deployment usa `maxUnavailable: 0`: o Pod novo nunca ficou Ready, então o rollout travou e as 3 réplicas antigas continuaram servindo.

## Correção

```bash
# 1. Estanque o problema: volte para a versão anterior
kubectl rollout undo deployment/checkout-api -n pagamentos

# 2. Adicione a chave no overlay de produção, aplique e refaça o deploy
kubectl apply -k overlays/prod
kubectl rollout status deployment/checkout-api -n pagamentos
```

Lembre-se: variáveis de ambiente são lidas **apenas na criação do container**. Mudar o ConfigMap não corrige Pods já criados; o novo rollout (ou `rollout restart`) é necessário.

## Prevenção

- Mudanças de configuração no **mesmo PR** da mudança de código, para todos os ambientes.
- No CI, renderize todos os overlays (`kustomize build`) e valide as chaves obrigatórias.
- Mantenha `maxUnavailable: 0` + readiness probe: foi isso que transformou um incidente em um não-evento.
- Considere `progressDeadlineSeconds` + alerta de rollout travado, e rollback automático no seu CD.
