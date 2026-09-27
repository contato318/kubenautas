# O servidor de CI sem espaço em disco

## Contexto

O runner self-hosted de CI começou a falhar todos os builds na segunda-feira. Ninguém mudou os pipelines. O disco de 200 GB, que tinha folga no mês passado, está cheio. O mesmo aconteceu, em menor escala, num servidor de aplicação com Docker Compose rodando há um ano.

## Sintomas

```text
ERROR: failed to solve: failed to copy files: write /var/lib/docker/…: no space left on device

$ df -h /var/lib/docker
Filesystem  Size  Used Avail Use% Mounted on
/dev/sdb1   200G  200G     0 100% /var/lib/docker
```

<!-- solucao -->

## Investigação

```text
$ docker system df
TYPE            TOTAL   ACTIVE   SIZE      RECLAIMABLE
Images          1843    12       142.6GB   139.9GB (98%)
Containers      611     3        4.1GB     4.0GB (97%)
Local Volumes   88      4        9.8GB     8.7GB (88%)
Build Cache     5120    0        38.2GB    38.2GB

$ du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail -1
31G   /var/lib/docker/containers/7c1e…/7c1e…-json.log      ← servidor de aplicação
```

## Causa raiz

O Docker não apaga nada sozinho:

- Cada build deixa imagens antigas e intermediárias (**dangling**) e cache de BuildKit.
- Containers terminados sem `--rm` se acumulam.
- Volumes anônimos ficam para trás.
- No servidor de aplicação, o driver de log padrão **json-file** não tem rotação por padrão: um container verboso gerou 31 GB de log.

## Correção

```bash
docker container prune -f
docker image prune -a -f --filter "until=168h"     # imagens sem uso há mais de 7 dias
docker builder prune -f --keep-storage 20GB
docker volume prune -f                             # atenção: confirme que não há dados importantes
```

Rotação de logs em `/etc/docker/daemon.json` (vale para containers **novos**):

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "3" } }
```

(ou o driver `local`, que já faz rotação e compressão).

## Prevenção

- Limpeza agendada nos runners (ou runners efêmeros, recriados a cada job).
- `--rm` em containers pontuais; `docker compose down` ao final de testes.
- Rotação de logs configurada no provisionamento de todo host Docker.
- Alertas de uso de disco em `/var/lib/docker` antes dos 80%.
- No Kubernetes, o kubelet faz a coleta de imagens e a rotação de logs dos containers — mas os limites (`imageGCHighThresholdPercent`, `containerLogMaxSize`) também merecem revisão.
