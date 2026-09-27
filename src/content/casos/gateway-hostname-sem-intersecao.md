# Um domínio antigo que o Gateway ignora

## Contexto

A loja comprou a empresa de pagamentos e quer manter a API antiga, `api.pagamentos.com`, funcionando pelo novo Gateway. O time criou uma `HTTPRoute` no namespace `loja` (que já tem acesso ao Gateway) com esse hostname e apontou o DNS para o IP do Gateway. As chamadas falham, enquanto as outras rotas da loja funcionam normalmente.

## Sintomas

```text
$ curl -si https://api.pagamentos.com/v1/status
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to api.pagamentos.com:443

$ curl -si --insecure -H 'Host: api.pagamentos.com' http://203.0.113.10/v1/status | head -1
HTTP/1.1 404 Not Found
```

```yaml
# HTTPRoute legado (namespace loja)
spec:
  parentRefs:
    - name: publico
      namespace: infra
      sectionName: https
  hostnames: ["api.pagamentos.com"]
```

<!-- solucao -->

## Investigação

```text
$ kubectl get httproute legado -n loja -o jsonpath='{.status.parents[0].conditions[0]}'
{"type":"Accepted","status":"False","reason":"NoMatchingListenerHostname",
 "message":"no matching hostnames for this listener"}

$ kubectl get gateway publico -n infra -o jsonpath='{range .spec.listeners[*]}{.name} {.hostname}{"\n"}{end}'
web     *.loja.com
https   *.loja.com
admin   admin.loja.com
```

## Causa raiz

Uma rota só se anexa a um listener se **algum hostname dela intersectar** com o hostname do listener. `api.pagamentos.com` não casa com `*.loja.com` (nem com `admin.loja.com`). A rota foi rejeitada, e o Gateway não tem **certificado** nem listener para esse domínio — por isso o erro de TLS e o 404.

## Correção

O dono do Gateway adiciona um listener (com certificado) para o domínio adquirido:

```yaml
listeners:
  - name: https-pagamentos
    port: 443
    protocol: HTTPS
    hostname: api.pagamentos.com
    tls:
      mode: Terminate
      certificateRefs:
        - name: api-pagamentos-tls
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels: { gateway-access: "true" }
```

E a rota passa a apontar para ele: `sectionName: https-pagamentos` (ou nenhum `sectionName`, para anexar a todos os listeners compatíveis).

## Prevenção

- Hostnames de listener funcionam como **contrato**: quais domínios aquele Gateway atende. Novos domínios passam pelo time de plataforma (e pelo certificado).
- Alerta para rotas com `Accepted=False` há mais de alguns minutos.
- Lembre da semântica: `*.loja.com` cobre `a.loja.com` e `a.b.loja.com`, mas **não** `loja.com` nem outros domínios.

No simulador, a rota **loja/legado** mostra exatamente esse status.
