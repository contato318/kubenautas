# Todo build reinstala todas as dependências

## Contexto

O CI do monorepo Python leva 14 minutos por pipeline, e o time reclama que o build da imagem é o gargalo. Mesmo mudando uma linha de um template HTML, o log mostra a instalação completa das dependências, incluindo a compilação de pacotes nativos.

## Sintomas

```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y build-essential libpq-dev
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
```

```text
 => [3/5] COPY . .                                                 0.4s
 => [4/5] RUN pip install -r requirements.txt                    512.8s
```

<!-- solucao -->

## Investigação

O builder reaproveita uma camada somente se a instrução e seus insumos não mudaram. `COPY . .` copia **todo** o código: qualquer alteração em qualquer arquivo gera um checksum diferente e invalida essa camada **e todas as seguintes** — incluindo o `pip install`. Além disso, os runners do CI começam sem cache algum.

## Causa raiz

Ordem das instruções: as dependências (que mudam raramente) são instaladas **depois** da cópia do código (que muda sempre). Somado à ausência de cache no CI, cada build refaz tudo.

## Correção

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip wheel -r requirements.txt -w /wheels

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir /wheels/*
COPY . .
USER 1000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
```

E no CI: `--cache-from`/`--cache-to` (registry ou `type=gha`). Resultado: mudanças no código reconstroem só a última camada (~20 s); a imagem final perdeu o compilador.

## Prevenção

- Regra de ordem: do que muda menos para o que muda mais.
- Copiar primeiro só os manifestos de dependências (`requirements.txt`, `package-lock.json`, `go.sum`).
- `.dockerignore` para que arquivos irrelevantes não invalidem o cache.
- Monitorar o tempo de build no CI e investigar regressões.
