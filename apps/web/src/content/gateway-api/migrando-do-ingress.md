# Migrando do Ingress para a Gateway API

Com o fim da manutenção do projeto **ingress-nginx** da comunidade, muitos clusters estão migrando. A boa notícia: as duas APIs convivem no mesmo cluster, e a migração pode ser feita **serviço a serviço**, sem janela de indisponibilidade.

## O mapa entre os conceitos

| Ingress | Gateway API |
| --- | --- |
| `IngressClass` | `GatewayClass` |
| O controller + seu Service LoadBalancer | `Gateway` (listeners, portas, endereço) |
| `spec.tls` (Secret por Ingress) | `listeners[].tls.certificateRefs` no Gateway |
| `rules[].host` | `HTTPRoute.spec.hostnames` |
| `paths[]` com `Prefix`/`Exact` | `rules[].matches[].path` com `PathPrefix`/`Exact` |
| `defaultBackend` | Uma regra sem matches (casa com tudo) ou rota "catch-all" |
| Annotation de canary | `backendRefs[].weight` |
| Annotation de rewrite | Filtro `URLRewrite` |
| Annotation de redirect / force-ssl | Filtro `RequestRedirect` |
| Annotation de headers | Filtros `RequestHeaderModifier` / `ResponseHeaderModifier` |
| Annotation de timeout | `rules[].timeouts` |

Annotations que não têm equivalente (autenticação externa, rate limit, WAF) costumam virar **políticas** específicas da implementação (o padrão *Policy Attachment*), como `SecurityPolicy` e `BackendTrafficPolicy` no Envoy Gateway.

## Ferramenta: ingress2gateway

O projeto oficial **ingress2gateway** lê seus Ingresses (do cluster ou de arquivos) e gera Gateways e HTTPRoutes equivalentes, entendendo as annotations de controllers populares:

```bash
ingress2gateway print --providers=ingress-nginx --all-namespaces > gateway-api.yaml
```

Revise sempre o resultado: annotations sem equivalente aparecem como aviso e precisam de decisão humana.

## Estratégia de migração sem downtime

1. **Instale** as CRDs e a implementação escolhida. Ela ganha seu próprio endereço (IP/LB).
2. **Crie o Gateway** com os listeners e certificados, e o `allowedRoutes` adequado para os namespaces dos times.
3. **Traduza** um serviço por vez para HTTPRoute. O Ingress antigo continua servindo.
4. **Teste pelo novo endereço** sem mexer no DNS público: `curl --resolve www.loja.com:443:<IP-do-gateway> https://www.loja.com/`.
5. **Vire o DNS** do hostname para o endereço do Gateway (TTL baixo antes, para voltar rápido se preciso).
6. **Observe** erros e latência; só então apague o Ingress antigo.
7. Quando não restar Ingress, desinstale o controller antigo.

## Armadilhas comuns

- **Curingas diferentes**: `*.loja.com` casa vários rótulos na Gateway API e um só no Ingress.
- **Regex de path**: `RegularExpression` é extensão opcional; a sintaxe varia entre implementações. Prefira `PathPrefix` + `URLRewrite` quando possível.
- **allowedRoutes padrão `Same`**: rotas dos times são rejeitadas até o Gateway liberar os namespaces.
- **Backends em outro namespace** exigem `ReferenceGrant`.
- **Comportamentos implícitos do controller antigo** (redirecionamento automático para HTTPS, tamanho máximo de corpo, timeouts padrão) precisam virar configuração explícita.

## Além do tráfego norte-sul

A iniciativa **GAMMA** usa a mesma HTTPRoute para tráfego **leste-oeste** em service meshes: em vez de `parentRefs` para um Gateway, a rota referencia um **Service**, e o mesh aplica as regras (pesos, filtros, timeouts) nas chamadas entre serviços. É o mesmo vocabulário para dentro e para fora do cluster.
