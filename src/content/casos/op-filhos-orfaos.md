# Deployments fantasmas depois de apagar os CRs

## Contexto

Os ambientes de preview de cada Pull Request são criados por um operador: um objeto `Preview` gera Deployment, Service, Ingress e um Secret. Ao fechar o PR, o pipeline apaga o `Preview`. Três meses depois, o cluster de preview está sem capacidade, com centenas de Pods — e só 12 PRs abertos.

## Sintomas

```text
$ kubectl get previews -A --no-headers | wc -l
12

$ kubectl get deployments -A -l app.kubernetes.io/managed-by=preview-operator --no-headers | wc -l
341

$ kubectl get deployment pr-1873 -n previews -o jsonpath='{.metadata.ownerReferences}'
(vazio)
```

<!-- solucao -->

## Investigação

```python
@kopf.on.create('previews')
def criar(name, namespace, spec, **_):
    dep = montar_deployment(name, spec)
    apps.create_namespaced_deployment(namespace, dep)      # sem kopf.adopt()
    ...

@kopf.on.delete('previews', optional=True)
def apagar(name, namespace, **_):
    apps.delete_namespaced_deployment(name, namespace)
```

O `on.delete` é opcional (sem finalizer) e só apaga o Deployment — não o Service, o Ingress nem o Secret. Quando o operador estava fora do ar (deploys, crashes), nem isso acontecia.

## Causa raiz

Os filhos foram criados **sem ownerReferences**. Para o garbage collector, eles não pertencem a ninguém — apagar o `Preview` não tem efeito sobre eles. A limpeza dependia de código no `on.delete`, incompleto e sem garantia de execução (`optional=True`).

## Correção

- Adotar todos os filhos na criação: `kopf.adopt(dep)`, `kopf.adopt(svc)`… — o GC passa a apagá-los em cascata com o `Preview`.
- Remover o `on.delete` (desnecessário para objetos do cluster).
- Limpar os órfãos existentes pelo label `managed-by`, comparando com os `Preview` vivos.

## Prevenção

- Regra: todo objeto criado pelo operador dentro do cluster tem ownerReference para o CR.
- Label `app.kubernetes.io/managed-by` e um label com o nome do dono em todos os filhos, para auditoria.
- Teste de integração: criar e apagar um CR e verificar que nada sobra.
- `on.delete` só para recursos externos ao cluster — e, nesse caso, com finalizer.

No simulador de finalizers, desligue "Filhos criados com kopf.adopt()" e apague o CR.
