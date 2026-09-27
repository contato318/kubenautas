# Requests, limits e QoS

Cada container pode declarar quanto de CPU e memória precisa (**requests**) e o máximo que pode usar (**limits**).

```yaml
resources:
  requests:
    cpu: 250m        # 0,25 de um core
    memory: 256Mi
  limits:
    memory: 512Mi
```

## Unidades

- **CPU**: `1` = 1 vCPU/core; `500m` = meio core (m = milicores).
- **Memória**: `Mi`, `Gi` (base 2) ou `M`, `G` (base 10). Cuidado: `400m` de memória significa 0,4 **bytes**!

## Requests → agendamento

O **scheduler só olha requests**, não o uso real. Um nó com 4 CPUs "alocáveis" aceita Pods até a soma dos requests chegar a 4, mesmo que estejam ociosos. Se nenhum nó tem espaço, o Pod fica **Pending** com um evento como:

```
0/3 nodes are available: 3 Insufficient cpu.
```

**Use o simulador abaixo** para ver o scheduler encaixando Pods (bin packing) e o que acontece quando o cluster lota.

## Limits → execução

| Recurso | Ao exceder o limit |
|---------|--------------------|
| CPU | **Throttling** — o processo fica mais lento, mas não morre (recurso compressível) |
| Memória | **OOMKilled** — o kernel mata o container (exit code 137) |

> Muitos times **não definem limit de CPU** (evita throttling desnecessário), mas **sempre definem requests** e **limit de memória**.

## Classes de QoS

O Kubernetes classifica cada Pod automaticamente. Quando um nó fica sem memória, o kubelet **despeja** (evict) Pods nesta ordem:

| Classe | Regra | Prioridade de despejo |
|--------|-------|-----------------------|
| `BestEffort` | Nenhum request/limit em nenhum container | Primeiro a sair |
| `Burstable` | Pelo menos um request, mas não Guaranteed | Meio |
| `Guaranteed` | requests == limits para CPU **e** memória em **todos** os containers | Último |

## Governança por namespace

- **LimitRange** — define requests/limits **padrão** e mínimos/máximos por container em um namespace.
- **ResourceQuota** — limita o **total** consumido por um namespace (CPU, memória, número de Pods, PVCs, LoadBalancers…).

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: time-a
  namespace: time-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.memory: 40Gi
    pods: "50"
```

## Como dimensionar

1. Comece com uma estimativa e observe com `kubectl top pods` / Prometheus.
2. Request ≈ uso típico (p50–p90); limit de memória com folga para picos.
3. O **VPA** (Vertical Pod Autoscaler) pode recomendar valores automaticamente.
