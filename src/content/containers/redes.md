# Redes de containers

Cada container tem, por padrão, o seu próprio **network namespace**: interfaces, IP, portas e `localhost` próprios. Entender isso resolve metade dos problemas de "não conecta".

## Drivers de rede

| Driver | Comportamento |
| --- | --- |
| `bridge` (padrão) | Rede privada no host; containers recebem IPs internos (ex.: 172.17.0.0/16) e saem para a internet via NAT |
| `host` | O container usa a rede do host diretamente — sem isolamento, sem `-p` (só Linux) |
| `none` | Sem rede, só loopback |
| `overlay` | Rede entre vários hosts (Swarm) |
| `macvlan` / `ipvlan` | O container aparece como um dispositivo na rede física |

```bash
docker network ls
docker network inspect bridge
```

## Publicando portas

```bash
docker run -d -p 8080:80 nginx              # host:8080 → container:80, em todas as interfaces
docker run -d -p 127.0.0.1:8080:80 nginx    # só acessível do próprio host
docker run -d -p 80 nginx                   # porta aleatória no host (veja com docker port)
docker port <container>
```

- `EXPOSE` no Dockerfile **não publica** nada: é documentação (e usado por `-P`, que publica todas as expostas em portas aleatórias).
- `-p 8080:80` sem IP expõe a porta em **todas** as interfaces do host — e, no Linux, as regras de iptables do Docker podem passar por cima de firewalls como o `ufw`. Para serviços internos, publique em `127.0.0.1`.

## O `localhost` de cada um

Dentro de um container, `localhost` é **o próprio container** — não o host, nem outros containers.

- Uma aplicação que escuta em `127.0.0.1:3000` **não** recebe conexões vindas de fora do container, nem pelo `-p`. Ela precisa escutar em `0.0.0.0` (todas as interfaces). Sintoma clássico: `curl: (52) Empty reply from server` ou `Connection reset by peer`.
- Para acessar um serviço do host a partir do container: `host.docker.internal` (Docker Desktop; no Linux, adicione `--add-host=host.docker.internal:host-gateway`).

## Redes definidas pelo usuário e DNS

Na rede `bridge` padrão, containers só se encontram por IP. Em uma rede **criada por você**, o Docker oferece **DNS interno**: cada container é encontrado pelo nome (e por aliases).

```bash
docker network create loja
docker run -d --name db --network loja -e POSTGRES_PASSWORD=exemplo postgres:16
docker run -d --name api --network loja -e DATABASE_URL=postgres://postgres:exemplo@db:5432/postgres api:dev
docker run --rm --network loja alpine ping -c1 db
```

Pontos importantes:

- O `db` **não** precisa publicar a porta 5432 para a `api` acessá-lo — dentro da rede, a comunicação é direta. Publique (`-p`) só o que precisa ser acessado de fora.
- Na rede, a porta usada é a **do container** (`db:5432`), não a publicada no host.
- Containers podem estar em várias redes (`docker network connect`), o que permite segmentar frontend, backend e dados.
- O DNS embutido responde em `127.0.0.11` dentro dos containers.

## Diagnóstico

```bash
docker exec -it api sh -c 'getent hosts db; nc -zv db 5432'
docker run --rm -it --network container:api nicolaka/netshoot   # entra no namespace de rede da api
docker inspect -f '{{json .NetworkSettings.Networks}}' api
```

A imagem `nicolaka/netshoot` traz `curl`, `dig`, `tcpdump`, `ss`, `iperf`… Usar `--network container:<nome>` compartilha o namespace de rede do alvo — é exatamente o que o `kubectl debug` faz num Pod.

| Sintoma | Causa provável |
| --- | --- |
| `Could not resolve host: db` | Containers em redes diferentes, ou na rede `bridge` padrão (sem DNS) |
| `Connection refused` | Nada escutando naquela porta (porta errada, app escutando só em 127.0.0.1, app ainda subindo) |
| Timeout | Firewall, rede diferente, porta não publicada no host |
| Funciona com IP, não com nome | Rede padrão sem DNS: crie uma rede própria |

## No Kubernetes

O modelo muda um pouco: **todos os containers de um Pod compartilham o mesmo namespace de rede** (falam entre si por `localhost`), cada Pod tem um IP roteável no cluster e o papel do DNS por nome passa aos **Services** (`db.loja.svc.cluster.local`). A lição de `0.0.0.0` × `127.0.0.1` continua valendo — é uma das causas mais comuns de Service "sem resposta".
