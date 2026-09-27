# Executando containers: ciclo de vida, logs e sinais

## `docker run` em detalhe

```bash
docker run -d --name api \
  -p 8080:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ghcr.io/minha-org/api:2.3.1
```

| Opção | Efeito |
| --- | --- |
| `-d` | Em segundo plano (detached) |
| `-it` | Terminal interativo (stdin aberto + TTY) |
| `--rm` | Remove o container quando ele terminar |
| `--name` | Nome fixo (senão, um aleatório como `quirky_turing`) |
| `-p host:container` | Publica uma porta do container no host |
| `-e`, `--env-file` | Variáveis de ambiente |
| `-v`, `--mount` | Volumes e bind mounts (lição de armazenamento) |
| `--restart` | `no`, `on-failure[:N]`, `always`, `unless-stopped` |
| `--entrypoint`, argumentos no fim | Sobrescrevem `ENTRYPOINT` / `CMD` da imagem |

`docker run` = `docker create` + `docker start`.

## Estados de um container

```
created → running → (paused) → exited → removed
```

```bash
docker ps                      # em execução
docker ps -a                   # todos, inclusive os que terminaram
docker ps -a --filter status=exited
docker start api / docker stop api / docker restart api
docker rm api                  # remove (precisa estar parado, ou use -f)
```

Um container **vive enquanto o seu processo principal (PID 1) vive**. Se o comando termina, o container termina — mesmo que tudo "esteja ok". Por isso `docker run ubuntu` termina na hora: o comando padrão (`bash`) não tem terminal e sai.

## Observando

```bash
docker logs -f --tail 100 api        # stdout e stderr do processo principal
docker logs --since 10m api
docker exec -it api sh               # novo processo dentro do container em execução
docker inspect api                   # tudo: IP, mounts, env, estado, exit code
docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' api
docker stats                         # CPU, memória, rede, I/O em tempo real
docker top api                       # processos do container
docker cp api:/app/config.json .     # copiar arquivos de/para o container
```

Regra de ouro: aplicações em container devem **logar em stdout/stderr**, não em arquivos. O Docker (e o Kubernetes) capturam essa saída.

## Exit codes

| Código | Significado comum |
| --- | --- |
| `0` | Terminou com sucesso |
| `1` | Erro da aplicação |
| `125` | Erro do próprio `docker run` (opção inválida…) |
| `126` | Comando encontrado, mas sem permissão de execução |
| `127` | Comando não encontrado na imagem |
| `137` | 128 + 9 → **SIGKILL** (OOM ou `docker kill`/timeout do stop) |
| `143` | 128 + 15 → **SIGTERM** tratado — encerramento normal |

## Parando containers: SIGTERM, SIGKILL e PID 1

`docker stop` envia **SIGTERM** ao PID 1 e espera (10 s por padrão, `-t` muda); se o processo não terminar, envia **SIGKILL**. O mesmo acontece no Kubernetes com o `terminationGracePeriodSeconds`.

Armadilhas com o PID 1:

- **Forma shell** no Dockerfile (`CMD node server.js`) roda `/bin/sh -c "node server.js"`: o PID 1 é o **sh**, que não repassa o SIGTERM ao node. Resultado: o stop sempre espera 10 s e termina com `137`.
- O PID 1 não recebe o comportamento padrão de sinais do kernel: se a aplicação não instalar um handler de SIGTERM, ela pode ignorá-lo.
- O PID 1 precisa "colher" processos filhos órfãos (zumbis).

Soluções: forma **exec** (`CMD ["node", "server.js"]`), `exec` no fim de scripts de entrada, e um init mínimo (`docker run --init` ou `tini`) quando o processo cria filhos.

## Políticas de reinício

| Política | Reinicia quando |
| --- | --- |
| `no` (padrão) | Nunca |
| `on-failure[:N]` | Exit code ≠ 0 (até N vezes) |
| `always` | Sempre, inclusive ao reiniciar o daemon |
| `unless-stopped` | Sempre, exceto se você parou manualmente |

No Kubernetes, quem faz esse papel é o kubelet (`restartPolicy` do Pod) e os controllers (Deployment).

No simulador desta lição, decodifique exit codes e veja o backoff de reinícios — a mesma lógica que você encontrará no `CrashLoopBackOff` do Kubernetes.
