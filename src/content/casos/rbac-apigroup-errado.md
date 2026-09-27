# Pipeline proibido de atualizar Deployments

## Contexto

Para seguir o menor privilégio, a plataforma trocou a ServiceAccount do pipeline de CI — que era `cluster-admin` — por uma Role restrita ao namespace `prod`. No primeiro deploy depois da mudança, o pipeline falha.

## Sintomas

```text
Error from server (Forbidden): deployments.apps "vitrine" is forbidden:
User "system:serviceaccount:ci:deployer" cannot patch resource "deployments"
in API group "apps" in the namespace "prod"
```

A Role aplicada:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: prod
rules:
  - apiGroups: [""]
    resources: ["pods", "deployments"]
    verbs: ["get", "list", "watch", "patch", "update"]
```

O RoleBinding está correto e liga a Role à ServiceAccount `ci/deployer`.

<!-- solucao -->

## Investigação

A mensagem de erro do RBAC é precisa: ela informa **usuário**, **verbo**, **recurso**, **apiGroup** e **namespace**. Repare em `in API group "apps"`.

```text
$ kubectl auth can-i patch deployments -n prod --as=system:serviceaccount:ci:deployer
no
$ kubectl auth can-i list pods -n prod --as=system:serviceaccount:ci:deployer
yes

$ kubectl api-resources | grep -E '^(pods|deployments) '
pods          po       v1       true   Pod
deployments   deploy   apps/v1  true   Deployment
```

## Causa raiz

Pods estão no grupo **core** (`""`), mas Deployments estão no grupo **`apps`**. Uma regra com `apiGroups: [""]` e `resources: ["deployments"]` se refere a um recurso "deployments" do grupo core — que não existe. A regra é aceita pela API (não há validação disso) e simplesmente **não concede nada**.

## Correção

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "patch"]
```

Repare que o pipeline não precisava de `update` nem de `patch` em Pods: `kubectl set image` faz patch no Deployment, e `rollout status` só lê.

## Prevenção

- Consulte `kubectl api-resources` para saber o grupo de cada recurso (`batch` para Jobs, `networking.k8s.io` para Ingress e NetworkPolicy, `gateway.networking.k8s.io` para HTTPRoute…).
- Teste Roles no CI com `kubectl auth can-i --as=...` para cada ação esperada **e** para ações proibidas.
- Leia a mensagem de Forbidden inteira: ela já contém a resposta.

Reproduza no laboratório de RBAC: missão "Pipeline de CI", troque o apiGroup de deployments para "".
