# Uma aplicação invadida lendo Secrets do cluster todo

## Contexto

Uma vulnerabilidade de execução remota de código em uma biblioteca de upload de imagens foi explorada no serviço `galeria`. A equipe de segurança isolou o Pod, mas a análise dos logs de auditoria do API server assusta: o token da aplicação foi usado para **listar Secrets de todos os namespaces**, inclusive credenciais do banco de pagamentos.

## Sintomas

Logs de auditoria (resumidos):

```text
user=system:serviceaccount:midia:galeria verb=list resource=secrets namespace=pagamentos  code=200
user=system:serviceaccount:midia:galeria verb=list resource=secrets namespace=kube-system code=200
user=system:serviceaccount:midia:galeria verb=get  resource=secrets name=db-credentials   code=200
```

A aplicação `galeria` só precisa ler e gravar imagens num bucket. Ela nunca deveria falar com a API do Kubernetes.

<!-- solucao -->

## Investigação

O que a ServiceAccount pode fazer?

```text
$ kubectl auth can-i --list --as=system:serviceaccount:midia:galeria -n pagamentos
Resources   Non-Resource URLs   Resource Names   Verbs
secrets     []                  []               [get list watch]
...

$ kubectl get clusterrolebindings -o wide | grep galeria
galeria-reader   ClusterRole/galeria-reader   180d   midia/galeria
```

O Helm chart usado para instalar a aplicação tinha `rbac.create: true` por padrão e criava uma **ClusterRole** com leitura de Secrets (para uma funcionalidade opcional que ninguém usava), ligada por **ClusterRoleBinding**. Além disso, o token era montado automaticamente no Pod em `/var/run/secrets/kubernetes.io/serviceaccount/token`.

## Causa raiz

**Privilégio excessivo em uma identidade de máquina.** O invasor não precisou escalar nada: bastou ler o token montado no container e usar as permissões que a ServiceAccount já tinha — em todo o cluster, por causa do ClusterRoleBinding.

## Correção

Imediata:

```bash
kubectl delete clusterrolebinding galeria-reader
# Rotacione TODAS as credenciais expostas (banco, APIs, tokens de outras SAs lidos dos Secrets)
```

Definitiva, no chart / manifesto:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: galeria
  namespace: midia
automountServiceAccountToken: false   # a app não usa a API do Kubernetes
---
# rbac.create: false no values do chart
```

## Prevenção

- **Revise o RBAC criado por charts de terceiros** antes de instalar (`helm template … | grep -A20 'kind: ClusterRole'`).
- Prefira **Role + RoleBinding** a ClusterRoleBinding; conceda leitura de Secrets só com `resourceNames` específicos.
- `automountServiceAccountToken: false` para workloads que não usam a API.
- Mantenha a **auditoria do API server** ligada e alerte em `list secrets` fora do padrão.
- Ferramentas de postura (kube-bench, Kubescape, rbac-tool) apontam bindings perigosos.

Ler Secrets é um dos caminhos de escalonamento mais comuns: veja o aviso no laboratório de RBAC ao marcar `get secrets`.
