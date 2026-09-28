# O token do CI que nunca expira

## Contexto

O pipeline de deploy autenticava no cluster com um Secret legado do tipo `kubernetes.io/service-account-token`, criado três anos atrás e copiado para as variáveis do CI. A ServiceAccount `deployer` tinha um ClusterRoleBinding para `cluster-admin` "para não dar erro de permissão". Um desenvolvedor, depurando uma falha, ativou modo verboso no job — e os logs públicos do projeto de código aberto passaram a exibir o token.

## Sintomas

Um scanner de segredos do provedor de CI abriu um alerta:

```text
Possible Kubernetes service account token exposed in job log: deploy #4812 (public)
```

```text
$ kubectl get secret deployer-token -n ci -o jsonpath='{.metadata.creationTimestamp} {.type}'
2023-05-02T10:14:22Z kubernetes.io/service-account-token
```

<!-- solucao -->

## Investigação

- Token **legado**: sem expiração, não vinculado a nenhum Pod. Válido até o Secret ser apagado.
- Permissão **cluster-admin**: quem tivesse o token controlaria o cluster inteiro.
- Audit log filtrado pelo usuário `system:serviceaccount:ci:deployer`: além dos IPs dos runners do CI, nenhuma origem desconhecida no período — a exposição foi detectada a tempo.

## Causa raiz

Uma credencial **eterna** e **superprivilegiada** guardada fora do cluster. O vazamento em log foi só o gatilho; qualquer vazamento (runner comprometido, variável exposta) teria o mesmo efeito.

## Correção

1. **Revogar imediatamente**: apagar o Secret `deployer-token` (o token deixa de valer na hora).
2. Revisar o audit log de todo o período de validade do token.
3. Substituir por credenciais de curta duração: OIDC do provedor de CI federado com o cluster (ou com a nuvem), ou `kubectl create token deployer --duration=15m` gerado por um passo confiável.
4. Reduzir a permissão do `deployer` aos namespaces e recursos que o deploy realmente altera (e, idealmente, migrar para GitOps: o cluster puxa as mudanças).

## Prevenção

- Inventário e remoção de tokens legados (`kubectl get secrets -A --field-selector type=kubernetes.io/service-account-token`).
- Nada de `cluster-admin` para automações.
- Mascaramento de segredos e proibição de modo verboso com credenciais nos jobs.
- Alertas para uso de tokens de ServiceAccount a partir de IPs fora dos runners conhecidos.

Compare token legado e projetado no simulador de tokens.
