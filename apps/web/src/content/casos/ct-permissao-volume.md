# Permission denied ao gravar uploads

## Contexto

Seguindo as boas práticas, o time passou a rodar a aplicação de gestão de documentos como usuário não-root (`USER 1000`). Em desenvolvimento e no servidor de homologação, os uploads passaram a falhar. Antes da mudança, tudo funcionava.

## Sintomas

```yaml
services:
  app:
    image: ghcr.io/org/docs:2.0.0
    volumes:
      - ./uploads:/app/uploads
```

```text
$ docker compose logs app | tail -2
PermissionError: [Errno 13] Permission denied: '/app/uploads/2026/09/contrato.pdf'

$ docker compose exec app id
uid=1000(app) gid=1000(app) groups=1000(app)
```

<!-- solucao -->

## Investigação

```text
$ docker compose exec app ls -ln /app
drwxr-xr-x 2 0 0 4096 Sep 27 10:11 uploads

$ ls -ln .            # no host
drwxr-xr-x 2 0 0 4096 Sep 27 10:11 uploads
```

O diretório `./uploads` no host pertence ao **UID 0** (foi criado pelo próprio Docker quando o bind mount apontou para um caminho inexistente, rodando como root). Dentro do container, o processo é o UID 1000.

## Causa raiz

Permissões são verificadas pelo kernel usando **números** de UID/GID, iguais dentro e fora do container (sem user namespaces). O bind mount expõe o diretório do host com dono root e permissão `755`; o UID 1000 pode ler, mas não escrever. Antes, o processo rodava como root e escrevia em qualquer lugar — o problema estava escondido.

## Correção

Em ambientes onde o diretório é do host:

```bash
sudo chown -R 1000:1000 ./uploads
```

Para o dado persistente, preferir um **volume nomeado** preparado na imagem:

```dockerfile
RUN mkdir -p /app/uploads && chown 1000:1000 /app/uploads
USER 1000
```

(Um volume nomeado vazio recebe uma cópia do diretório da imagem — incluindo dono e permissões — na primeira montagem.)

No Kubernetes, o equivalente é `securityContext.fsGroup: 1000`, que ajusta o grupo do volume para o Pod.

## Prevenção

- Não voltar para root para "resolver": ajuste o dono dos dados.
- Criar diretórios de dados no Dockerfile com o dono correto, antes do `USER`.
- Em desenvolvimento, `--user "$(id -u):$(id -g)"` alinha o UID do container com o seu.
- Usar `--mount type=bind`, que falha se a origem não existe, em vez de criar um diretório de root silenciosamente.
