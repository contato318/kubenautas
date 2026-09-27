# Armazenamento: camada gravável, volumes e bind mounts

## A camada gravável é efêmera

Tudo o que um container escreve fora de volumes vai para a sua **camada gravável** (copy-on-write). Ela:

- **some** quando o container é removido (`docker rm`, `--rm`, recriação pelo Compose, novo deploy);
- é lenta para escrita intensa (overlayfs copia o arquivo inteiro da camada de baixo na primeira modificação);
- não é compartilhada entre containers.

```bash
docker run --name t alpine sh -c 'echo oi > /dados.txt'
docker rm t                 # /dados.txt acabou de sumir para sempre
docker diff <container>     # mostra o que mudou na camada gravável (A/C/D)
```

Regra: containers devem ser **descartáveis**. Estado que importa vai para volumes (ou, melhor ainda, para serviços gerenciados: bancos, object storage).

## Três tipos de montagem

| Tipo | Origem | Uso típico |
| --- | --- | --- |
| **Volume** | Área gerenciada pelo Docker (`/var/lib/docker/volumes/…`) | Dados de bancos e aplicações |
| **Bind mount** | Um caminho qualquer do host | Código-fonte em desenvolvimento, arquivos de configuração |
| **tmpfs** | Memória | Arquivos temporários sensíveis ou rápidos |

```bash
# volume nomeado
docker volume create pgdata
docker run -d --name db -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=exemplo postgres:16

# bind mount (sintaxe --mount, mais explícita)
docker run --rm --mount type=bind,src="$PWD",dst=/app,readonly node:22 ls /app

# tmpfs
docker run --rm --tmpfs /tmp:size=64m alpine df -h /tmp
```

`-v nome:/caminho` cria um volume nomeado; `-v /caminho/absoluto:/caminho` é um bind mount; `-v /caminho` sozinho cria um **volume anônimo** (difícil de encontrar depois). Prefira `--mount`, que falha se o caminho de origem não existir em vez de criar um diretório vazio silenciosamente.

## O caminho certo importa

Um volume só protege os dados se estiver montado **exatamente** onde a aplicação grava. Cada imagem documenta o seu:

| Imagem | Diretório de dados |
| --- | --- |
| `postgres` | `/var/lib/postgresql/data` |
| `mysql` / `mariadb` | `/var/lib/mysql` |
| `redis` | `/data` |
| `mongo` | `/data/db` |

Montar em `/var/lib/postgres` (sem o "ql") não dá erro — só não protege nada (veja o caso de dados perdidos).

Ao montar um volume **vazio** num diretório que já tem arquivos na imagem, o Docker copia esses arquivos para o volume na primeira vez. Um **bind mount** sempre **esconde** o conteúdo da imagem naquele caminho.

## Permissões e UIDs

Dentro e fora do container, permissões usam **números** (UID/GID), não nomes. Se a aplicação roda como UID 1000 e o diretório montado pertence ao root (UID 0), o resultado é `Permission denied`.

Soluções:

- Ajustar o dono no host (`chown -R 1000:1000 ./dados`) ou no Dockerfile para volumes (`RUN mkdir /data && chown 1000:1000 /data` antes de `USER 1000`).
- Rodar com o UID do seu usuário em desenvolvimento: `docker run --user "$(id -u):$(id -g)" …`.
- No Kubernetes, `securityContext.fsGroup` faz o kubelet ajustar o grupo do volume.

## Gerenciando volumes

```bash
docker volume ls
docker volume inspect pgdata
docker volume rm pgdata
docker volume prune          # remove volumes não usados por nenhum container (cuidado!)
```

### Backup de um volume

```bash
docker run --rm -v pgdata:/origem:ro -v "$PWD":/backup alpine \
  tar czf /backup/pgdata-$(date +%F).tgz -C /origem .
```

Para bancos, prefira as ferramentas do próprio banco (`pg_dump`, `mysqldump`): copiar arquivos de um banco em execução pode gerar backups inconsistentes.

## Desenvolvimento com bind mounts

O padrão para "editar no host e ver no container":

```bash
docker run --rm -it -p 5173:5173 -v "$PWD":/app -v /app/node_modules -w /app node:22 npm run dev
```

O volume anônimo em `/app/node_modules` impede que o `node_modules` do host (talvez compilado para outro sistema) esconda o do container. No Mac/Windows, bind mounts atravessam a VM do Docker Desktop e podem ser mais lentos; o **Compose Watch** (`develop.watch`) é uma alternativa.

## No Kubernetes

Os mesmos conceitos reaparecem: `emptyDir` (efêmero, como a camada gravável/tmpfs), `hostPath` (bind mount — evite), `configMap`/`secret` (arquivos de configuração) e **PersistentVolumeClaims** (volumes persistentes provisionados pelo cluster).
