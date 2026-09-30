# O operador em produção que não faz nada

## Contexto

O operador de bancos funcionava perfeitamente na máquina do desenvolvedor (rodando com o kubeconfig de admin). Instalado no cluster de homologação, o Pod ficou `Running`, sem reinícios — mas nenhum `Database` novo ganhou Deployment, e os antigos não reagem a mudanças.

## Sintomas

```text
$ kubectl get pods -n db-system
NAME                          READY   STATUS    RESTARTS   AGE
db-operator-6d8f7c9b5-kq2vp   1/1     Running   0          2h

$ kubectl get database teste -n loja -o yaml | grep -A3 annotations
  annotations: {}               ← nenhuma anotação kopf.zalando.org/*

$ kubectl describe database teste -n loja | tail -2
Events:  <none>
```

<!-- solucao -->

## Investigação

```text
$ kubectl logs deploy/db-operator -n db-system | grep -i forbidden | head -3
[ERROR] kopf._core.reactor.observation: … namespaces is forbidden: User "system:serviceaccount:db-system:db-operator"
cannot list resource "namespaces" in API group "" at the cluster scope
[ERROR] … databases.db.exemplo.com is forbidden: User "system:serviceaccount:db-system:db-operator"
cannot patch resource "databases" in API group "db.exemplo.com" in the namespace "loja"

$ kubectl auth can-i --as=system:serviceaccount:db-system:db-operator patch databases -n loja
no
```

O Deployment roda `kopf run -A`, mas o chart criava só uma `Role` em `db-system` com `get, list, watch` em `databases`.

## Causa raiz

Dois problemas de RBAC:

1. Em modo `--all-namespaces`, o Kopf precisa de `list/watch` em `namespaces` e permissões **de cluster** (ClusterRole) para o recurso.
2. Sem `patch` em `databases`, o Kopf não consegue gravar o finalizer nem as anotações de progresso — então não avança para os handlers.

Localmente tudo funcionava porque o kubeconfig de admin tinha todas as permissões.

## Correção

ClusterRole com o mínimo do framework e da lógica (namespaces, CRDs, peering, events, `databases` com `list/watch/patch`, `databases/status` com `patch`, e os tipos filhos), mais o `ClusterRoleBinding` para a ServiceAccount. Validar:

```bash
for v in list watch patch; do
  kubectl auth can-i --as=system:serviceaccount:db-system:db-operator $v databases -A
done
```

## Prevenção

- Desenvolver localmente **com a ServiceAccount do operador** (kubeconfig gerado a partir de um token dela), não com admin.
- Teste de integração no CI instalando o chart num cluster kind, com RBAC real.
- Alerta para logs `forbidden` do operador e para Pods de operador sem atividade.

Explore as combinações no simulador "Operator em produção".
