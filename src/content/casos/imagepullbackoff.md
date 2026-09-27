# ImagePullBackOff só em produção

## Contexto

O time de dados publicou o primeiro serviço que usa uma imagem do **registry privado** da empresa. Em `staging` funcionou de primeira. Em `prod`, o mesmo manifesto não sobe.

## Sintomas

```text
$ kubectl get pods -n prod -l app=ingestor
NAME                        READY   STATUS             RESTARTS   AGE
ingestor-7f6d5c4b3-kq9x2    0/1     ImagePullBackOff   0          6m

$ kubectl describe pod ingestor-7f6d5c4b3-kq9x2 -n prod
Events:
  Normal   Pulling  kubelet  Pulling image "registry.empresa.com/dados/ingestor:1.4.0"
  Warning  Failed   kubelet  Failed to pull image "registry.empresa.com/dados/ingestor:1.4.0":
           failed to authorize: failed to fetch oauth token: unexpected status: 401 Unauthorized
  Warning  Failed   kubelet  Error: ErrImagePull
  Normal   BackOff  kubelet  Back-off pulling image "registry.empresa.com/dados/ingestor:1.4.0"
```

O manifesto referencia `imagePullSecrets: [{name: registry-empresa}]`.

<!-- solucao -->

## Investigação

A mensagem é **401 Unauthorized** — a imagem existe (senão seria `not found` / `manifest unknown`), mas o nó não se autenticou.

```text
$ kubectl get secret registry-empresa -n staging
NAME               TYPE                             DATA   AGE
registry-empresa   kubernetes.io/dockerconfigjson   1      40d

$ kubectl get secret registry-empresa -n prod
Error from server (NotFound): secrets "registry-empresa" not found
```

## Causa raiz

**Secrets são objetos de namespace.** O Secret de credenciais do registry foi criado manualmente em `staging` e nunca em `prod`. Sem o Secret, o kubelet tenta baixar sem credenciais e recebe 401.

## Correção

```bash
kubectl create secret docker-registry registry-empresa -n prod \
  --docker-server=registry.empresa.com \
  --docker-username=robot-pull --docker-password="$TOKEN"

# Opcional: associe à ServiceAccount para não repetir em cada manifesto
kubectl patch serviceaccount default -n prod \
  -p '{"imagePullSecrets":[{"name":"registry-empresa"}]}'
```

O kubelet tenta de novo sozinho (com backoff); para acelerar, apague o Pod.

## Outras causas do mesmo sintoma

| Mensagem | Causa provável |
| --- | --- |
| `manifest unknown` / `not found` | Tag errada ou imagem não publicada |
| `429 Too Many Requests` | Rate limit (ex.: Docker Hub anônimo) — use mirror/proxy cache |
| `x509: certificate signed by unknown authority` | CA do registry interno não confiável no nó |
| `no match for platform in manifest` | Imagem sem a arquitetura do nó (arm64 × amd64) |

## Prevenção

- Credenciais de registry distribuídas por **External Secrets** ou pelo seu GitOps, para todos os namespaces que precisam.
- Um **registry proxy/mirror** interno reduz dependência externa e rate limits.
- Use tags imutáveis (ou digest) e valide no CI que a imagem existe antes do deploy.
