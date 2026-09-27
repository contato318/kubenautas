# Finalizers, ownerReferences e garbage collection

Criar é a parte fácil. Um operador confiável também **remove** tudo o que criou — dentro do cluster e fora dele — sem deixar lixo e sem travar remoções.

## Como a remoção funciona

1. `kubectl delete database pedidos` → o API server grava `metadata.deletionTimestamp`.
2. Se `metadata.finalizers` estiver **vazio**, o objeto é removido do etcd na hora.
3. Se houver finalizers, o objeto fica em `Terminating` até que cada controller responsável remova o seu.
4. Removido o objeto, o **garbage collector** trata os dependentes (objetos com `ownerReferences` apontando para ele).

Um finalizer é só uma string numa lista. Não executa nada: é uma **promessa** de que algum controller vai fazer uma limpeza e depois tirar a string.

## Finalizers no Kopf

Basta registrar um `on.delete`:

```python
@kopf.on.delete('databases')
def apagar(name, spec, logger, **_):
    nuvem.remover_backups(name)
    nuvem.remover_usuario(name)
```

O Kopf adiciona o finalizer `kopf.zalando.org/KopfFinalizerMarker` ao ver o objeto, chama o handler quando surge o `deletionTimestamp` e remove o finalizer quando o handler termina com sucesso. Se o handler falhar, ele tenta de novo — e o objeto continua `Terminating`.

Com `@kopf.on.delete(..., optional=True)` o Kopf **não** adiciona finalizer: o handler roda se o operador estiver vivo no momento, mas nada garante a chamada.

### O risco: finalizer sem dono

Se o operador for desinstalado (ou ficar quebrado) antes dos objetos, eles ficam `Terminating` para sempre — e o namespace que os contém também. Ordem correta para desinstalar:

1. Apague os Custom Resources e espere sumirem.
2. Remova o operador.
3. Remova o CRD.

Remover um finalizer à mão (`kubectl patch … -p '{"metadata":{"finalizers":null}}'`) desbloqueia, mas pula a limpeza: faça isso só sabendo o que ficará órfão.

## ownerReferences: deixe o Kubernetes limpar por você

Para objetos **dentro do cluster** criados pelo operador, não escreva código de remoção: declare o dono.

```python
@kopf.on.create('databases')
def criar(name, namespace, spec, **_):
    svc = {'apiVersion': 'v1', 'kind': 'Service', 'metadata': {'name': name}, 'spec': {...}}
    kopf.adopt(svc)          # ownerReferences → Database pedidos, namespace e nome ajustados
    kubernetes.client.CoreV1Api().create_namespaced_service(namespace, svc)
```

O objeto filho recebe:

```yaml
metadata:
  ownerReferences:
    - apiVersion: db.exemplo.com/v1
      kind: Database
      name: pedidos
      uid: 6f1c…              # o uid garante que é ESTE objeto, não outro com o mesmo nome
      controller: true
      blockOwnerDeletion: true
```

Regras: dono e filho no **mesmo namespace** (ou dono cluster-scoped); o filho namespaced não pode ter dono em outro namespace.

## Políticas de propagação

| `--cascade` / `propagationPolicy` | Comportamento |
| --- | --- |
| `background` (padrão) | O dono some na hora; o GC apaga os filhos em seguida |
| `foreground` | O dono fica `Terminating` com o finalizer `foregroundDeletion` até os filhos (com `blockOwnerDeletion`) sumirem |
| `orphan` | O dono some; os filhos perdem a ownerReference e continuam vivos |

`orphan` é útil para migrar recursos entre donos (ex.: trocar um Deployment sem derrubar os Pods).

## O que cada mecanismo limpa

| Recurso | Quem limpa |
| --- | --- |
| Deployment, Service, Secret criados pelo operador | GC, via `ownerReferences` (`kopf.adopt`) |
| Bucket, DNS, usuário de banco, conta na nuvem | Só o `on.delete` (finalizer) |
| Objetos em **outro** namespace ou cluster-scoped criados por um CR namespaced | O `on.delete` (ownerReference não serve) |

## Reagindo aos filhos

Para que o operador perceba quando alguém apaga ou muda um filho, observe o tipo filho e filtre pelos seus:

```python
@kopf.on.event('apps', 'v1', 'deployments', labels={'app.kubernetes.io/managed-by': 'db-operator'})
def filho_mudou(type, name, namespace, **_):
    ...   # dispare a reconciliação do dono (ex.: via índice ou anotação no CR)
```

No simulador, apague o CR com e sem `on.delete`, com o operador parado, com e sem `kopf.adopt()` e com cada política de `--cascade`, e veja o que sobra.
