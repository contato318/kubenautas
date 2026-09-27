# Upgrade do cluster travado no drain

## Contexto

A equipe de plataforma inicia o upgrade da versão do Kubernetes. O processo drena um nó por vez. O primeiro nó drena em 2 minutos; o segundo está há **40 minutos** no mesmo ponto e a janela de manutenção está acabando.

## Sintomas

```text
$ kubectl drain worker-2 --ignore-daemonsets --delete-emptydir-data
node/worker-2 cordoned
evicting pod financeiro/conciliador-6b8c9d7f5-x4k2m
error when evicting pods/"conciliador-6b8c9d7f5-x4k2m" -n "financeiro" (will retry after 5s):
Cannot evict pod as it would violate the pod's disruption budget.
evicting pod financeiro/conciliador-6b8c9d7f5-x4k2m
error when evicting pods/"conciliador-6b8c9d7f5-x4k2m" -n "financeiro" (will retry after 5s):
Cannot evict pod as it would violate the pod's disruption budget.
...
```

<!-- solucao -->

## Investigação

```text
$ kubectl get pdb -A
NAMESPACE    NAME          MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
financeiro   conciliador   1               N/A               0                     90d
loja         web           2               N/A               1                     200d

$ kubectl get deploy conciliador -n financeiro
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
conciliador   1/1     1            1           90d
```

O PDB exige **pelo menos 1** Pod disponível, e o Deployment tem **apenas 1** réplica. Remover esse Pod deixaria 0 disponíveis: a eviction nunca será permitida. `ALLOWED DISRUPTIONS 0` é o sinal.

## Causa raiz

**PDB incompatível com o número de réplicas.** `minAvailable` igual ao total de réplicas (ou `maxUnavailable: 0`) bloqueia qualquer interrupção voluntária — drain, upgrades, Cluster Autoscaler. O drain respeita o PDB e tenta de novo para sempre.

## Correção

Na hora, com o dono do serviço de acordo:

```bash
# Suba uma segunda réplica; quando ela ficar Ready, a eviction passa
kubectl scale deploy conciliador -n financeiro --replicas=2
```

Em definitivo:

- Serviços que precisam de disponibilidade: **2+ réplicas** espalhadas (topologySpreadConstraints ou anti-afinidade) e PDB com `maxUnavailable: 1`.
- Singletons que aceitam alguns segundos de indisponibilidade: sem PDB bloqueante, ou manutenção coordenada com o time.

## Prevenção

- Antes de qualquer upgrade: `kubectl get pdb -A` e investigue todos com **ALLOWED DISRUPTIONS = 0**.
- Política de admission que rejeita PDBs que bloqueiam totalmente o workload.
- Automatize upgrades com timeout de drain e alerta, em vez de `--disable-eviction` (que ignora o PDB e derruba o serviço).

Reproduza no simulador de Drain e PDB: 3 réplicas com minAvailable 3.
