# Segurança e limites de recursos

Containers isolam, mas compartilham o kernel do host. Uma imagem mal construída ou um container com privilégios demais pode expor segredos ou o próprio host. E sem limites, um único container pode derrubar a máquina inteira.

## Não rode como root

Por padrão, o processo do container roda como **root (UID 0)**. Com namespaces de usuário desativados (o padrão), é o mesmo UID 0 do host — uma fuga do container vira root na máquina.

```dockerfile
RUN groupadd -r app && useradd -r -g app -u 10001 app
USER 10001
```

- Use UID numérico no `USER` (o Kubernetes consegue verificar `runAsNonRoot` só com números).
- Várias imagens já trazem um usuário: `node` (UID 1000), `nginxinc/nginx-unprivileged`, `distroless:nonroot`.
- Processo sem root não pode escutar em portas abaixo de 1024 por padrão: use 8080 em vez de 80.

## Reduzindo privilégios em execução

```bash
docker run --read-only --tmpfs /tmp \
  --cap-drop ALL --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges \
  --pids-limit 200 \
  api:2.3.1
```

| Opção | Efeito |
| --- | --- |
| `--read-only` | Sistema de arquivos raiz somente leitura (use tmpfs/volumes onde precisar escrever) |
| `--cap-drop ALL` | Remove as *capabilities* do Linux; adicione só as necessárias |
| `--security-opt no-new-privileges` | Impede ganho de privilégios via binários setuid |
| `--pids-limit` | Limita o número de processos (fork bombs) |

**Nunca** use `--privileged` nem monte `/var/run/docker.sock` em containers de aplicação: ambos equivalem a dar root no host.

## Segredos fora da imagem

Tudo o que entra numa camada fica lá — mesmo que um `RUN rm` posterior "apague". Qualquer pessoa com acesso à imagem pode extrair:

```bash
docker history --no-trunc api:2.3.1     # ARGs e comandos de cada camada
docker save api:2.3.1 | tar -x          # todas as camadas, arquivo por arquivo
```

Regras:

- Nada de `COPY .env`, `ENV API_KEY=…` ou `ARG TOKEN` usado em `RUN`.
- Segredos de **build**: `RUN --mount=type=secret`.
- Segredos de **execução**: variáveis/arquivos injetados na hora de rodar (`--env-file`, Docker/Compose secrets; no Kubernetes, Secrets e gerenciadores externos).
- Vazou? **Revogue e gere outro segredo** — reescrever a imagem não desfaz cópias já baixadas.

## Cadeia de suprimentos

- **Escaneie** imagens por CVEs: `trivy image api:2.3.1`, `docker scout cves api:2.3.1`, Grype.
- Reconstrua regularmente para pegar correções da base, mesmo sem mudanças no código.
- **Assine** imagens (Cosign/Sigstore) e verifique a assinatura no deploy.
- Gere **SBOM** (lista de componentes) para responder rápido a "estamos afetados pela CVE X?".
- Use bases mínimas: menos pacotes, menos vulnerabilidades.

## Limites de recursos

```bash
docker run -d --memory=512m --memory-swap=512m --cpus=1.5 api:2.3.1
docker stats
docker inspect -f '{{.State.OOMKilled}} {{.State.ExitCode}}' api
```

- **Memória** é um limite rígido: passou, o kernel mata o processo (**OOMKilled**, exit code **137**).
- **CPU** é compressível: o processo fica mais lento (*throttling*), mas não morre.
- Sem limites, um vazamento de memória num container pode fazer o kernel matar processos **aleatórios** do host.

### Runtimes que precisam "enxergar" o limite

- **JVM** moderna (Java 10+) respeita o cgroup; ajuste o heap com `-XX:MaxRAMPercentage=75` em vez de `-Xmx` fixo maior que o limite.
- **Node.js**: o heap padrão pode não caber em containers pequenos — `--max-old-space-size` (em MB) abaixo do limite.
- **Python/Go**: não têm heap fixo, mas caches e pools de workers (ex.: `gunicorn --workers`) precisam caber no limite.
- Lembre: o limite vale para **tudo** no container (heap, metaspace, buffers, threads, processos filhos).

## No Kubernetes

Os mesmos controles viram campos do Pod: `securityContext` (`runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities`, `allowPrivilegeEscalation: false`), `resources.requests/limits` (com as classes de QoS), Pod Security Admission e políticas que exigem imagens assinadas. O simulador desta lição mostra como requests e limits definem a QoS e a ordem de despejo.
