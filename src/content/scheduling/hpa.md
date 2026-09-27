# Autoscaling: HPA, VPA e Cluster Autoscaler

Kubernetes escala em três dimensões:

| Autoscaler | Escala | Baseado em |
|------------|--------|-----------|
| **HPA** — Horizontal Pod Autoscaler | Número de **réplicas** | CPU, memória, métricas customizadas/externas |
| **VPA** — Vertical Pod Autoscaler | **Requests/limits** dos containers | Histórico de uso |
| **Cluster Autoscaler / Karpenter** | Número de **nós** | Pods Pending por falta de recursos |

## HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50     # % do REQUEST de CPU
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

```
kubectl autoscale deployment web --cpu-percent=50 --min=2 --max=10
kubectl get hpa -w
```

### A fórmula

```
réplicasDesejadas = ceil( réplicasAtuais × métricaAtual / métricaAlvo )
```

Exemplo: 3 réplicas a 90% de CPU com alvo de 50% → `ceil(3 × 90/50) = ceil(5,4) = 6` réplicas.

### Pré-requisitos e detalhes

- Precisa do **metrics-server** instalado (ou de um adaptador como o Prometheus Adapter para métricas customizadas).
- A utilização é calculada **em relação ao request**: sem `resources.requests.cpu`, o HPA de CPU não funciona.
- Há uma **tolerância de 10%**: se a razão estiver entre 0,9 e 1,1, nada muda.
- **Scale up** é rápido; **scale down** usa uma janela de estabilização (padrão 5 min) para evitar oscilação (*flapping*).
- Não use HPA e `kubectl scale` manual ao mesmo tempo — e remova `replicas` do manifesto no GitOps, senão os dois brigam.

## KEDA

O **KEDA** (Kubernetes Event-Driven Autoscaling) estende o HPA com dezenas de *scalers*: tamanho de fila no Kafka/RabbitMQ/SQS, consultas Prometheus, cron… e permite **escalar para zero**.

## VPA

Observa o consumo e ajusta requests. Modos `Off` (só recomenda), `Initial` e `Auto`. Não combine VPA e HPA na **mesma métrica** (CPU/memória).

## Cluster Autoscaler e Karpenter

Quando o HPA cria Pods que não cabem em nenhum nó (Pending), o **Cluster Autoscaler** adiciona nós ao grupo; quando nós ficam subutilizados, remove-os. O **Karpenter** (AWS e outros) provisiona nós sob medida e rapidamente, escolhendo o tipo de instância ideal.

**No simulador**: aumente a carga e observe o HPA calcular as réplicas passo a passo.
