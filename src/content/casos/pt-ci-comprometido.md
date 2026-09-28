# Avaliação: credenciais de deploy amplas no CI

## Contexto

O escopo do pentest incluía o pipeline de CI/CD. O avaliador analisou como o CI se autenticava no cluster e o que essas credenciais permitiam, partindo do princípio de que um runner de CI pode ser comprometido (dependência maliciosa, PR de terceiro).

## Sintomas

```text
# variável do projeto de CI (valor mascarado)
KUBE_TOKEN=<oculto>

$ kubectl auth can-i --list --token="$KUBE_TOKEN" 2>/dev/null | head -3
Resources   Non-Resource URLs   Resource Names   Verbs
*.*         []                  []               [*]
```

A credencial do CI tinha permissões de `*` em `*` — `cluster-admin` efetivo.

<!-- solucao -->

## Investigação

O pipeline usava um **token de ServiceAccount de longa duração** (Secret legado, sem expiração) vinculado a `cluster-admin`, guardado como variável no CI. O avaliador confirmou o escopo das permissões (via `can-i --list`) e **não** as exerceu contra produção. O risco: qualquer comprometimento do runner (ou vazamento da variável, ex.: em log com modo verboso) daria controle total do cluster, permanentemente.

## Causa raiz

Credencial **eterna** e **superprivilegiada** de deploy, armazenada fora do cluster. O modelo de ameaça de CI (código de terceiros roda no runner) torna isso especialmente perigoso.

## Correção

- Substituir por credenciais **curtas**: OIDC do provedor de CI federado com o cluster (ou com a nuvem), ou `kubectl create token deployer --duration=15m` por job.
- Reduzir o `deployer` aos namespaces e recursos que o deploy altera; nunca `cluster-admin`.
- Migrar para **GitOps** (o cluster puxa as mudanças; o CI não precisa de credencial de escrita no cluster).
- Mascarar segredos e proibir modo verbose com credenciais nos jobs.

## Prevenção

- Inventário e remoção de tokens legados.
- Alertas para uso de tokens de SA a partir de IPs fora dos runners conhecidos.
- Revisão periódica das permissões de automações.

Compare token legado e curto no simulador de tokens (módulo de Hardening) e a priorização no de relatório.
