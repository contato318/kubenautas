# ServiceAccounts, tokens e identidade de workloads

Toda requisição de um Pod à API do Kubernetes usa a identidade de uma **ServiceAccount**. O token dessa identidade é o alvo número um de quem compromete um container.

## Onde o token mora

Por padrão, todo Pod recebe um token montado em:

```
/var/run/secrets/kubernetes.io/serviceaccount/token
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
/var/run/secrets/kubernetes.io/serviceaccount/namespace
```

Quem tem execução de código no container tem o token — e as permissões da ServiceAccount.

## Tokens legados × tokens projetados

| | Secret `kubernetes.io/service-account-token` (legado) | Token projetado (TokenRequest API) |
| --- | --- | --- |
| Validade | **Não expira** | Curta (padrão ~1 h), renovada pelo kubelet |
| Vinculado a | Nada | Ao **Pod** (e ao nó): invalida quando o Pod é removido |
| Audiência | API server | Configurável (`audience`) |
| Armazenado | Em um Secret no etcd | Emitido sob demanda, não fica em Secret |
| Revogação | Apagar o Secret | Apagar o Pod/ServiceAccount; expiração |

Desde o Kubernetes 1.24, Secrets de token **não são mais criados automaticamente**, e versões recentes marcam e depois invalidam tokens legados não usados. Mas clusters antigos e ferramentas de CI ainda criam esses Secrets à mão — são credenciais eternas.

> Observação: por compatibilidade, o API server pode aceitar tokens projetados montados por até um ano (`--service-account-extend-token-expiration`), registrando o uso "tardio" no audit log. Monitore esse sinal e desligue a extensão quando suas aplicações renovarem tokens corretamente.

## Desligando o que não é usado

A maioria das aplicações não chama a API do Kubernetes. Desligue o token:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata: { name: api, namespace: loja }
automountServiceAccountToken: false
---
spec:
  serviceAccountName: api
  automountServiceAccountToken: false     # no Pod também (tem precedência)
```

E crie uma ServiceAccount **por aplicação**. A `default` de cada namespace não deve ter bindings nem ser usada por workloads.

## Tokens para outros serviços: audiência

Para autenticar num serviço externo (Vault, um banco, outro cluster), use um token com **audiência própria** — o API server o rejeita, e o serviço externo rejeita tokens do API server:

```yaml
volumes:
  - name: vault-token
    projected:
      sources:
        - serviceAccountToken:
            path: token
            audience: vault
            expirationSeconds: 600
```

O serviço valida o token via **OIDC discovery** (`/.well-known/openid-configuration` do issuer do cluster) ou `TokenReview`.

## Identidade na nuvem sem chaves

Nunca coloque chaves de acesso da nuvem em Secrets se o provedor oferece federação:

- **AWS**: IRSA ou EKS Pod Identity — o Pod troca seu token projetado por credenciais temporárias de um papel IAM específico.
- **GCP**: Workload Identity.
- **Azure**: Workload Identity (federated credentials).

Combine com IMDSv2 e hop limit 1 para que os Pods **não** herdem o papel do nó.

## Tokens em pipelines de CI/CD

- Prefira **OIDC do provedor de CI** (GitHub Actions, GitLab) federado com o cluster ou com a nuvem: credenciais de minutos, sem segredo guardado.
- Se precisar de token: `kubectl create token deployer --duration=15m` no início do job, nunca um Secret legado permanente.
- Permissões do deployer restritas aos namespaces e recursos do deploy.
- Cuidado com logs: `set -x`, `--v=9` e mensagens de erro podem imprimir tokens.

## Detectando abuso

- Audit log: uso de tokens de ServiceAccounts a partir de IPs fora do cluster; `authentication.kubernetes.io/legacy-token` e anotações de tokens estendidos.
- Alertas para `create` em `serviceaccounts/token` e em Secrets do tipo service-account-token.
- Inventário: `kubectl get secrets -A --field-selector type=kubernetes.io/service-account-token`.

No simulador, compare um token legado com um projetado e veja o que muda quando ele é roubado.
