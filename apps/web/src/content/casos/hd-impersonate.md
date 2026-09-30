# A ferramenta de suporte que podia ser qualquer um

## Contexto

Um portal interno de suporte permite que o time de atendimento veja o estado das aplicações dos clientes em clusters multi-tenant. Para "mostrar só o que o cliente vê", a ServiceAccount do portal recebeu permissão de `impersonate` — e, na pressa, em **users, groups e serviceaccounts sem restrição**. Um teste de segurança interno levantou a questão: e se o portal for comprometido?

## Sintomas

```text
$ kubectl get clusterrole support-portal -o yaml | grep -A4 rules
rules:
- apiGroups: [""]
  resources: ["users", "groups", "serviceaccounts"]
  verbs: ["impersonate"]

$ kubectl auth can-i '*' '*' --as=system:serviceaccount:suporte:portal --as-group=system:masters
yes
```

<!-- solucao -->

## Investigação

`impersonate` permite que a identidade aja **como outra**. Sem `resourceNames`, a ServiceAccount do portal podia assumir qualquer usuário ou grupo — inclusive `system:masters`, que ignora o RBAC. Uma vulnerabilidade no portal (ou o vazamento do token dele) equivaleria a cluster-admin em todos os clusters onde a ferramenta rodava.

O audit log mostrava apenas uso legítimo (impersonação dos grupos dos clientes), registrado nos campos `impersonatedUser` dos eventos.

## Causa raiz

Uma permissão de **escalada** (impersonate) concedida sem escopo. O requisito real — ler recursos no namespace do cliente — não precisava de impersonação de grupos arbitrários.

## Correção

- Restringir com `resourceNames` aos grupos específicos dos clientes (ex.: `tenant-a-viewers`) e **nunca** a grupos de sistema; ou, melhor:
- Eliminar a impersonação: o portal usa uma ServiceAccount por tenant, com Role somente leitura no namespace do tenant.
- Rotacionar o token do portal e revisar o audit log de impersonações.

## Prevenção

- Tratar `impersonate`, `escalate`, `bind`, `nodes/proxy` e webhooks como permissões de nível admin em revisões.
- Política de admission (ou revisão de PR) bloqueando ClusterRoles com esses verbos sem aprovação de segurança.
- Alertas para eventos de auditoria com `impersonatedUser` fora do padrão esperado.

Veja "impersonate users/groups" no simulador de risco de RBAC.
