# OOMKilled intermitente em uma aplicação Java

## Contexto

O serviço `relatorios` (Java 21, Spring Boot) reinicia algumas vezes por dia, sempre nos horários de maior uso. O painel de heap da JVM mostra uso de **no máximo 70% do heap**. O time jura que "não é memória".

## Sintomas

```text
$ kubectl get pod relatorios-5d8c7b9f4-x2k9p
NAME                          READY   STATUS    RESTARTS       AGE
relatorios-5d8c7b9f4-x2k9p    1/1     Running   7 (2h ago)     2d

$ kubectl describe pod relatorios-5d8c7b9f4-x2k9p
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
    Limits:
      memory:  1Gi
    Requests:
      memory:  1Gi
```

No Dockerfile:

```dockerfile
ENTRYPOINT ["java", "-Xmx1g", "-jar", "/app/relatorios.jar"]
```

<!-- solucao -->

## Investigação

`OOMKilled` com **exit code 137** (128 + 9, SIGKILL) significa que o **kernel** matou o processo porque o cgroup do container ultrapassou o limit de memória — não é um `OutOfMemoryError` da JVM (esse apareceria no log e não gera 137).

A métrica que o kernel usa não é o heap, e sim a memória total do processo:

```promql
container_memory_working_set_bytes{pod=~"relatorios.*", container="relatorios"}
```

Ela bate em 1Gi nos picos, enquanto o heap fica em ~700Mi.

## Causa raiz

Uma JVM consome muito mais que o heap: **metaspace**, **code cache**, **pilhas das threads** (centenas de threads do Tomcat em pico), **buffers diretos** (NIO/Netty) e o próprio GC. Com `-Xmx1g` e limit de `1Gi`, o heap sozinho pode ocupar todo o limit — qualquer memória fora do heap estoura o cgroup.

## Correção

```dockerfile
# Heap proporcional ao limit do container, deixando folga para o resto da JVM
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/relatorios.jar"]
```

```yaml
resources:
  requests:
    memory: 1536Mi
  limits:
    memory: 1536Mi   # heap ≈ 1Gi + ~500Mi para o que não é heap
```

A JVM moderna lê o limit do cgroup; `MaxRAMPercentage` faz o heap acompanhar mudanças de limit sem rebuild da imagem.

## Prevenção

- Nunca fixe `-Xmx` igual (ou próximo) ao limit do container.
- Monitore `working_set` do container, não só o heap.
- Alerte em reinícios com motivo `OOMKilled` (`kube_pod_container_status_last_terminated_reason`).
- Para memória, prefira `requests = limits`: o Pod vira Guaranteed na dimensão de memória e fica por último na fila de despejo.
