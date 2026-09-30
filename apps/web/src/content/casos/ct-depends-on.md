# A API sobe antes do banco e morre

## Contexto

No ambiente de desenvolvimento com Docker Compose, a API falha em cerca de metade das vezes que o time roda `docker compose up`. Quando isso acontece, basta rodar `docker compose restart api` e tudo funciona. Novos integrantes perdem horas achando que configuraram algo errado.

## Sintomas

```yaml
services:
  api:
    build: .
    depends_on: [db]
  db:
    image: postgres:16
```

```text
api-1  | sqlalchemy.exc.OperationalError: (psycopg.OperationalError) connection failed:
api-1  | connection to server at "db" (172.20.0.2), port 5432 failed: Connection refused
api-1 exited with code 1
db-1   | LOG:  database system is ready to accept connections
```

<!-- solucao -->

## Investigação

A ordem dos logs mostra a API tentando conectar **antes** de o Postgres terminar a inicialização. O nome `db` foi resolvido (a rede está certa); a porta ainda não estava aceitando conexões.

## Causa raiz

`depends_on: [db]` só garante que o **container** do banco foi iniciado antes do da API — não que o Postgres está pronto. Na primeira inicialização (initdb), o banco leva alguns segundos; a API tenta uma única vez, falha e sai. Por ser uma corrida, "às vezes funciona".

## Correção

Esperar a saúde do banco:

```yaml
services:
  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    restart: on-failure
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 3s
      timeout: 3s
      retries: 20
```

E, na aplicação, **tentar reconectar** com backoff na inicialização e durante a execução.

## Prevenção

- Aplicações resilientes a dependências indisponíveis: em produção o banco pode reiniciar a qualquer momento, e o Kubernetes **não** tem `depends_on`.
- No Kubernetes, a combinação é: retry na aplicação + readiness probe (não receber tráfego sem o banco) + eventualmente um init container que espera a dependência.
- Migrações como serviço separado com `condition: service_completed_successfully`.
