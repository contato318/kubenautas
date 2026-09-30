# Roteamento com HTTPRoute

A `HTTPRoute` é onde o time da aplicação passa a maior parte do tempo. Ela diz: **para estes hostnames, requisições que casam com estas condições vão para estes backends, depois destes filtros**.

## Anatomia

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
  namespace: loja
spec:
  parentRefs:
    - name: publico
      namespace: infra
      sectionName: web          # opcional: anexa só ao listener "web"
  hostnames: ["api.loja.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /v2 }
          headers:
            - name: x-canary
              value: "true"
      backendRefs:
        - name: api-v2
          port: 8080
    - matches:
        - path: { type: PathPrefix, value: / }
      backendRefs:
        - name: api-v1
          port: 8080
          weight: 90
        - name: api-v2
          port: 8080
          weight: 10
```

## Matches

Cada regra pode ter vários `matches` (OU entre eles). Dentro de um match, todas as condições precisam casar (E):

| Condição | Tipos | Exemplo |
| --- | --- | --- |
| `path` | `PathPrefix`, `Exact`, `RegularExpression` (depende da implementação) | `/api`, `/login` |
| `headers` | `Exact`, `RegularExpression` | `x-canary: "true"` |
| `queryParams` | `Exact`, `RegularExpression` | `?versao=beta` |
| `method` | — | `POST` |

`PathPrefix` compara por **elementos do caminho**: `/api` casa com `/api` e `/api/v1`, mas **não** com `/apis`. Sem `matches`, a regra casa com tudo (`PathPrefix /`).

## Precedência: qual regra vence?

Quando várias regras casam com a mesma requisição, a especificação define a ordem — não importa a ordem em que você escreveu:

1. Path `Exact` vence `PathPrefix`.
2. Entre prefixos, o **mais longo** vence.
3. Match com **método** vence match sem método.
4. Mais **headers** casados vence menos.
5. Mais **query params** casados vence menos.
6. Empate: a rota **mais antiga** e, depois, a ordem alfabética de `namespace/nome`.

No exemplo acima, `GET /v2/pedidos` com `x-canary: true` cai na primeira regra (prefixo `/v2` é mais longo que `/`). Sem o header, a primeira regra não casa e a segunda divide o tráfego 90/10.

## Divisão de tráfego (canary e blue/green)

O campo `weight` em `backendRefs` divide as requisições **proporcionalmente**: pesos 90 e 10 mandam ~10% para a v2. Pesos não precisam somar 100 — `9` e `1` dão o mesmo resultado. Peso `0` tira o backend do tráfego sem apagar a configuração.

Um canary típico evolui assim: `100/0 → 95/5 → 75/25 → 50/50 → 0/100`, observando erros e latência a cada passo. Ferramentas como **Argo Rollouts** e **Flagger** automatizam isso ajustando os pesos da HTTPRoute.

## Filtros

Filtros modificam a requisição ou a resposta. Eles podem ficar na regra (valem para todos os backends) ou em um `backendRef` específico:

| Filtro | Para quê |
| --- | --- |
| `RequestHeaderModifier` | Adicionar, trocar ou remover headers da requisição |
| `ResponseHeaderModifier` | O mesmo na resposta |
| `RequestRedirect` | Responder 301/302 (ex.: HTTP → HTTPS, mudança de caminho) |
| `URLRewrite` | Reescrever host ou path antes de enviar ao backend |
| `RequestMirror` | Copiar o tráfego para outro backend (as respostas são descartadas) |

```yaml
rules:
  - matches:
      - path: { type: PathPrefix, value: /promo }
    filters:
      - type: RequestRedirect
        requestRedirect:
          path: { type: ReplacePrefixMatch, replacePrefixMatch: /ofertas }
          statusCode: 301
```

Uma regra com `RequestRedirect` não precisa de `backendRefs`: o Gateway responde direto.

## Timeouts

```yaml
rules:
  - backendRefs: [{ name: relatorios, port: 80 }]
    timeouts:
      request: 30s          # tempo total da requisição
      backendRequest: 10s   # cada tentativa ao backend
```

## E se algo estiver errado?

- Backend inexistente ou não autorizado: a condição `ResolvedRefs` fica `False` e as requisições que iriam para ele recebem **HTTP 500**.
- Nenhuma regra casa: o Gateway responde **404**.

Experimente tudo isso no simulador abaixo.
