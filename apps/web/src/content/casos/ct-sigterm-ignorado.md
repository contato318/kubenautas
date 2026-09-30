# Todo deploy derruba requisições em andamento

## Contexto

Em cada deploy da API de pagamentos, clientes recebem alguns erros 502. O time mediu: parar cada container leva exatamente 10 segundos, e as requisições que estavam em processamento são cortadas no meio. A aplicação tem um handler de SIGTERM que termina as requisições antes de sair — mas ele nunca registra nada no log.

## Sintomas

```text
$ time docker stop pagamentos
pagamentos
real    0m10.21s

$ docker inspect pagamentos --format '{{.State.ExitCode}}'
137
```

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY . .
CMD npm start
```

<!-- solucao -->

## Investigação

```text
$ docker exec pagamentos ps -o pid,comm
PID  COMMAND
  1  sh
  7  npm start
 18  node
```

O PID 1 é o `sh`. O `docker stop` envia SIGTERM ao PID 1; o shell não repassa o sinal ao `npm`, que também não repassa ao `node`. Após 10 s, o Docker envia SIGKILL a todos (exit code **137** = 128 + 9).

## Causa raiz

A **forma shell** do `CMD` (`CMD npm start`) executa `/bin/sh -c "npm start"`. O processo real da aplicação fica dois níveis abaixo do PID 1 e **nunca recebe o SIGTERM**. O handler de encerramento gracioso não roda, e o SIGKILL corta as requisições em andamento.

## Correção

```dockerfile
CMD ["node", "server.js"]
```

- Forma **exec**: o `node` é o PID 1 e recebe o sinal diretamente.
- Evite `npm start` como processo principal em produção (o npm não repassa sinais de forma confiável em todas as versões).
- Se o processo criar filhos, use um init mínimo: `docker run --init` ou `tini` como ENTRYPOINT.
- Scripts de entrada devem terminar com `exec "$@"`.

Resultado: `docker stop` leva ~300 ms, exit code **143** e nenhuma requisição perdida.

## Prevenção

- Lint de Dockerfile (`hadolint` alerta sobre a forma shell).
- Teste que mede o tempo de `docker stop` e o exit code.
- No Kubernetes, o mesmo problema faz cada Pod usar todo o `terminationGracePeriodSeconds` e terminar com 137; combine com um `preStop` curto para dar tempo de os endpoints serem removidos.

Decodifique 137 e 143 no simulador de exit codes.
