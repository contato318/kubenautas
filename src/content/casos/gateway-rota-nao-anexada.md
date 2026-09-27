# HTTPRoute criada, mas o site responde 404

## Contexto

A plataforma instalou o **Envoy Gateway** e criou um `Gateway` compartilhado no namespace `infra`. O time da loja fez seu primeiro deploy com Gateway API: criou a `HTTPRoute` no namespace `loja`, apontando para o Gateway. O `kubectl apply` não deu erro — mas `https://www.loja.com` responde **404** para todo mundo.

## Sintomas

```text
$ kubectl get gateway publico -n infra
NAME      CLASS   ADDRESS        PROGRAMMED   AGE
publico   envoy   203.0.113.10   True         2d

$ kubectl get httproute -n loja
NAME      HOSTNAMES          AGE
vitrine   ["www.loja.com"]   25m

$ curl -si https://www.loja.com/ | head -1
HTTP/2 404
```

O Gateway está `Programmed`, a rota existe e o Service `vitrine` tem endpoints.

<!-- solucao -->

## Investigação

`kubectl apply` só valida o formato. Se a rota foi **aceita** pelo Gateway, isso aparece no **status** dela:

```text
$ kubectl get httproute vitrine -n loja -o yaml
status:
  parents:
    - parentRef: { name: publico, namespace: infra }
      conditions:
        - type: Accepted
          status: "False"
          reason: NotAllowedByListeners
          message: No listeners included by this parent ref allowed this attachment.
```

E no Gateway:

```text
$ kubectl get gateway publico -n infra -o jsonpath='{.spec.listeners[*].allowedRoutes}'
{"namespaces":{"from":"Same"}}
```

## Causa raiz

O Gateway foi criado com o **padrão** `allowedRoutes.namespaces.from: Same`: só aceita rotas do próprio namespace `infra`. A rota de `loja` nunca foi anexada, então o listener não tem regra para `www.loja.com` e responde 404.

## Correção

O dono do Gateway libera os namespaces dos times — de preferência por label, não com `All`:

```yaml
listeners:
  - name: https
    port: 443
    protocol: HTTPS
    hostname: "*.loja.com"
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            gateway-access: "true"
```

```bash
kubectl label namespace loja gateway-access=true
kubectl get httproute vitrine -n loja -o jsonpath='{.status.parents[0].conditions[?(@.type=="Accepted")].status}'
# True
```

## Prevenção

- Padronize `allowedRoutes` por label e documente como um time pede acesso ao Gateway.
- No pipeline de deploy, falhe se a rota não ficar `Accepted=True` e `ResolvedRefs=True` em até alguns segundos.
- Use `kubectl describe gateway` para ver quantas rotas estão anexadas a cada listener.

Reproduza no simulador de Gateway API trocando `allowedRoutes` para **Same**.
