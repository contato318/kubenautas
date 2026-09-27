# exec format error só no servidor

## Contexto

Uma desenvolvedora com MacBook (Apple Silicon) construiu a imagem do serviço de notificações localmente e a enviou ao registry para um teste urgente em produção. No notebook, tudo funciona. No servidor Linux, o container morre na hora.

## Sintomas

```text
$ docker run --rm ghcr.io/org/notificacoes:1.3.0-hotfix
exec /usr/local/bin/notificacoes: exec format error

$ docker ps -a --filter name=notif --format '{{.Status}}'
Exited (1) 2 seconds ago
```

No Kubernetes, o mesmo erro aparece nos logs do Pod em `CrashLoopBackOff`.

<!-- solucao -->

## Investigação

```text
$ docker image inspect ghcr.io/org/notificacoes:1.3.0-hotfix --format '{{.Os}}/{{.Architecture}}'
linux/arm64

$ uname -m          # servidor
x86_64
```

## Causa raiz

O `docker build` num Mac com Apple Silicon produz, por padrão, uma imagem **linux/arm64**. O servidor é **amd64**: o kernel não consegue executar o binário de outra arquitetura e devolve `exec format error`. Como a tag tinha só a variante arm64 (sem índice multi-arquitetura), o pull não teve outra opção.

## Correção

Construir para a plataforma do servidor — ou para as duas:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/org/notificacoes:1.3.1 --push .
```

Em Dockerfiles que baixam binários, usar `ARG TARGETARCH` para escolher o arquivo certo por plataforma.

## Prevenção

- Imagens de produção construídas **somente pelo CI**, nunca de notebooks.
- Publicar índices multi-arquitetura quando houver nós arm64 e amd64 (cada vez mais comum: Graviton, Ampere).
- Checagem no pipeline: `docker buildx imagetools inspect` confirma as plataformas presentes.
- Em clusters mistos, `nodeSelector`/afinidade por `kubernetes.io/arch` para imagens de uma arquitetura só.
