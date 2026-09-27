# Mesma imagem, comportamentos diferentes

## Contexto

A API de relatórios roda em dois servidores com Docker Compose, ambos usando `image: ghcr.io/org/relatorios:latest`. Depois de uma reinicialização de rotina do servidor B, ele passou a gerar PDFs com layout quebrado. O servidor A, idêntico, continua perfeito. Ninguém fez deploy.

## Sintomas

```text
# servidor A
$ docker inspect relatorios --format '{{.Image}}'
sha256:3b1f0c…
# servidor B
$ docker inspect relatorios --format '{{.Image}}'
sha256:a97e44…

$ docker compose logs relatorios | head -1     # servidor B
WeasyPrint 62.0 — fontconfig: fallback font used for "Inter"
```

<!-- solucao -->

## Investigação

Os dois servidores rodam **imagens diferentes** com a mesma tag. No registry:

```text
$ crane digest ghcr.io/org/relatorios:latest
sha256:a97e44…      ← publicada há 2 dias pelo pipeline de um branch de testes
```

O servidor B executou `docker compose pull` no script de inicialização; o A ainda tinha a versão antiga em cache.

## Causa raiz

`latest` é uma tag **móvel**: o pipeline de um branch experimental publicou uma nova imagem com essa tag (com uma base Python mais nova e sem as fontes corporativas). Cada servidor passou a rodar "o latest" que tinha em mãos no momento do último pull — e não havia como saber qual versão estava em produção, nem voltar para "o latest de antes".

## Correção

- Fixar a versão conhecida boa em ambos: `image: ghcr.io/org/relatorios:1.8.3` (ou `@sha256:3b1f0c…`) e `docker compose up -d`.
- Corrigir o pipeline para publicar `latest` apenas a partir do branch principal (ou deixar de publicar `latest`).

## Prevenção

- Deploys sempre por **tag imutável** (semver ou SHA do commit) — e por digest onde a garantia importa.
- Registry com **tags imutáveis** habilitadas (ECR, Harbor, Artifact Registry suportam).
- Rótulos OCI na imagem (`org.opencontainers.image.version`, `.revision`) para identificar o que está rodando.
- Nada de `pull` implícito em reinicializações; atualizações acontecem só por deploy.
