# Operator em produção: RBAC, peering, testes e empacotamento

Um operador roda com privilégios, reage a tudo o que acontece com os seus tipos e é dependência de outros times. Em produção, ele precisa de permissões mínimas, alta disponibilidade sem trabalho duplicado, observabilidade e testes.

## Imagem e Deployment

```dockerfile
FROM python:3.12-slim
RUN pip install --no-cache-dir kopf kubernetes
COPY operator.py /app/
USER 1000
CMD ["kopf", "run", "/app/operator.py", "--all-namespaces", "--liveness=http://0.0.0.0:8080/healthz"]
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: db-operator, namespace: db-system }
spec:
  replicas: 2
  strategy: { type: Recreate }       # ou peering (abaixo) para ter réplicas em standby
  template:
    spec:
      serviceAccountName: db-operator
      containers:
        - name: operator
          image: registry.exemplo.com/db-operator:1.4.0
          livenessProbe: { httpGet: { path: /healthz, port: 8080 } }
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 256Mi }
```

## RBAC mínimo

O Kopf precisa de permissões para o **framework** e para a **sua lógica**:

```yaml
# Framework (ClusterRole se usar --all-namespaces)
- apiGroups: [""]
  resources: [namespaces]
  verbs: [list, watch]                    # descobrir namespaces (modo cluster)
- apiGroups: [apiextensions.k8s.io]
  resources: [customresourcedefinitions]
  verbs: [list, watch]                    # acompanhar CRDs em tempo de execução
- apiGroups: [kopf.dev]
  resources: [kopfpeerings, clusterkopfpeerings]
  verbs: [get, list, watch, patch]        # peering
- apiGroups: [""]
  resources: [events]
  verbs: [create]                         # postar eventos
# Seu recurso
- apiGroups: [db.exemplo.com]
  resources: [databases]
  verbs: [list, watch, patch]             # patch: finalizer, anotações de progresso
- apiGroups: [db.exemplo.com]
  resources: [databases/status]
  verbs: [patch]
# O que os handlers criam
- apiGroups: [apps]
  resources: [deployments]
  verbs: [get, list, create, patch]
```

Sintomas de RBAC faltando:

- Sem `list/watch` no seu recurso → o operador sobe e **nada acontece**.
- Sem `patch` → `403` ao adicionar finalizer e gravar progresso.
- Sem permissão nos filhos → o handler falha e tenta de novo para sempre.
- Sem `events: create` → só avisos; `kubectl describe` fica sem eventos.

Teste com `kubectl auth can-i --as=system:serviceaccount:db-system:db-operator patch databases -n loja`.

## Escopo: namespace ou cluster

- `--namespace=loja` (repetível, aceita glob) — permissões com Role por namespace; bom para multi-tenant e para rodar um operador por time.
- `--all-namespaces` — um operador para o cluster todo; exige ClusterRole.

## Alta disponibilidade e peering

Duas réplicas ativas do mesmo operador processam cada evento **duas vezes** — handlers concorrentes, recursos externos duplicados. O **peering** do Kopf resolve: as réplicas se anunciam num objeto `KopfPeering`/`ClusterKopfPeering`, e só a de maior prioridade trabalha; as outras pausam.

```bash
kubectl apply -f https://github.com/nolar/kopf/raw/main/peering.yaml   # CRDs de peering
kopf run operator.py -A --peering=db-operator --priority=100
```

Se os CRDs de peering não existem, o Kopf avisa `Default peering object is not found, falling back to the standalone mode.` — e cada réplica age sozinha. Com `--standalone` isso é explícito. Sem peering, use **uma** réplica com `strategy: Recreate` (e aceite alguns segundos sem operador durante deploys — o modelo level-triggered recupera).

## Observabilidade

- Logs estruturados com o `logger` do handler (inclui namespace/nome do objeto).
- Eventos (`kopf.info/warn`) para o que o usuário do CR precisa ver.
- Condições e `observedGeneration` no status.
- Métricas: exponha um endpoint Prometheus (ex.: `prometheus_client`) com contagem de reconciliações, erros e duração por handler.
- Probe de liveness (`--liveness`) e, se precisar de checagens próprias, `@kopf.on.probe()`.

## Testes

Três níveis:

1. **Unidade** — a lógica dos handlers é Python puro; teste funções que montam manifests e decidem ações, sem cluster.
2. **Integração com cluster efêmero** (kind, k3d) usando o runner do Kopf:

```python
from kopf.testing import KopfRunner

def test_cria_deployment():
    with KopfRunner(['run', '-A', '--verbose', 'operator.py']) as runner:
        subprocess.run("kubectl apply -f exemplos/db.yaml", shell=True, check=True)
        time.sleep(5)   # prefira esperar por uma condição
        subprocess.run("kubectl delete -f exemplos/db.yaml", shell=True, check=True)
    assert runner.exit_code == 0
    assert "Handler 'criar' succeeded" in runner.output
```

3. **Caos** — reinicie o operador no meio de handlers, apague filhos, derrube dependências: o reconcile deve convergir.

## Empacotamento e upgrades

- Distribua CRDs e operador separadamente (CRDs mudam com mais cuidado).
- Versione CRD e operador juntos na documentação: "operador 1.4 requer CRD v1".
- Upgrades do operador devem tolerar objetos criados por versões antigas (campos ausentes, status antigo).
- Documente a desinstalação: CRs primeiro, operador depois, CRD por último.

No simulador, conceda e retire permissões, mude o escopo e rode duas réplicas com e sem peering para ver os logs de cada situação.
