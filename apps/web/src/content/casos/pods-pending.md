# Pods Pending com o cluster "vazio"

## Contexto

Um novo time migra 12 microsserviços para o cluster compartilhado. Metade dos Pods fica em **Pending**. O dashboard de infraestrutura mostra os nós com **35% de uso de CPU**. A primeira sugestão na reunião: "o scheduler está com defeito".

## Sintomas

```text
$ kubectl get pods -n fidelidade | grep Pending | wc -l
14

$ kubectl describe pod cupons-6b9d8c7f5-p2m4x -n fidelidade
Events:
  Warning  FailedScheduling  default-scheduler
    0/6 nodes are available: 3 Insufficient cpu,
    3 node(s) had untolerated taint {dedicated: gpu}.
    preemption: 0/6 nodes are available: 3 No preemption victims found for incoming pod,
    3 Preemption is not helpful for scheduling.
```

<!-- solucao -->

## Investigação

A mensagem tem duas partes: 3 nós são de GPU (taint `dedicated=gpu`) e corretamente recusam Pods comuns; os outros 3 estão sem CPU **alocável**. O scheduler não olha uso real, e sim **requests**:

```text
$ kubectl describe node worker-1 | grep -A6 "Allocated resources"
  Resource  Requests      Limits
  cpu       7800m (97%)   12 (150%)
  memory    9Gi (58%)     14Gi (90%)

$ kubectl top pods -n fidelidade
NAME                        CPU(cores)   MEMORY(bytes)
cupons-6b9d8c7f5-a1b2c      12m          180Mi
pontos-7c8d9e6f4-d3e4f      25m          210Mi
```

Os manifestos do time pedem `cpu: 2` por container — copiados de um template antigo — e cada serviço usa 10–30m de verdade.

## Causa raiz

**Requests superdimensionados.** Os nós estão "cheios" no papel (97% de CPU reservada) mas ociosos na prática (35% de uso). O scheduler está funcionando exatamente como deveria.

## Correção

- Ajuste os requests com base no uso medido (p95 de algumas semanas + folga), por exemplo `cpu: 100m`.
- Use o **VPA em modo recomendação** para obter valores iniciais:

```bash
kubectl get vpa cupons -n fidelidade -o jsonpath='{.status.recommendation.containerRecommendations}'
```

- Se o cluster tivesse Cluster Autoscaler, ele teria criado nós novos — resolvendo o sintoma, mas pagando por CPU que ninguém usa.

## Prevenção

- **LimitRange** no namespace com defaults sensatos e máximos por container.
- **ResourceQuota** por time, tornando o custo do request visível.
- Relatório periódico de "request × uso" (Kubecost, OpenCost ou Prometheus) por namespace.
