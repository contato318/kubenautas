# ReplicaSets e Deployments

## ReplicaSet

Um **ReplicaSet** garante que um número exato de Pods idênticos esteja rodando. Ele usa um **selector** para contar os Pods que são "dele" e um **template** para criar novos quando faltam.

Você quase nunca cria ReplicaSets diretamente. Quem os cria é o…

## Deployment

O **Deployment** é o controlador mais usado para aplicações **stateless**. Ele gerencia ReplicaSets e adiciona:

- **Rolling updates** — troca de versão gradual;
- **Rollback** — histórico de revisões;
- **Pause/resume** de rollouts;
- **Escalonamento** declarativo.

```
Deployment (web)
   └── ReplicaSet (web-7d9c8b)   ← revisão atual, 3 réplicas
         ├── Pod web-7d9c8b-abcde
         ├── Pod web-7d9c8b-fghij
         └── Pod web-7d9c8b-klmno
   └── ReplicaSet (web-5f4a21)   ← revisão antiga, 0 réplicas (mantido para rollback)
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web          # PRECISA bater com o selector
    spec:
      containers:
        - name: web
          image: nginx:1.27
```

> O `selector` de um Deployment é **imutável** depois de criado.

## Self-healing na prática

O ReplicaSet controller compara: *"quantos Pods com `app=web` existem?"* com *"quantos eu quero?"*.

- Pod deletado → faltam Pods → cria um novo.
- Nó morreu → após o timeout, os Pods daquele nó são marcados para remoção e recriados em outros nós.
- Você cria manualmente um Pod com o label `app=web` → sobram Pods → o ReplicaSet **deleta** um!

**Use o simulador abaixo**: mate Pods, derrube um nó e mude o número de réplicas. Observe o controlador reagir.

## Escalando

```
kubectl scale deployment web --replicas=5
# ou edite spec.replicas no YAML e rode kubectl apply
```

Para escalonamento automático por métricas, veja a lição de **HPA**.

## Nomes dos Pods

`web-7d9c8b-abcde` = nome do Deployment + **hash do template** (`pod-template-hash`) + sufixo aleatório. Mudou o template (imagem, env, etc.)? Novo hash → novo ReplicaSet → rollout.
