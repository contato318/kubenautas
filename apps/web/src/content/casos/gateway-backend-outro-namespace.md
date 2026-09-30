# Checkout respondendo 500 depois da migração

## Contexto

Na migração do Ingress para a Gateway API, o time de pagamentos manteve a arquitetura antiga: a rota pública fica no namespace `pagamentos`, mas o serviço que processa os pedidos roda no namespace `pagamentos-core`, isolado por segurança. Depois de virar o DNS, **100% das requisições** para `pay.loja.com` recebem **500**.

## Sintomas

```text
$ curl -si https://pay.loja.com/ | head -1
HTTP/2 500

$ kubectl get httproute checkout -n pagamentos -o yaml
spec:
  hostnames: ["pay.loja.com"]
  rules:
    - backendRefs:
        - name: checkout
          namespace: pagamentos-core
          port: 80
status:
  parents:
    - conditions:
        - type: Accepted
          status: "True"
```

A rota foi **aceita** pelo Gateway. O Service `checkout` existe em `pagamentos-core` e tem endpoints.

<!-- solucao -->

## Investigação

`Accepted=True` diz que a rota se anexou ao Gateway. Mas existe uma segunda condição, sobre as **referências**:

```text
$ kubectl get httproute checkout -n pagamentos \
    -o jsonpath='{.status.parents[0].conditions[?(@.type=="ResolvedRefs")]}'
{"type":"ResolvedRefs","status":"False","reason":"RefNotPermitted",
 "message":"backendRef checkout/pagamentos-core not permitted by any ReferenceGrant"}

$ kubectl get referencegrant -n pagamentos-core
No resources found in pagamentos-core namespace.
```

## Causa raiz

Na Gateway API, uma rota **não pode** usar um backend de outro namespace sem que o dono daquele namespace autorize explicitamente, com um **ReferenceGrant**. Sem ele, o backend é considerado inválido e a especificação manda responder **500** para o tráfego que iria para ele. No Ingress isso nem era possível (backends só no mesmo namespace), então a necessidade passou despercebida na migração.

## Correção

Criado pelo time dono de `pagamentos-core`:

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: rotas-de-pagamentos
  namespace: pagamentos-core
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: pagamentos
  to:
    - group: ""
      kind: Service
      name: checkout          # opcional: restringe a um Service específico
```

## Prevenção

- Inclua `ResolvedRefs=True` no critério de sucesso do deploy, não só `Accepted`.
- Liste as dependências entre namespaces no plano de migração; cada uma vira um ReferenceGrant revisado pelo dono do destino.
- Restrinja o ReferenceGrant ao **nome** do Service quando possível.

No simulador de Gateway API: com allowedRoutes **All**, o checkout é aceito mas responde 500 até você ligar o ReferenceGrant.
