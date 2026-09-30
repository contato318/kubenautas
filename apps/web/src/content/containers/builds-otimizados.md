# Builds otimizados: multi-stage, BuildKit e multiplataforma

Imagens menores baixam mais rápido, iniciam mais rápido (autoscaling!), custam menos em registry e têm menos vulnerabilidades. Builds mais rápidos encurtam o ciclo de desenvolvimento e o CI.

## Multi-stage builds

Compiladores, headers e dependências de desenvolvimento são necessários para **construir**, não para **rodar**. Com vários `FROM`, cada estágio começa limpo e você copia só o resultado:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

Para Go ou Rust, o estágio final pode ser `scratch` ou `distroless` com um único binário estático:

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./cmd/app

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
ENTRYPOINT ["/app"]
```

Outros usos: `docker build --target test .` para rodar testes num estágio intermediário; estágios que servem de base para vários serviços.

## BuildKit

O BuildKit é o builder padrão do Docker moderno. Traz execução paralela de estágios, cache mais inteligente e montagens especiais em `RUN`:

### Cache de dependências entre builds

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN --mount=type=cache,target=/root/.npm npm ci
```

O diretório de cache persiste entre builds sem entrar na imagem.

### Segredos no build (sem vazar)

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

O arquivo existe só durante aquele `RUN` e **não** fica em nenhuma camada nem no histórico. Para chaves SSH (clonar repositórios privados): `RUN --mount=type=ssh` com `docker build --ssh default`.

## Cache no CI

Runners de CI costumam começar sem cache. Exporte e importe o cache do BuildKit:

```bash
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/org/api:buildcache \
  --cache-to type=registry,ref=ghcr.io/org/api:buildcache,mode=max \
  -t ghcr.io/org/api:$GIT_SHA --push .
```

(GitHub Actions também oferece `type=gha`.)

## Multiplataforma com buildx

Macs com Apple Silicon constroem `arm64` por padrão; muitos servidores são `amd64`. Construa para as duas:

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/org/api:2.3.1 --push .
```

O builder usa emulação (QEMU) ou nós nativos; em Dockerfiles, `ARG TARGETPLATFORM`/`TARGETARCH` permitem baixar o binário certo para cada plataforma.

## Checklist de tamanho

1. Base enxuta (`-slim`, `distroless`, `alpine` com cuidado por causa da musl).
2. Multi-stage: nada de compiladores na imagem final.
3. `.dockerignore` completo.
4. Limpeza no **mesmo** `RUN` que cria os arquivos (`rm -rf /var/lib/apt/lists/*`).
5. Só dependências de produção (`npm ci --omit=dev`, `pip install --no-cache-dir`).
6. Inspecione com `docker history` e `dive`.

| Aplicação | Ingênua | Otimizada |
| --- | --- | --- |
| Node.js (`node:22` + tudo) | ~1,2 GB | ~180 MB (`slim` + multi-stage) |
| Go (`golang:1.23`) | ~900 MB | ~10 MB (`distroless/static`) |
| Python (`python:3.12`) | ~1 GB | ~150 MB (`slim` + wheels) |

## Builds reprodutíveis

- Fixe versões da base (e, se possível, por digest) e das dependências (lockfiles).
- Não use `apt-get upgrade` sem controle: cada build pode gerar uma imagem diferente.
- Rotule a imagem com a origem: `LABEL org.opencontainers.image.revision=$GIT_SHA`.
- Gere **SBOM** e **proveniência** (`docker buildx build --sbom=true --provenance=true`) para rastrear o que há dentro de cada imagem.
