# Pods e containers: estados, motivos e exit codes

O status de um Pod é um resumo. O detalhe está no **estado de cada container** — e é ele que aponta a causa.

## Fases do Pod

| Phase | Significado |
| --- | --- |
| `Pending` | Aceito, mas algum container ainda não iniciou (agendamento, download de imagem, volume) |
| `Running` | Associado a um nó e pelo menos um container rodando |
| `Succeeded` | Todos os containers terminaram com sucesso (Jobs) |
| `Failed` | Todos terminaram e pelo menos um falhou |
| `Unknown` | O nó não reporta o estado (nó perdido) |

A coluna `STATUS` do `kubectl get pods` mostra algo mais útil: o **motivo** do container mais relevante (`CrashLoopBackOff`, `ImagePullBackOff`…).

## Estados de container

```text
State:          Waiting
  Reason:       CrashLoopBackOff
Last State:     Terminated
  Reason:       OOMKilled
  Exit Code:    137
  Started:      …
  Finished:     …
Restart Count:  12
```

- **Waiting**: `ContainerCreating`, `ImagePullBackOff`, `ErrImagePull`, `CrashLoopBackOff`, `CreateContainerConfigError`, `CreateContainerError`, `RunContainerError`.
- **Running**: rodando (o que não quer dizer pronto — veja `Ready`).
- **Terminated**: `Completed`, `Error`, `OOMKilled`, `ContainerCannotRun`, com exit code.

`Last State` é ouro: mostra **como terminou a execução anterior** quando o container está em loop.

## Exit codes

| Código | Significado |
| --- | --- |
| 0 | Sucesso. Num Deployment, reinicia para sempre: o processo não deveria terminar |
| 1 | Erro da aplicação (config, dependência, exceção) |
| 126 | Arquivo não executável |
| 127 | Comando não encontrado (command/args ou imagem errada) |
| 128 + N | Morto pelo sinal N |
| 137 (128+9) | SIGKILL: OOMKilled, ou morto após o grace period |
| 139 (128+11) | SIGSEGV: falha de segmentação |
| 143 (128+15) | SIGTERM: encerramento pedido (delete, rollout, drain) |

## CrashLoopBackOff

Não é uma causa: é o kubelet **esperando** antes de reiniciar um container que continua morrendo. A espera dobra a cada falha — 10 s, 20 s, 40s… até **5 minutos** — e zera depois que o container roda bem por 10 minutos.

A causa está em:

```bash
kubectl describe pod api -n loja | grep -A6 "Last State"
kubectl logs api -n loja --previous
```

## Motivos frequentes e onde olhar

| Status/Reason | Causa típica | Confirme com |
| --- | --- | --- |
| `CreateContainerConfigError` | ConfigMap/Secret (ou chave) inexistente | `describe` mostra qual |
| `ImagePullBackOff` | Tag errada, sem credencial, rate limit | Evento `Failed` com a mensagem do registry |
| `CrashLoopBackOff` + exit 1 | Erro da aplicação | `logs --previous` |
| `OOMKilled` | Memória acima do limit | métricas de memória, limit |
| `RunContainerError` | Problema do runtime (mount, seccomp, usuário) | `describe`, logs do kubelet |
| `Running` + `0/1` | Readiness falhando | eventos `Unhealthy` |
| Restarts com `Running` | Liveness matando o container | eventos `Unhealthy` + `Killing` |

## Probes: causas de reinício que não são crash

- **Liveness** reinicia o container quando falha `failureThreshold` vezes. Timeouts curtos (`timeoutSeconds: 1`, padrão) sob carga causam reinícios em cascata.
- **Readiness** só tira o Pod do Service — nunca reinicia.
- **Startup** protege aplicações lentas no boot: enquanto não passa, liveness e readiness ficam desligadas.

## Init containers

Se o Pod está em `Init:0/2`, `Init:Error` ou `Init:CrashLoopBackOff`, um init container falhou:

```bash
kubectl logs api -n loja -c wait-for-db
```

Pratique no simulador: decodifique exit codes e veja como o backoff cresce a cada reinício.
