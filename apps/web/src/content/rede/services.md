# Services

Pods são efêmeros e seus IPs mudam. O **Service** fornece um **ponto de acesso estável** (IP virtual + nome DNS) para um conjunto dinâmico de Pods, selecionados por **labels**, e balanceia o tráfego entre eles.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web            # manda tráfego para Pods com esse label
  ports:
    - port: 80          # porta do Service
      targetPort: 8080  # porta do container
```

## Como funciona por baixo

1. O **EndpointSlice controller** observa Pods que batem com o `selector` **e estão Ready** e mantém a lista de IPs:porta.
2. O **kube-proxy** em cada nó programa regras (iptables/IPVS) que traduzem `ClusterIP:80` → um dos IPs de Pod.
3. O **CoreDNS** resolve `web` (ou `web.default.svc.cluster.local`) para o ClusterIP.

```
kubectl get endpointslices -l kubernetes.io/service-name=web
```

> Um Pod que falha na **readinessProbe** é **removido dos endpoints** — ele continua rodando, só não recebe tráfego. Teste isso no simulador!

## Tipos de Service

| Tipo | Acessível de | Uso |
|------|-------------|-----|
| `ClusterIP` (padrão) | Somente dentro do cluster | Comunicação entre microsserviços |
| `NodePort` | `<IP-de-qualquer-nó>:30000-32767` | Testes, ambientes sem LB |
| `LoadBalancer` | IP externo provisionado pela nuvem | Expor serviço TCP/UDP publicamente |
| `ExternalName` | — (retorna um CNAME) | Apelido para um host externo (`db.empresa.com`) |

Cada tipo é um superconjunto do anterior: um `LoadBalancer` também tem NodePort e ClusterIP.

## Headless Service

Com `clusterIP: None` não há IP virtual nem balanceamento: o DNS retorna **os IPs de todos os Pods**. Usado por StatefulSets e clientes que fazem o próprio balanceamento (ex.: drivers de banco).

## Balanceamento

O kube-proxy em modo iptables escolhe um backend **aleatoriamente** por conexão (no simulador usamos round-robin para ficar mais visual). Atenção: conexões **HTTP/2 e gRPC são persistentes**, então o balanceamento L4 pode concentrar carga em um Pod — nesses casos use um balanceador L7 ou service mesh.

- `sessionAffinity: ClientIP` — mantém um cliente no mesmo Pod.
- `internalTrafficPolicy` / `externalTrafficPolicy: Local` — prefere Pods no mesmo nó (preserva o IP de origem).

## Comandos

```
kubectl expose deployment web --port=80 --target-port=8080
kubectl get svc
kubectl port-forward svc/web 8080:80
kubectl run curl --image=curlimages/curl -it --rm -- curl http://web
```

## Debug: "meu Service não responde"

1. `kubectl get endpointslices` — está vazio? Então o **selector não bate** com os labels dos Pods ou os Pods **não estão Ready**.
2. `targetPort` corresponde à porta em que o container realmente escuta?
3. A aplicação escuta em `0.0.0.0` e não em `127.0.0.1`?
4. Existe alguma **NetworkPolicy** bloqueando?
