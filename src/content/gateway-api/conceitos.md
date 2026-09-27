# Gateway API: conceitos e papéis

A **Gateway API** é o padrão oficial do Kubernetes para expor tráfego de rede — o sucessor do Ingress. É um conjunto de CRDs mantido pelo SIG Network, com APIs principais em **GA (v1)** desde a versão 1.0, em 2023.

## Por que um substituto para o Ingress?

O Ingress resolveu o básico (host + path → Service), mas parou aí. Tudo que ia além disso — canary por peso, reescrita de URL, headers, timeouts, TCP/UDP — virou **annotation específica de cada controller**:

```yaml
# Funciona só no ingress-nginx; outro controller ignora ou interpreta diferente
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
```

Problemas: manifestos **não portáveis**, sem validação (um erro de digitação em annotation é silenciosamente ignorado) e **um único objeto** mistura o que é do time de plataforma (TLS, IP, porta) com o que é do time da aplicação (rotas).

A Gateway API traz esses recursos **para a especificação**, com campos tipados e validados, e divide a configuração por **papel**.

## O modelo orientado a papéis

```
 Provedor de infra        Operador do cluster          Time da aplicação
 ─────────────────        ───────────────────          ─────────────────
   GatewayClass    ◄───      Gateway           ◄───     HTTPRoute
 "qual implementação"   "listeners, portas, TLS,     "hosts, paths, filtros,
                          quem pode se anexar"        backends e pesos"
```

| Recurso | Escopo | Quem gerencia | Para quê |
| --- | --- | --- | --- |
| `GatewayClass` | Cluster | Provedor/plataforma | Aponta para o controller (ex.: Envoy Gateway, Istio, Cilium) |
| `Gateway` | Namespace | Operador do cluster | Instância de load balancer: listeners, portas, protocolos, certificados |
| `HTTPRoute` | Namespace | Time da aplicação | Regras de roteamento HTTP até os Services |
| `GRPCRoute` | Namespace | Time da aplicação | Roteamento por serviço/método gRPC |
| `ReferenceGrant` | Namespace | Dono do recurso referenciado | Autoriza referências **entre namespaces** |

Também existem `TLSRoute`, `TCPRoute` e `UDPRoute`, ainda no canal **experimental**.

Esse modelo casa com o RBAC: o time da aplicação recebe permissão para criar `HTTPRoute` no próprio namespace, mas **não** para mexer no `Gateway` compartilhado nem nos certificados.

## Um exemplo mínimo

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: envoy
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: publico
  namespace: infra
spec:
  gatewayClassName: envoy
  listeners:
    - name: web
      protocol: HTTP
      port: 80
      hostname: "*.loja.com"
      allowedRoutes:
        namespaces:
          from: All
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: vitrine
  namespace: loja
spec:
  parentRefs:
    - name: publico
      namespace: infra
  hostnames: ["www.loja.com"]
  rules:
    - backendRefs:
        - name: vitrine
          port: 80
```

A rota se **anexa** ao Gateway pelo `parentRefs`. O Gateway decide, pelo `allowedRoutes`, se aceita ou não.

## Status: a API conta o que aconteceu

Diferente do Ingress, os recursos da Gateway API têm **condições de status** padronizadas. É a primeira coisa a olhar quando algo não funciona:

```text
$ kubectl get httproute vitrine -n loja -o yaml
status:
  parents:
    - parentRef: { name: publico, namespace: infra }
      conditions:
        - type: Accepted        # o Gateway aceitou a rota?
          status: "True"
        - type: ResolvedRefs    # todos os backends foram encontrados e autorizados?
          status: "True"
```

| Condição | Recurso | Significado |
| --- | --- | --- |
| `Accepted` | GatewayClass, Gateway, Route | A configuração é válida e foi aceita pelo controller |
| `Programmed` | Gateway | O data plane foi configurado e tem endereço |
| `ResolvedRefs` | Route, listener | Referências (backends, certificados) existem e são permitidas |

## Implementações

Você precisa instalar um controller — e, normalmente, as **CRDs** do canal standard:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/<versão>/standard-install.yaml
```

Implementações conhecidas: **Envoy Gateway**, **Istio**, **Cilium**, **NGINX Gateway Fabric**, **Kong**, **Traefik**, **Contour** e os controllers gerenciados das nuvens (GKE, AWS, Azure). O projeto mantém testes de conformidade: prefira implementações que passam na versão que você usa.

> Canal **standard** = APIs estáveis e com garantia de compatibilidade. Canal **experimental** = recursos novos que ainda podem mudar. Em produção, prefira o standard.
