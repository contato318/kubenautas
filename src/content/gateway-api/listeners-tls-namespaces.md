# Listeners, TLS e rotas entre namespaces

Um `Gateway` compartilhado por vários times precisa de regras claras: **em quais portas escuta**, **com quais certificados** e **quem pode anexar rotas**. É aqui que a Gateway API brilha em relação ao Ingress.

## Listeners

Cada listener é uma combinação de **porta + protocolo + hostname** (opcional):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: publico
  namespace: infra
spec:
  gatewayClassName: envoy
  listeners:
    - name: web
      port: 80
      protocol: HTTP
      hostname: "*.loja.com"
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              gateway-access: "true"
    - name: https
      port: 443
      protocol: HTTPS
      hostname: "*.loja.com"
      tls:
        mode: Terminate
        certificateRefs:
          - name: loja-wildcard-tls
```

## Hostnames: a interseção

Listener e rota podem ter hostnames. A rota só é aceita naquele listener se **pelo menos um** hostname dela **intersectar** com o do listener:

| Listener | Rota | Resultado |
| --- | --- | --- |
| `*.loja.com` | `api.loja.com` | Casa |
| `*.loja.com` | `a.b.loja.com` | Casa — na Gateway API o curinga casa **um ou mais** rótulos |
| `*.loja.com` | `loja.com` | Não casa |
| `*.loja.com` | `api.pagamentos.com` | Não casa → `Accepted: False`, motivo `NoMatchingListenerHostname` |
| (vazio) | qualquer | Casa |

Atenção à diferença: no **Ingress**, `*.loja.com` casa um **único** rótulo; na **Gateway API**, é um sufixo.

## allowedRoutes: quem pode se anexar

O dono do Gateway controla quais namespaces podem anexar rotas em cada listener:

| `namespaces.from` | Quem pode anexar |
| --- | --- |
| `Same` (padrão) | Só rotas do **mesmo namespace** do Gateway |
| `All` | Rotas de qualquer namespace |
| `Selector` | Namespaces com os labels do `selector` |

Uma rota rejeitada aparece com `Accepted: False` e motivo **`NotAllowedByListeners`**. Com o padrão `Same`, um Gateway no namespace `infra` recusa todas as rotas dos times — uma surpresa comum na primeira instalação.

Também é possível restringir os **tipos** de rota (`allowedRoutes.kinds`), por exemplo aceitar só `HTTPRoute` num listener HTTP.

## TLS

- `mode: Terminate`: o Gateway termina o TLS com o certificado de `certificateRefs` (um Secret `kubernetes.io/tls`) e fala com o backend em HTTP.
- `mode: Passthrough`: o Gateway só encaminha os bytes criptografados, roteando pelo SNI — usado com `TLSRoute` (canal experimental).
- **cert-manager** consegue emitir certificados diretamente para os listeners do Gateway.
- Redirecionamento HTTP → HTTPS é uma HTTPRoute no listener HTTP com o filtro `RequestRedirect` (`scheme: https`).

## ReferenceGrant: confiança explícita entre namespaces

Por segurança, um recurso **não pode referenciar** outro de um namespace diferente sem autorização do dono do destino. Exemplos que exigem `ReferenceGrant`:

- Uma HTTPRoute em `loja` com `backendRef` para um Service em `pagamentos`.
- Um Gateway em `infra` usando um Secret de certificado em `certificados`.

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: permitir-rotas-da-loja
  namespace: pagamentos          # criado no namespace do RECURSO REFERENCIADO
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: loja
  to:
    - group: ""
      kind: Service
```

Sem ele, a rota fica com `ResolvedRefs: False` (motivo `RefNotPermitted`) e as requisições para aquele backend recebem **500**.

## Checklist de diagnóstico

```bash
kubectl get gateway publico -n infra                 # PROGRAMMED deve ser True
kubectl describe gateway publico -n infra            # rotas anexadas por listener
kubectl get httproute -A                             # hostnames e parents
kubectl get httproute api -n loja -o jsonpath='{.status.parents[*].conditions}'
```

Leia sempre as **condições**: elas dizem se o problema é anexação (`Accepted`) ou referência (`ResolvedRefs`).
