# A chave da nuvem que estava na imagem pública

## Contexto

Um alerta do provedor de nuvem avisou sobre uso anômalo de uma chave de acesso: instâncias de mineração de criptomoedas em três regiões. A chave pertencia ao pipeline de build da equipe de dados, que publica uma imagem de ferramentas **pública** no Docker Hub para a comunidade.

## Sintomas

```dockerfile
FROM python:3.12-slim
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
COPY . /app
RUN aws s3 cp s3://modelos/base.bin /app/modelos/ && rm -f /app/.env
```

```bash
docker build --build-arg AWS_ACCESS_KEY_ID=$KEY --build-arg AWS_SECRET_ACCESS_KEY=$SECRET -t org/ferramentas:3.1 .
```

"Mas o `.env` é apagado no final e os ARGs não ficam na imagem", explicou o autor.

<!-- solucao -->

## Investigação

Qualquer pessoa que baixa a imagem consegue:

```text
$ docker history --no-trunc org/ferramentas:3.1 | grep aws
RUN |2 AWS_ACCESS_KEY_ID=AKIA… AWS_SECRET_ACCESS_KEY=wJal… /bin/sh -c aws s3 cp …

$ docker save org/ferramentas:3.1 | tar -x -C /tmp/img
$ find /tmp/img -name '*.tar' -exec tar -tf {} \; | grep .env
app/.env                 ← presente na camada do COPY
```

## Causa raiz

- Valores de `ARG` usados num `RUN` ficam registrados no **histórico** da imagem.
- O `COPY . /app` gravou o `.env` (com outras credenciais) numa camada; o `rm` numa camada seguinte só esconde o arquivo — ele continua na camada anterior, acessível a quem extrair a imagem.
- Sem `.dockerignore`, o `.env` local entrou no contexto de build.

## Correção

1. **Revogar imediatamente** as chaves expostas (e todas as do `.env`) e gerar novas; investigar o uso indevido.
2. Remover as tags publicadas — sabendo que cópias já baixadas continuam existindo.
3. Refazer o build com segredos montados só durante o `RUN`:
   ```dockerfile
   RUN --mount=type=secret,id=aws,target=/root/.aws/credentials aws s3 cp s3://modelos/base.bin /app/modelos/
   ```
   ```bash
   docker build --secret id=aws,src=$HOME/.aws/credentials -t org/ferramentas:3.2 .
   ```
   Melhor ainda: o CI usa credenciais temporárias (OIDC) e baixa os artefatos **antes** do build.

## Prevenção

- `.dockerignore` com `.env`, `*.pem`, `.aws`, `id_*`.
- Scanner de segredos nas imagens e no repositório (trivy `--scanners secret`, gitleaks) no CI.
- Nunca usar `ARG`/`ENV` para segredos; nada de credenciais de longa duração em pipelines.
