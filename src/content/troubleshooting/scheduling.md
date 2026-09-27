# Pods Pending e o scheduler

Um Pod `Pending` ainda não começou a rodar. Há duas fases diferentes aí dentro:

1. **Sem nó** (`spec.nodeName` vazio): o scheduler não encontrou onde colocá-lo.
2. **Com nó, mas containers não iniciados**: download de imagem, montagem de volume, rede — aparece como `ContainerCreating` e é outra investigação.

```bash
kubectl get pod api -n loja -o jsonpath='{.spec.nodeName}{"\n"}'
kubectl describe pod api -n loja     # seção Events
```

## Lendo a mensagem do FailedScheduling

```text
Warning  FailedScheduling  default-scheduler
0/6 nodes are available: 1 node(s) were unschedulable, 2 Insufficient memory,
3 node(s) had untolerated taint {dedicated: gpu}. preemption: 0/6 nodes are available: …
```

Cada nó é contado no **primeiro filtro em que foi reprovado** (exceto recursos, que podem citar cpu e memória juntos). A mensagem é um mapa de onde o Pod **não** cabe:

| Razão | O que significa | Ações |
| --- | --- | --- |
| `Insufficient cpu/memory` | A soma dos **requests** passaria do alocável do nó | Reduzir requests, liberar capacidade, adicionar nós |
| `untolerated taint {k: v}` | Nó com taint sem toleration no Pod | Toleration ou usar outros nós |
| `didn't match Pod's node affinity/selector` | `nodeSelector`/`nodeAffinity` sem nó compatível | Conferir labels dos nós |
| `were unschedulable` | Nó cordonado | `kubectl uncordon` quando terminar a manutenção |
| `didn't match pod anti-affinity rules` | Anti-afinidade impossível (ex.: mais réplicas que nós) | `preferred` em vez de `required`, mais nós |
| `didn't match pod topology spread constraints` | Espalhamento com `DoNotSchedule` impossível | Ajustar `maxSkew`/`whenUnsatisfiable` |
| `had volume node affinity conflict` | Volume preso a uma zona sem nó disponível | Nós na zona certa, `WaitForFirstConsumer` |
| `pod has unbound immediate PersistentVolumeClaims` | PVC ainda `Pending` | Investigar o PVC (lição de armazenamento) |
| `Too many pods` | Nó no limite de Pods (`maxPods`) | Mais nós ou limite maior |

**Lembre:** o scheduler usa **requests**, nunca o uso real. Um cluster com 20% de CPU usada pode estar 100% "cheio" em requests.

```bash
kubectl describe nodes | grep -A8 "Allocated resources"
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
kubectl get nodes -L topology.kubernetes.io/zone,node.kubernetes.io/instance-type
```

## Quando não há evento nenhum

Pod `Pending`, sem `nodeName` e **sem eventos**:

- O **kube-scheduler** está fora do ar (em clusters gerenciados, abra chamado ou veja o status do provedor).
- `spec.schedulerName` aponta para um scheduler que não existe.
- O Pod tem `schedulingGates` (recurso usado por controladores que liberam o Pod depois).

## Quotas e admission

Nem todo "não sobe" é do scheduler. Se o controller não consegue **criar** o Pod, o problema aparece no ReplicaSet/Job, não no Pod:

```bash
kubectl describe rs -n loja -l app=api
# Warning  FailedCreate  replicaset-controller  Error creating: pods "api-…" is forbidden:
#          exceeded quota: compute, requested: limits.cpu=2, used: limits.cpu=19, limited: limits.cpu=20
```

## Prioridade e preempção

Com `PriorityClass`, o scheduler pode **despejar** Pods de menor prioridade para abrir espaço. Pods que "somem" sem motivo aparente podem ter sido preemptados — procure eventos `Preempted`.

## Autoscaling de nós

Com Cluster Autoscaler/Karpenter, Pods `Pending` por recursos disparam novos nós. Se isso não acontece, procure eventos `NotTriggerScaleUp` no Pod — eles dizem por que nenhum grupo de nós serviria (ex.: o Pod não caberia nem num nó vazio, ou o grupo está no máximo).

No simulador, monte o Pod e o estado dos nós e veja a mensagem exata que o scheduler produziria.
