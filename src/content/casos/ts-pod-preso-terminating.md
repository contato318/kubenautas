# Pods que não terminam de terminar

## Contexto

Durante uma janela de manutenção, o time escalou o Deployment `relatorios` de 4 para 0 réplicas. Três Pods sumiram em segundos; um continua `Terminating` há 25 minutos, e o `kubectl drain` do nó está esperando por ele.

## Sintomas

```text
$ kubectl get pods -n relatorios
NAME                          READY   STATUS        AGE
relatorios-7c9d5f8b6-x4k2m    1/1     Terminating   3d

$ kubectl get pod relatorios-7c9d5f8b6-x4k2m -n relatorios -o jsonpath='{.spec.terminationGracePeriodSeconds}{"\n"}{.metadata.finalizers}'
3600
[]
```

<!-- solucao -->

## Investigação

Três perguntas resolvem quase todo Pod preso em Terminating:

1. **O nó está saudável?** Sim, `Ready`. (Se estivesse `Unknown`, o Pod ficaria Terminating até o nó voltar — outro caso.)
2. **Há finalizers no Pod?** Não, a lista está vazia.
3. **Qual o grace period?** **3600 segundos.** O Helm chart define `terminationGracePeriodSeconds: 3600` para "não interromper relatórios longos".

```text
$ kubectl logs relatorios-7c9d5f8b6-x4k2m -n relatorios --tail=3
Recebido SIGTERM. Aguardando relatório 8812 terminar (estimado: 40 min)…
```

## Causa raiz

O Pod está se comportando exatamente como configurado: recebeu `SIGTERM`, a aplicação decidiu terminar o trabalho em andamento, e o kubelet vai esperar até **1 hora** antes do `SIGKILL`. O `drain` respeita esse prazo.

## Correção

Se o trabalho pode ser perdido (ou refeito):

```bash
kubectl delete pod relatorios-7c9d5f8b6-x4k2m -n relatorios --grace-period=30
```

Não use `--force --grace-period=0` com o nó saudável sem necessidade: isso só apaga o objeto na API, sem garantir que o processo parou.

## Prevenção

- Trabalhos longos pertencem a **Jobs** com retentativa e checkpoints — não a Deployments com grace periods de horas.
- Grace period dimensionado para o que realmente precisa terminar (conexões, flush), tipicamente 30–120 s.
- Para Pods presos por **finalizer**, o caminho é descobrir o controller dono do finalizer; para nós perdidos, remover o nó confirmadamente morto.
