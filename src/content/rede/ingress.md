# Ingress e Gateway API

Um `LoadBalancer` por serviço fica caro e não entende HTTP. O **Ingress** expõe vários Services HTTP/HTTPS através de **um único ponto de entrada**, roteando por **host** e **path**.

```
                      ┌──► Service api   (/api)
Internet ──► Ingress ─┼──► Service web   (/)
   (1 IP)             └──► Service admin (admin.exemplo.com)
```

## Ingress Controller

O objeto `Ingress` é só uma **regra**. Quem a implementa é um **Ingress Controller** que você instala: ingress-nginx, Traefik, HAProxy, AWS ALB Controller, GKE Ingress… Sem controller, o Ingress não faz nada.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: loja
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: nginx
  tls:
    - hosts: [loja.exemplo.com]
      secretName: loja-tls
  rules:
    - host: loja.exemplo.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

- `pathType: Prefix` casa `/api`, `/api/`, `/api/v1`; `Exact` casa só o caminho exato.
- **TLS**: o certificado fica em um Secret do tipo `kubernetes.io/tls`. O **cert-manager** automatiza a emissão e renovação com Let's Encrypt.
- Funcionalidades extras (rewrite, rate limit, auth) normalmente vêm por **annotations** específicas do controller — o que prejudica a portabilidade.

## Gateway API — o sucessor

A **Gateway API** (GA desde 2023) é o novo padrão, mais expressivo e sem depender de annotations. Ela separa responsabilidades por papel:

| Recurso | Quem gerencia | Função |
|---------|---------------|--------|
| `GatewayClass` | Provedor da infra | Qual implementação usar |
| `Gateway` | Operador do cluster | Listeners, portas, TLS |
| `HTTPRoute` / `GRPCRoute` / `TCPRoute` | Time da aplicação | Regras de roteamento |

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
spec:
  parentRefs:
    - name: gateway-publico
  hostnames: ["loja.exemplo.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: api-v1
          port: 80
          weight: 90
        - name: api-v2
          port: 80
          weight: 10      # canary nativo por peso!
```

> Para projetos novos, avalie começar com Gateway API. O Ingress continua suportado e é muito comum em clusters existentes. Observação: o projeto **ingress-nginx** da comunidade anunciou o fim da manutenção — planeje a migração.
