# O serviço Java que some sem deixar erro

## Contexto

O serviço de faturamento (Java 21) roda com `--memory=1g`. Várias vezes por dia, especialmente no fechamento do mês, o container reinicia. Os logs da aplicação terminam abruptamente, sem stack trace nem `OutOfMemoryError`.

## Sintomas

```text
$ docker ps -a --filter name=faturamento --format '{{.Status}}'
Up 12 minutes (restarted 7 times)

$ docker inspect faturamento --format '{{.State.ExitCode}} {{.State.OOMKilled}}'
137 true

$ docker inspect faturamento --format '{{.Config.Cmd}}'
[java -Xmx1g -jar /app/faturamento.jar]
```

<!-- solucao -->

## Investigação

```text
$ docker stats faturamento --no-stream
NAME          MEM USAGE / LIMIT   MEM %
faturamento   998MiB / 1GiB       97.5%

$ dmesg | grep -i "killed process"          # no host
Memory cgroup out of memory: Killed process 81234 (java) total-vm:… anon-rss:1046528kB
```

## Causa raiz

O heap máximo foi configurado igual ao limite do container (`-Xmx1g` com `--memory=1g`). Mas a JVM usa bem mais que o heap: metaspace, pilhas de threads, code cache, buffers diretos (NIO), GC. Quando o heap cresce no fechamento do mês, o **total** passa de 1 GiB e o **kernel** mata o processo (OOM do cgroup, SIGKILL → exit 137). Como é um SIGKILL, a JVM não tem chance de logar nada — por isso não há `OutOfMemoryError`.

## Correção

```bash
docker run -d --memory=1g \
  -e JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError" \
  ghcr.io/org/faturamento:5.4.0
```

- `MaxRAMPercentage` dimensiona o heap a partir do limite do cgroup, deixando margem para o resto.
- `ExitOnOutOfMemoryError` transforma um OOM de heap em saída limpa e visível no log.
- Se 70% não bastar para a carga real, aumente o **limite**, não o `-Xmx`.

## Prevenção

- Nunca configurar heap (ou `--max-old-space-size` no Node) igual ou maior que o limite do container.
- Alertas de `OOMKilled` e de uso de memória acima de 85% do limite.
- Testes de carga com os mesmos limites de produção.
- No Kubernetes: `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` no `kubectl describe pod`.

Decodifique o 137 no simulador de exit codes.
