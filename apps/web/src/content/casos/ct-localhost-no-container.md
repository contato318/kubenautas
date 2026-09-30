# Funciona com npm run dev, não funciona no container

## Contexto

Um desenvolvedor containerizou sua API Flask. Fora do Docker, `curl localhost:5000` responde. Com o container rodando e a porta publicada, nada responde. Os logs mostram a aplicação no ar, sem erros.

## Sintomas

```text
$ docker run -d --name api -p 5000:5000 api:dev
$ docker logs api
 * Running on http://127.0.0.1:5000
 * Debug mode: off

$ curl -v http://localhost:5000/health
* Connected to localhost (127.0.0.1) port 5000
> GET /health HTTP/1.1
* Empty reply from server
curl: (52) Empty reply from server
```

<!-- solucao -->

## Investigação

De dentro do container, funciona:

```text
$ docker exec api curl -s localhost:5000/health
{"status":"ok"}

$ docker exec api sh -c 'ss -lntp'
LISTEN 0 128 127.0.0.1:5000 0.0.0.0:*  users:(("python",pid=1))
```

A aplicação escuta apenas no **loopback do container**.

## Causa raiz

Cada container tem seu próprio namespace de rede. O tráfego publicado com `-p` chega pela interface `eth0` do container (IP da rede bridge), não pelo `127.0.0.1` dele. Um servidor que escuta só em `127.0.0.1` — o padrão do servidor de desenvolvimento do Flask, e de vários outros — nunca recebe essas conexões. O proxy do Docker aceita a conexão no host e a encerra sem resposta: "Empty reply".

## Correção

Fazer a aplicação escutar em todas as interfaces:

```dockerfile
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
# ou, no servidor de desenvolvimento: flask run --host=0.0.0.0
```

## Prevenção

- Endereço de escuta configurável por variável de ambiente, com `0.0.0.0` como padrão na imagem.
- Teste de fumaça no CI que sobe o container e faz uma requisição pela porta publicada.
- A mesma causa aparece no Kubernetes como Service com endpoints mas `Connection refused` — verifique com `ss -lntp` dentro do Pod.
