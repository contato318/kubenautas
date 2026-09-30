# De Docker para Kubernetes

Você já sabe construir, executar, conectar e proteger containers. O Kubernetes não substitui esses conceitos — ele os **orquestra** em muitas máquinas, de forma declarativa e com autocorreção. Esta lição é a ponte para o resto da trilha.

## O que o Docker não resolve sozinho

Em um host com Docker você responde manualmente a perguntas como:

- Em qual máquina roda cada container? E se a máquina morrer?
- Como distribuir tráfego entre 10 réplicas e trocar a versão sem downtime?
- Como escalar com a carga? Como entregar configuração e segredos com segurança?

O Kubernetes transforma essas respostas em **objetos declarativos** que controllers mantêm verdadeiros continuamente.

## Mapeando `docker run` para um Pod

```bash
docker run -d --name api \
  -p 8080:3000 \
  -e NODE_ENV=production \
  -v api-data:/data \
  --memory=512m --cpus=0.5 \
  --restart always \
  ghcr.io/org/api:2.3.1 node server.js --port 3000
```

```yaml
apiVersion: apps/v1
kind: Deployment                       # --restart always + réplicas + rollout
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: api
          image: ghcr.io/org/api:2.3.1
          command: ["node"]            # substitui o ENTRYPOINT da imagem
          args: ["server.js", "--port", "3000"]   # substitui o CMD
          ports: [{ containerPort: 3000 }]
          env: [{ name: NODE_ENV, value: production }]
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits: { cpu: 500m, memory: 512Mi }
          volumeMounts: [{ name: data, mountPath: /data }]
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: api-data }
---
apiVersion: v1
kind: Service                          # o papel do -p e do DNS por nome
metadata: { name: api }
spec:
  selector: { app: api }
  ports: [{ port: 8080, targetPort: 3000 }]
```

| Docker | Kubernetes |
| --- | --- |
| `ENTRYPOINT` / `CMD` | `command` / `args` (atenção: os nomes são "trocados") |
| `-e`, `--env-file` | `env`, `envFrom` (ConfigMap, Secret) |
| `-p` | `containerPort` (documental) + **Service** |
| `-v volume:/dir` | `volumes` + `volumeMounts` (PVC, emptyDir, configMap…) |
| `--memory`, `--cpus` | `resources.limits` (+ `requests` para o scheduler) |
| `--restart` | `restartPolicy` do Pod + controllers (Deployment, Job) |
| `HEALTHCHECK` | `readinessProbe`, `livenessProbe`, `startupProbe` (o HEALTHCHECK da imagem é ignorado) |
| `--user`, `--read-only`, `--cap-drop` | `securityContext` |
| Rede definida pelo usuário + DNS | Rede plana do cluster + Services + CoreDNS |
| `docker compose` | Conjunto de manifests (Deployment, Service, PVC, ConfigMap…), Helm, Kustomize |

## Pods: mais de um container, mesmo "host"

Um Pod agrupa containers que compartilham rede (mesmo IP, `localhost` comum) e podem compartilhar volumes — como um "host lógico". Padrões comuns: **sidecar** (proxy, coletor de logs), **init containers** (preparação antes do principal).

## Docker no cluster? Não mais

Desde o Kubernetes 1.24, o **dockershim** foi removido: os nós usam **containerd** ou **CRI-O** diretamente, via CRI (Container Runtime Interface). Suas imagens construídas com Docker continuam funcionando — são imagens **OCI**.

Consequências práticas:

- `docker ps` no nó não mostra os containers do Kubernetes. Use `crictl ps`, `crictl logs`, `crictl images`.
- Para depurar, prefira `kubectl logs`, `kubectl exec` e `kubectl debug`.
- Não monte o socket do Docker em Pods para "fazer build": use builders como BuildKit rootless, Kaniko ou buildah.

## Imagens no cluster

- `imagePullPolicy`: `IfNotPresent` (padrão para tags fixas), `Always` (padrão para `:latest` ou sem tag), `Never`.
- Registries privados: Secret do tipo `kubernetes.io/dockerconfigjson` referenciado em `imagePullSecrets` (ou na ServiceAccount).
- Erros `ErrImagePull`/`ImagePullBackOff`: nome/tag errados, falta de credenciais, limite de pull, arquitetura sem variante.
- Para desenvolvimento local: `kind load docker-image api:dev` ou `minikube image load api:dev` evitam um registry.

## Checklist de "imagem pronta para Kubernetes"

1. Tag imutável (versão ou SHA), nunca `latest` em produção.
2. Processo principal na forma exec, tratando SIGTERM (encerramento gracioso dentro do grace period).
3. Logs em stdout/stderr.
4. Escuta em `0.0.0.0`, porta configurável.
5. Configuração por variáveis de ambiente/arquivos, sem segredos na imagem.
6. Usuário não-root, sistema de arquivos que tolera `readOnlyRootFilesystem`.
7. Endpoints de saúde para as probes.
8. Consumo de memória que respeita o limite do container.
9. Multi-arquitetura, se o cluster tiver nós `arm64`.

Com isso, siga para o módulo **Fundamentos**: o que é o Kubernetes, como o cluster funciona por dentro e como conversar com ele. O simulador desta lição mostra o ciclo de vida de um Pod — o "docker run" do Kubernetes.
