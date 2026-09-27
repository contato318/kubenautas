# Imagens, tags, digests e registries

## Anatomia do nome de uma imagem

```
registry.exemplo.com:5000/time/api:2.3.1@sha256:9f2c…
└──────── registry ──────┘└ repositório ┘└ tag ┘└─ digest ─┘
```

- **Registry** — o servidor (`docker.io` quando omitido, `ghcr.io`, `quay.io`, ECR, GCR/Artifact Registry, ACR, Harbor…).
- **Repositório** — `nginx` no Docker Hub é, na verdade, `docker.io/library/nginx`.
- **Tag** — um rótulo **móvel** (`2.3.1`, `latest`, `1.27-alpine`). Pode ser reapontado para outra imagem a qualquer momento.
- **Digest** — o hash SHA-256 do manifesto: **imutável**. `@sha256:…` sempre traz exatamente os mesmos bytes.

## O problema do `latest`

`latest` é só uma tag como outra qualquer — não significa "a mais nova", e sim "a que alguém marcou como latest por último". Problemas:

- Hoje e amanhã, o mesmo `docker pull app:latest` traz imagens diferentes.
- Não dá para saber qual versão está em produção nem fazer rollback para "o latest de ontem".
- Caches locais podem manter um `latest` antigo.

Em produção, use **tags de versão imutáveis** (semver, SHA do commit) e, para máxima garantia, **digests**.

## Camadas e manifestos

Cada instrução que muda arquivos num Dockerfile gera uma **camada** (um tar com as diferenças). O **manifesto** lista as camadas e a **configuração** (comando, env, usuário).

```bash
docker pull nginx:1.27
docker image ls
docker image inspect nginx:1.27 --format '{{.RootFS.Layers}}'
docker history nginx:1.27          # camadas e as instruções que as criaram
```

Camadas são **compartilhadas**: se dez imagens usam a mesma base, ela é baixada e armazenada uma vez.

### Imagens multi-arquitetura

Um **índice de imagens** (manifest list) aponta para variações por plataforma: `linux/amd64`, `linux/arm64`… O `docker pull` escolhe a da sua máquina automaticamente.

```bash
docker manifest inspect python:3.12-slim | grep architecture
docker pull --platform linux/amd64 python:3.12-slim
```

Se uma imagem só existe para `arm64` e roda num servidor `amd64`, o erro é `exec format error` (veja o caso correspondente).

## Registries: pull, tag e push

```bash
docker login ghcr.io                                  # credenciais em ~/.docker/config.json
docker tag api:dev ghcr.io/minha-org/api:2.3.1        # novo nome para a mesma imagem
docker push ghcr.io/minha-org/api:2.3.1
docker pull ghcr.io/minha-org/api@sha256:9f2c…       # por digest
```

`docker tag` não copia nada: cria outro nome apontando para o mesmo ID de imagem.

### Limites e espelhos

O Docker Hub aplica **limites de pull** para usuários anônimos e gratuitos. Em CI e clusters, isso vira falhas intermitentes (`toomanyrequests`). Soluções: autenticar, usar um **registry espelho/proxy** (Harbor, ECR pull-through cache) ou copiar as imagens base para o registry da empresa.

## Escolhendo imagens base

| Base | Tamanho aproximado | Observações |
| --- | --- | --- |
| `ubuntu`, `debian` | 30–80 MB | Familiar, glibc, muitas ferramentas |
| `*-slim` (ex.: `python:3.12-slim`) | ~50 MB | Debian enxuto — ótimo padrão |
| `alpine` | ~5 MB | Usa **musl** em vez de glibc: binários e wheels podem se comportar diferente |
| `distroless` | 2–20 MB | Sem shell nem gerenciador de pacotes: menor superfície de ataque |
| `scratch` | 0 | Vazia: para binários estáticos (Go, Rust) |

Prefira imagens **oficiais** ou de **fornecedores verificados**, atualize a base com frequência (ela carrega CVEs) e fixe versões (`python:3.12.7-slim-bookworm`) para builds reprodutíveis.

## Salvando e inspecionando sem registry

```bash
docker save api:2.3.1 -o api.tar      # imagem (com camadas) em um arquivo
docker load -i api.tar
docker image rm api:2.3.1
docker image prune                    # remove imagens "dangling" (sem tag)
```

Ferramentas como **dive** mostram camada por camada o que ocupa espaço; **crane** e **skopeo** copiam e inspecionam imagens entre registries sem precisar do Docker.
