# Avaliação: de dev a cluster-admin

## Contexto

O cliente forneceu ao avaliador um kubeconfig de **desenvolvedor** com acesso ao namespace `loja`, pedindo para medir se esse acesso poderia escalar para o controle do cluster.

## Sintomas

```text
$ kubectl auth can-i --list -n loja | grep -Ei "bind|escalate|impersonate|pods/exec"
rolebindings.rbac.authorization.k8s.io  []  []  [create]
clusterroles.rbac.authorization.k8s.io  []  []  [bind]
```

O usuário dev tinha `bind` em ClusterRoles e podia criar RoleBindings.

<!-- solucao -->

## Investigação

O verbo `bind` é uma "chave-mestra": normalmente o API server impede vincular um papel com mais permissões do que você tem, **exceto** se você tiver `bind`. O avaliador **demonstrou a possibilidade** sem exercê-la em produção — validou num namespace de teste que um RoleBinding para a ClusterRole `admin` seria aceito, documentou e reverteu imediatamente.

A cadeia comprovada:

1. Usuário dev tem `bind`.
2. Cria um RoleBinding vinculando a ClusterRole `admin` (ou `cluster-admin`) a si mesmo.
3. Passa a ter controle total do namespace (ou do cluster, com ClusterRoleBinding).

## Causa raiz

Concessão do verbo `bind` (e `create` em rolebindings) a um perfil de desenvolvedor. Poucos percebem que `bind`/`escalate` transformam um acesso limitado em administrativo.

## Correção

- Remover `bind` e `escalate` do perfil de dev; esses verbos ficam apenas para automações de plataforma revisadas.
- Perfis de dev com acesso **somente leitura** em produção; mudanças via GitOps.
- Revisar todos os papéis que concedem verbos de escalada.

## Prevenção

- Auditoria de RBAC procurando `bind`, `escalate`, `impersonate`, `nodes/proxy` e patch em webhooks.
- Alertas de auditoria para criação de RoleBindings/ClusterRoleBindings.
- Reteste após a correção para confirmar que o caminho foi fechado.

No simulador de caminho de escalada, veja como `bind`/`escalate` levam a cluster-admin e como o menor privilégio rompe o caminho.
