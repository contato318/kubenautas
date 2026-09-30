# RBAC: menor privilégio e caminhos de escalada

RBAC é aditivo: não existe "negar", só permitir. Todo binding amplo é permanente até alguém removê-lo. O objetivo é que cada identidade — pessoa, pipeline ou ServiceAccount — tenha **apenas** o necessário, no **escopo** necessário.

## Princípios

1. **Role + RoleBinding** (namespace) por padrão; ClusterRole + ClusterRoleBinding só quando o recurso é de cluster ou o acesso precisa mesmo ser global.
2. Uma ClusterRole pode ser reutilizada em vários namespaces com **RoleBindings** — o acesso fica restrito ao namespace do binding.
3. Nada de curingas (`*`) em verbs, resources ou apiGroups: eles incluem recursos que ainda nem existem (CRDs futuros).
4. `resourceNames` para restringir a objetos específicos (ex.: um Secret).
5. Grupos do provedor de identidade em vez de usuários individuais nos bindings.
6. **cluster-admin** para ninguém no dia a dia; acesso elevado temporário e auditado (break-glass).

## Permissões que parecem inofensivas — e não são

| Permissão | Por que é perigosa |
| --- | --- |
| `list`/`watch` em `secrets` | Devolve o **conteúdo** de todos os Secrets, não só os nomes |
| `create` em `pods` (ou Deployments, Jobs, CronJobs, DaemonSets…) | O Pod pode montar qualquer Secret e usar **qualquer ServiceAccount** do namespace; sem Pod Security, pode ser privilegiado e tomar o nó |
| `create` em `pods/exec`, `pods/attach` | Shell em Pods de terceiros, com seus tokens e Secrets |
| `create` em `serviceaccounts/token` | Emite tokens para qualquer ServiceAccount do namespace |
| `escalate`, `bind` em roles/clusterroles | Criar ou vincular papéis com permissões que você não tem |
| `impersonate` em users/groups/serviceaccounts | Agir como outra identidade (inclusive `system:masters`) |
| `get`/`create` em `nodes/proxy` | Acesso direto à API do kubelet (exec em qualquer Pod do nó) |
| `patch` em webhooks de admission | Um webhook mutante malicioso altera todo Pod criado |
| `update` em `certificatesigningrequests/approval` (+ signer) | Emitir certificados para identidades privilegiadas |
| `patch` em `nodes` | Mudar labels/taints para atrair workloads sensíveis |

O próprio API server tem uma proteção: você **não pode** criar um Role com permissões que não tem, nem vinculá-lo — **a menos que** tenha `escalate`/`bind`. Por isso esses verbos equivalem a admin.

## Auditando permissões

```bash
kubectl auth can-i --list --as=system:serviceaccount:loja:api -n loja
kubectl auth can-i create pods --as=maria@empresa.com -n loja
kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name + " → " + ([.subjects[]?.name] | join(", "))'
kubectl who-can get secrets -n loja        # plugin kubectl-who-can
```

Ferramentas: **rbac-tool** (visualiza e gera policies mínimas), **KubiScan** e **kubescape** (encontram permissões arriscadas), **rakkess** (matriz de acesso).

## Padrões recomendados

### Times de aplicação

```yaml
kind: Role
metadata: { name: dev, namespace: loja }
rules:
  - apiGroups: ["", apps, batch]
    resources: [pods, pods/log, deployments, replicasets, jobs, services, configmaps, events]
    verbs: [get, list, watch]
  - apiGroups: [""]
    resources: [pods/portforward]
    verbs: [create]
```

Mudanças em produção via **GitOps** (o controller aplica), e não com `kubectl` pessoal.

### ServiceAccounts de aplicações

A maioria das aplicações **não precisa** falar com a API do Kubernetes: não crie bindings para elas e desligue o token (próxima lição). Quando precisa, restrinja com `resourceNames`:

```yaml
rules:
  - apiGroups: [""]
    resources: [configmaps]
    resourceNames: [feature-flags]
    verbs: [get, watch]
```

### Controllers e operadores de terceiros

Revise o RBAC dos charts antes de instalar: operadores costumam pedir ClusterRoles amplas. Prefira modos "namespaced" quando disponíveis e isole-os em namespaces próprios.

## Bindings padrão para revisar

- `system:anonymous` / `system:unauthenticated` com qualquer binding além da descoberta.
- `system:authenticated` recebendo papéis amplos (qualquer identidade válida, inclusive de outras contas na nuvem em alguns provedores).
- A ServiceAccount `default` com bindings.
- Bindings a usuários que saíram da empresa.

No simulador, conceda permissões ao time de devs e veja quais delas levam, direta ou indiretamente, a cluster-admin.
