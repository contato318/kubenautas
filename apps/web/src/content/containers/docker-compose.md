# Docker Compose: aplicações com vários containers

Rodar uma API, um banco, um cache e um worker com `docker run` exige comandos longos e ordem manual. O **Compose** descreve tudo num arquivo declarativo — um ótimo "ensaio" do modo de pensar do Kubernetes.

## Um `compose.yaml` completo

```yaml
services:
  api:
    build: .
    image: ghcr.io/org/api:dev
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/app
      REDIS_URL: redis://cache:6379/0
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    restart: unless-stopped

  worker:
    image: ghcr.io/org/api:dev
    command: ["python", "-m", "worker"]
    env_file: .env
    depends_on: [db, cache]

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10

  cache:
    image: redis:7

volumes:
  pgdata:
```

```bash
docker compose up -d            # cria rede, volumes e containers
docker compose ps
docker compose logs -f api
docker compose exec db psql -U app
docker compose down             # remove containers e rede (volumes ficam)
docker compose down -v          # ...e também os volumes nomeados (apaga os dados!)
```

## O que o Compose faz por você

- Cria uma **rede** para o projeto: os serviços se encontram pelo **nome do serviço** (`db`, `cache`).
- Prefixa recursos com o nome do projeto (pasta atual ou `-p`/`name:`), evitando colisões.
- Recria só os containers cuja configuração mudou (`up` é idempotente).
- Interpola variáveis `${VAR}` a partir do ambiente e do arquivo `.env` na pasta do projeto.

Atenção à diferença: o arquivo `.env` ao lado do `compose.yaml` é usado para **interpolação** do próprio arquivo; `env_file:` injeta variáveis **no container**.

## `depends_on` e a ordem de inicialização

`depends_on: [db]` garante apenas que o container do banco foi **iniciado** antes — não que o Postgres já aceita conexões. A aplicação pode subir, tentar conectar e falhar com `connection refused`.

Para esperar de verdade:

```yaml
depends_on:
  db:
    condition: service_healthy     # exige healthcheck no serviço db
```

Outras condições: `service_started` (padrão) e `service_completed_successfully` (ótimo para um serviço de migração que roda e termina).

Mesmo assim, programe a aplicação para **tentar reconectar**: em produção (e no Kubernetes) dependências caem e voltam a qualquer momento — ninguém garante ordem.

## Perfis, overrides e escala

```yaml
services:
  adminer:
    image: adminer
    profiles: [debug]            # só sobe com --profile debug
```

- `compose.override.yaml` é mesclado automaticamente — ótimo para ajustes locais (bind mounts, portas de debug).
- `docker compose -f compose.yaml -f compose.prod.yaml up` combina arquivos explicitamente.
- `docker compose up -d --scale worker=3` — várias réplicas de um serviço (sem `container_name` fixo e sem publicar a mesma porta no host).

## Desenvolvimento com Compose Watch

```yaml
services:
  api:
    build: .
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: requirements.txt
```

`docker compose watch` sincroniza arquivos ou reconstrói a imagem conforme você edita.

## Compose × Kubernetes

| Compose | Kubernetes |
| --- | --- |
| `services.api` | Deployment + Service |
| `ports` | Service (`NodePort`/`LoadBalancer`) ou Ingress/Gateway |
| `volumes` nomeados | PersistentVolumeClaim |
| `environment` / `env_file` | `env`, ConfigMap, Secret |
| `healthcheck` | readiness/liveness probes |
| `depends_on` | Não existe: aplicações devem tolerar dependências indisponíveis (init containers e probes ajudam) |
| `deploy.replicas` / `--scale` | `replicas` + HPA |

Ferramentas como o **Kompose** convertem um `compose.yaml` em manifests — um bom ponto de partida, mas revise o resultado.
