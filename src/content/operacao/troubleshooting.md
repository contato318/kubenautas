# Troubleshooting

## O fluxo de investigação

```
kubectl get pods                    →  qual é o STATUS?
kubectl describe pod <pod>          →  leia os EVENTS no final
kubectl logs <pod> [--previous]     →  o que a aplicação disse?
kubectl get events --sort-by=.lastTimestamp
kubectl exec -it <pod> -- sh        →  investigue por dentro
kubectl debug -it <pod> --image=busybox --target=<container>   →  container efêmero
```

## Guia de status

### Pending
O Pod não foi agendado.
- `Insufficient cpu/memory` → requests maiores do que o espaço livre. Reduza requests ou adicione nós.
- `node(s) had untolerated taint` → falta toleration.
- `didn't match Pod's node affinity/selector` → labels de nó errados.
- `pod has unbound immediate PersistentVolumeClaims` → PVC sem PV/StorageClass.

### ContainerCreating (por muito tempo)
- Volume não consegue ser montado (disco preso em outro nó, Secret/ConfigMap inexistente).
- Problema no CNI (sem IP disponível).

### ImagePullBackOff / ErrImagePull
- Nome ou **tag errados** (`ngnix:1.27`, `latest` inexistente).
- Registry privado sem `imagePullSecrets`.
- Rate limit do Docker Hub.

### CrashLoopBackOff
O container inicia e **morre repetidamente**; o kubelet espera cada vez mais entre tentativas.
- Veja `kubectl logs <pod> --previous` — o erro da execução anterior.
- Causas comuns: variável de ambiente/config faltando, não consegue conectar no banco, comando/entrypoint errado, **liveness probe** matando a app antes de ela subir.
- Exit code no `describe`: `1` = erro da app; `137` = SIGKILL (geralmente OOM); `139` = segfault; `143` = SIGTERM.

### OOMKilled
Estourou o **limit de memória**. Aumente o limit, investigue vazamento, ou ajuste a heap (ex.: JVM `-XX:MaxRAMPercentage`).

### Running mas não funciona
- `READY 0/1` → **readiness probe** falhando → sem tráfego.
- Service sem endpoints → **selector** não bate com os labels.
- `targetPort` errado; app escutando só em `localhost`.
- NetworkPolicy bloqueando; DNS errado (namespace diferente).

### Terminating (para sempre)
- **Finalizers** pendentes (`kubectl get pod x -o jsonpath='{.metadata.finalizers}'`).
- Nó inacessível. Só force (`--grace-period=0 --force`) quando entender a causa.

## Nó com problema

```
kubectl get nodes
kubectl describe node worker-2      # Conditions: MemoryPressure, DiskPressure, PIDPressure, Ready
kubectl top nodes
kubectl cordon worker-2             # impede novos Pods
kubectl drain worker-2 --ignore-daemonsets --delete-emptydir-data   # esvazia para manutenção
kubectl uncordon worker-2
```

## Ferramentas que ajudam

- **k9s** — interface de terminal para navegar no cluster.
- **stern** — logs de vários Pods ao mesmo tempo.
- **kubectx / kubens** — alternar contexto e namespace.
- **Prometheus + Grafana**, **Loki**, **OpenTelemetry** — observabilidade.

**No simulador de ciclo de vida** você pode provocar cada um desses estados e ver como o Kubernetes reage.
