# A imagem de 2,3 GB que atrasa o autoscaling

## Contexto

O frontend em Node.js roda num cluster com autoscaling. Em picos de tráfego, novos nós levam mais de 4 minutos para servir requisições: a maior parte do tempo é gasta baixando a imagem. O deploy no CI também demora 12 minutos, dos quais 7 são de `docker push`.

## Sintomas

```text
$ docker image ls ghcr.io/org/frontend
REPOSITORY              TAG      SIZE
ghcr.io/org/frontend    4.2.0    2.31GB

$ kubectl describe pod frontend-7d9f-x2k | grep Pulled
  Normal  Pulled  kubelet  Successfully pulled image "ghcr.io/org/frontend:4.2.0" in 3m41.2s
```

```dockerfile
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD npm start
```

<!-- solucao -->

## Investigação

```text
$ docker history ghcr.io/org/frontend:4.2.0 --format '{{.Size}}\t{{.CreatedBy}}' | head -5
512MB   RUN npm run build
790MB   RUN npm install
640MB   COPY . .                 ← inclui .git, node_modules local, dumps de teste
1.1GB   (camadas da base node:22)

$ ls -a
.git  node_modules  e2e/fixtures/videos  dist  ...     (sem .dockerignore)
```

## Causa raiz

Três problemas somados:

1. **Sem `.dockerignore`**: o `COPY . .` levou `.git`, o `node_modules` do desenvolvedor e vídeos de testes E2E.
2. **Sem multi-stage**: a imagem final carrega a base completa `node:22`, todas as dependências de desenvolvimento e o cache do build.
3. Um frontend estático nem precisa de Node para ser servido.

## Correção

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

Mais um `.dockerignore` com `.git`, `node_modules`, `e2e`, `dist`, `*.log`. Resultado: **~45 MB**, pull em 3 segundos.

## Prevenção

- `.dockerignore` desde o primeiro commit do Dockerfile.
- Limite de tamanho de imagem no CI (falhar acima de um valor combinado).
- Revisão de Dockerfiles com `docker history`/`dive` e um linter como o `hadolint`.
- Imagens pequenas reduzem tempo de scale-up, custo de registry e superfície de ataque.
