# Pods Evicted e nó com DiskPressure

## Contexto

Durante a madrugada, vários Pods de um nó foram despejados e reagendados em outros nós. O alerta de **DiskPressure** disparou em `worker-7`. Na manhã seguinte, o mesmo aconteceu em `worker-3`.

## Sintomas

```text
$ kubectl get pods -A --field-selector=status.phase=Failed
NAMESPACE   NAME                        READY   STATUS    AGE
catalogo    busca-5c7d8f9b6-2xk4p       0/1     Evicted   7h
catalogo    busca-5c7d8f9b6-8qz1m       0/1     Evicted   7h
vendas      carrinho-6d8e9f1a2-t5w3r    0/1     Evicted   7h

$ kubectl describe pod busca-5c7d8f9b6-2xk4p -n catalogo
Status:   Failed
Reason:   Evicted
Message:  The node was low on resource: ephemeral-storage. Threshold quantity: 10%, available: 8%.
          Container busca was using 31Gi, request is 0, has larger consumption of ephemeral-storage.
```

<!-- solucao -->

## Investigação

A mensagem do despejo já aponta o culpado: o container `busca` usava **31Gi** de armazenamento efêmero com request 0. Dentro dele:

```text
$ kubectl exec -n catalogo deploy/busca -- du -sh /tmp/logs
29G   /tmp/logs
```

A aplicação grava logs de debug em arquivo dentro do container em vez de escrever no stdout. Esse espaço vem do disco do nó (camada gravável do container), o mesmo usado por imagens e pelos logs do kubelet.

## Causa raiz

**Uso descontrolado de armazenamento efêmero.** Quando o disco do nó passa do limiar (`nodefs.available`), o kubelet primeiro tenta liberar espaço (coleta de imagens e containers mortos) e depois **despeja Pods** — começando pelos que mais excedem seus requests de ephemeral-storage.

## Correção

- Escreva logs no **stdout/stderr** e deixe o agente de logs do cluster coletar (com rotação feita pelo kubelet).
- Para arquivos temporários, use `emptyDir` com limite:

```yaml
volumes:
  - name: tmp
    emptyDir:
      sizeLimit: 2Gi
resources:
  requests:
    ephemeral-storage: 1Gi
  limits:
    ephemeral-storage: 4Gi   # acima disso o Pod é despejado, e não o nó inteiro sofre
```

- Remova os Pods despejados (eles ficam como registro): `kubectl delete pods -A --field-selector=status.phase=Failed`.

## Prevenção

- Requests e limits de `ephemeral-storage` em todos os workloads.
- Alertas de disco do nó antes do limiar de despejo (node-exporter: `node_filesystem_avail_bytes`).
- Discos de nó dimensionados para imagens grandes, e limpeza de imagens configurada no kubelet (`imageGCHighThresholdPercent`).
