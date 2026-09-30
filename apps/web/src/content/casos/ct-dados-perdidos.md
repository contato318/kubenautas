# O banco que voltou vazio depois da atualização

## Contexto

Um pequeno sistema interno roda em uma VM com Docker Compose: aplicação e PostgreSQL. Para atualizar o Postgres de 16.3 para 16.4, o administrador mudou a tag e, seguindo um tutorial, rodou `docker compose down` e depois `docker compose up -d`. A aplicação subiu — com o banco completamente vazio. Seis meses de cadastros sumiram.

## Sintomas

```yaml
services:
  db:
    image: postgres:16.4
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - dbdata:/var/lib/postgres
volumes:
  dbdata:
```

```text
$ docker compose logs db | head -3
db-1  | The files belonging to this database system will be owned by user "postgres".
db-1  | initdb: … creating directory /var/lib/postgresql/data … ok
db-1  | PostgreSQL init process complete; ready for start up.
```

<!-- solucao -->

## Investigação

```text
$ docker run --rm -v app_dbdata:/v alpine ls -la /v
total 8                       ← volume vazio: nunca recebeu dados

$ docker volume ls -f dangling=true
DRIVER  VOLUME NAME
local   9c1e5e…               ← volume anônimo do container antigo
```

A imagem oficial grava em `/var/lib/postgresql/data` — e declara esse caminho como `VOLUME`. O volume nomeado estava montado em `/var/lib/postgres` (sem "ql"), um diretório que o Postgres nunca usa.

## Causa raiz

Os dados sempre ficaram num **volume anônimo** criado automaticamente pelo `VOLUME` da imagem, preso ao container antigo. Um `docker compose up` simples, ao recriar o container, até reaproveitaria esse volume anônimo — mas o `down` removeu o container, e o `up` seguinte criou um container novo com um **novo** volume anônimo vazio. O `initdb` inicializou um banco do zero. O volume nomeado "de backup" estava vazio o tempo todo.

## Correção

Por sorte, o volume anônimo antigo ainda não tinha sido removido:

```bash
docker compose stop db
docker run --rm -v 9c1e5e…:/origem -v app_dbdata:/destino alpine sh -c 'cp -a /origem/. /destino/'
# corrigir o compose: - dbdata:/var/lib/postgresql/data
docker compose up -d db
```

(Se alguém tivesse rodado `docker volume prune` ou `docker compose down -v`, os dados estariam perdidos.)

## Prevenção

- Conferir o caminho de dados na documentação da imagem e testar: recriar o container e verificar que os dados permanecem.
- Backups lógicos regulares (`pg_dump`) **testados com restauração**, fora do host.
- Para dados importantes, considerar um banco gerenciado.
- Cuidado com `docker volume prune` e `down -v` em servidores.
