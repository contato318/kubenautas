# A cada pico de tráfego, todos os Pods reiniciam

## Contexto

A `busca` aguenta bem o tráfego normal. Em todo pico (campanhas, fim de mês), os Pods começam a reiniciar em cascata, a capacidade despenca e o site fica fora por minutos. Os logs não mostram nenhum erro antes dos reinícios.

## Sintomas

```text
$ kubectl get pods -n busca
NAME                     READY   STATUS    RESTARTS        AGE
busca-6b8f7d9c5-2xk4p    1/1     Running   9 (2m ago)      3h
busca-6b8f7d9c5-8qz1m    0/1     Running   11 (40s ago)    3h

$ kubectl describe pod busca-6b8f7d9c5-2xk4p -n busca
  Warning  Unhealthy  kubelet  Liveness probe failed: Get "http://10.244.2.9:8080/health": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
  Normal   Killing    kubelet  Container busca failed liveness probe, will be restarted
```

```yaml
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5
  timeoutSeconds: 1        # padrão
  failureThreshold: 3
```

<!-- solucao -->

## Investigação

`Last State` mostra `Error` com exit code **137** e eventos `Killing … failed liveness probe` — o container **não crashou**: foi morto pelo kubelet. O endpoint `/health` é servido pelo mesmo pool de threads que atende as buscas; sob carga, ele leva 2–3 s para responder.

## Causa raiz

A liveness com `timeoutSeconds: 1` falha quando a aplicação está **ocupada**, não quando está **quebrada**. O kubelet reinicia o Pod; a carga vai para os Pods restantes, que ficam ainda mais lentos, falham a liveness e reiniciam também: uma **cascata** provocada pela própria probe.

## Correção

```yaml
livenessProbe:
  httpGet: { path: /livez, port: 8081 }   # endpoint leve, em porta/pool separado
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 6                      # ~1 minuto sem resposta antes de reiniciar
readinessProbe:
  httpGet: { path: /ready, port: 8080 }
  periodSeconds: 5
  timeoutSeconds: 3
```

A liveness responde "o processo está vivo e não travou" — não "estou respondendo rápido". Lentidão é trabalho da **readiness** (tirar do tráfego) e do **HPA** (adicionar capacidade).

## Prevenção

- Liveness conservadora, em endpoint barato, sem dependências externas.
- Alerta de reinícios (`increase(kube_pod_container_status_restarts_total[15m]) > 3`).
- Teste de carga que inclua as probes.
