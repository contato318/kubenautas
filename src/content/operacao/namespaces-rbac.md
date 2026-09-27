# Namespaces e RBAC

## Namespaces

Namespaces particionam **logicamente** um cluster: por time, ambiente ou aplicação.

```
kubectl get namespaces
kubectl create namespace loja
kubectl get pods -n loja
kubectl config set-context --current --namespace=loja   # muda o padrão
```

Namespaces que já vêm no cluster: `default`, `kube-system` (componentes do sistema), `kube-public`, `kube-node-lease`.

- Nomes precisam ser únicos **dentro** do namespace, não no cluster.
- Alguns recursos **não** têm namespace: Nodes, PersistentVolumes, StorageClasses, Namespaces, ClusterRoles (`kubectl api-resources --namespaced=false`).
- Namespace **não é isolamento de rede** por si só — combine com **NetworkPolicy**, **ResourceQuota** e **RBAC**.

## Autenticação x autorização

1. **Autenticação** — *quem é você?* Certificados, tokens OIDC (Google, Azure AD, Okta), tokens de ServiceAccount. O Kubernetes **não tem objeto "User"**: usuários vêm de fora.
2. **Autorização** — *o que você pode fazer?* → **RBAC**.
3. **Admission control** — *isso é permitido/precisa ser modificado?* → webhooks, Pod Security Admission, Kyverno, OPA Gatekeeper.

## RBAC em quatro objetos

| Objeto | Escopo | Função |
|--------|--------|--------|
| `Role` | Namespace | Lista de permissões |
| `ClusterRole` | Cluster | Lista de permissões (ou reutilizável em namespaces) |
| `RoleBinding` | Namespace | Liga Role/ClusterRole a sujeitos **naquele namespace** |
| `ClusterRoleBinding` | Cluster | Liga ClusterRole a sujeitos **no cluster todo** |

Uma permissão = **verbos** × **recursos** × **apiGroups**:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: leitor-pods
  namespace: loja
rules:
  - apiGroups: [""]              # "" = core (pods, services, configmaps…)
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ana-le-pods
  namespace: loja
subjects:
  - kind: User
    name: ana@empresa.com
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: ci-bot
    namespace: loja
roleRef:
  kind: Role
  name: leitor-pods
  apiGroup: rbac.authorization.k8s.io
```

RBAC é **somente permissivo**: não existe regra de "negar". Tudo que não foi concedido é proibido.

Testando:

```
kubectl auth can-i delete pods -n loja
kubectl auth can-i list secrets --as=system:serviceaccount:loja:ci-bot -n loja
```

## ServiceAccounts

Identidade para **processos** rodando em Pods. Cada namespace tem uma `default`. O token é montado automaticamente em `/var/run/secrets/kubernetes.io/serviceaccount/` (tokens de curta duração, projetados).

Boas práticas:
- Uma ServiceAccount por aplicação, com o **mínimo** de permissões.
- `automountServiceAccountToken: false` em Pods que não falam com a API.
- Na nuvem, use **Workload Identity / IRSA / Pod Identity** para ligar a ServiceAccount a uma role IAM, sem chaves estáticas.

## Pod Security

O **Pod Security Admission** aplica os **Pod Security Standards** por namespace via labels:

```
kubectl label ns loja pod-security.kubernetes.io/enforce=restricted
```

Níveis: `privileged` (sem restrição), `baseline` (bloqueia escalonamentos óbvios), `restricted` (hardening completo). Um `securityContext` compatível com `restricted`:

```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
```
