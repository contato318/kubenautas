# Dockerfile: construindo imagens

Um Dockerfile é a receita da imagem. Cada instrução gera uma camada ou altera a configuração.

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000
USER 1000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
```

```bash
docker build -t api:dev .          # "." é o contexto de build
docker run --rm -p 8000:8000 api:dev
```

## As instruções

| Instrução | Para quê |
| --- | --- |
| `FROM` | Imagem base (pode aparecer várias vezes: multi-stage) |
| `WORKDIR` | Diretório de trabalho (cria se não existir) — evite `RUN cd …` |
| `COPY` | Copia arquivos do contexto para a imagem |
| `ADD` | Como `COPY`, mas também extrai tar locais e baixa URLs — prefira `COPY` |
| `RUN` | Executa um comando **no build** e grava o resultado numa camada |
| `ENV` | Variável disponível no build e em execução |
| `ARG` | Variável só do build (`--build-arg`) |
| `EXPOSE` | **Documenta** a porta; não publica nada |
| `USER` | Usuário que executa os próximos `RUN` e o container |
| `ENTRYPOINT` / `CMD` | O que roda quando o container inicia |
| `HEALTHCHECK` | Comando periódico para marcar o container como healthy/unhealthy |
| `LABEL` | Metadados (ex.: `org.opencontainers.image.source`) |

## ENTRYPOINT × CMD

- `ENTRYPOINT` — o executável fixo.
- `CMD` — argumentos padrão (ou o comando inteiro, se não houver ENTRYPOINT).
- Argumentos do `docker run imagem ARGS` **substituem o CMD**; `--entrypoint` substitui o ENTRYPOINT.

```dockerfile
ENTRYPOINT ["python", "manage.py"]
CMD ["runserver", "0.0.0.0:8000"]
```

```bash
docker run app                 # python manage.py runserver 0.0.0.0:8000
docker run app migrate         # python manage.py migrate
```

### Forma exec × forma shell

```dockerfile
CMD ["node", "server.js"]      # exec: node é o PID 1 e recebe sinais
CMD node server.js             # shell: /bin/sh -c "node server.js" — sh é o PID 1
```

Use sempre a forma **exec** (JSON) para `ENTRYPOINT` e `CMD`. Precisa de um script de entrada? Termine-o com `exec "$@"` para que o processo final substitua o shell.

## Contexto de build e `.dockerignore`

O **contexto** (o `.` do `docker build`) é enviado inteiro ao builder. Sem `.dockerignore`, vão junto `.git`, `node_modules`, arquivos `.env`, dumps de banco…

```gitignore
# .dockerignore
.git
node_modules
**/__pycache__
.env
*.log
dist
```

Benefícios: builds mais rápidos, imagens menores, menos risco de vazar segredos e cache mais estável.

## Cache de build

O builder reaproveita uma camada se a instrução **e** seus insumos não mudaram. Quando uma camada muda, **todas as seguintes** são refeitas. Por isso a ordem importa:

```dockerfile
# ✅ dependências primeiro: mudar o código não reinstala tudo
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ❌ qualquer mudança no código invalida o npm ci
COPY . .
RUN npm ci
```

Outras dicas:

- Junte comandos relacionados num `RUN` e limpe no mesmo passo: `apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*`.
- Apagar arquivos numa camada **posterior** não reduz a imagem: eles continuam na camada anterior.
- `--no-cache` força rebuild completo (útil para pegar atualizações de segurança).

## ARG, ENV e o que fica gravado

- `ENV` fica na configuração da imagem — visível em `docker inspect`.
- `ARG` não fica no ambiente final, mas o valor pode aparecer em `docker history` se usado em `RUN`.
- **Nunca** passe segredos por `ARG`/`ENV` nem copie `.env` para a imagem: use `RUN --mount=type=secret` (lição de builds otimizados).

## HEALTHCHECK

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
```

`docker ps` mostra `(healthy)`/`(unhealthy)`, e o Compose pode esperar por ele. No Kubernetes, o `HEALTHCHECK` da imagem é **ignorado**: use probes.
