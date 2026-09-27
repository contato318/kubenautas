# Rolling updates e rollback

Quando você altera o **template** de um Deployment (por exemplo, a imagem), ele inicia um **rollout**: cria um novo ReplicaSet e vai transferindo réplicas do antigo para o novo.

```
kubectl set image deployment/web web=nginx:1.28
kubectl rollout status deployment/web
```

## Estratégias

### RollingUpdate (padrão)

Substitui Pods gradualmente, controlado por dois parâmetros:

| Parâmetro | Significado | Padrão |
|-----------|-------------|--------|
| `maxSurge` | Quantos Pods **a mais** que `replicas` podem existir durante o rollout | 25% |
| `maxUnavailable` | Quantos Pods **abaixo** de `replicas` podem ficar indisponíveis | 25% |

```yaml
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

- `maxSurge: 1, maxUnavailable: 0` → mais seguro: sobe 1 novo, espera ficar **Ready**, derruba 1 antigo. Precisa de capacidade extra.
- `maxSurge: 0, maxUnavailable: 1` → não precisa de capacidade extra, mas opera com uma réplica a menos.
- Os dois não podem ser 0 ao mesmo tempo (o rollout não sairia do lugar).

### Recreate

Derruba **todos** os Pods antigos antes de subir os novos. Causa downtime, mas é necessário quando duas versões não podem coexistir (ex.: migração de schema incompatível, volume `ReadWriteOnce`).

## Readiness é o que torna o rollout seguro

O Deployment só considera um Pod novo "disponível" quando ele passa na **readinessProbe** (e fica pronto por `minReadySeconds`). Sem readiness probe, o Kubernetes assume que o container está pronto assim que inicia — e pode mandar tráfego para uma aplicação que ainda está carregando.

Se a nova versão nunca fica pronta (imagem inexistente, crash no boot), o rollout **trava** e, com `maxUnavailable: 0`, as réplicas antigas continuam servindo. Após `progressDeadlineSeconds` (padrão 600s) o Deployment é marcado com `ProgressDeadlineExceeded`.

## Rollback

```
kubectl rollout history deployment/web
kubectl rollout undo deployment/web                 # volta para a revisão anterior
kubectl rollout undo deployment/web --to-revision=2
kubectl rollout pause deployment/web
kubectl rollout resume deployment/web
kubectl rollout restart deployment/web              # recria os Pods sem mudar a imagem
```

O rollback funciona porque os ReplicaSets antigos são mantidos (com 0 réplicas), até o limite de `revisionHistoryLimit`.

## Além do nativo: Blue/Green e Canary

- **Blue/Green** — dois Deployments completos; troca-se o `selector` do Service de uma vez.
- **Canary** — uma pequena fração do tráfego vai para a nova versão; aumenta-se gradualmente. Ferramentas: **Argo Rollouts**, **Flagger**, service meshes (Istio, Linkerd).

**No simulador**: faça um rollout para `v2`, depois tente a imagem quebrada `v3-bug` e veja o rollout travar. Em seguida, faça o rollback.
