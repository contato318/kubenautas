# O status que não muda nunca

## Contexto

Um time escreveu seu primeiro operator com Kopf. Tudo funciona — Deployments são criados, escalam, somem com o CR —, mas a coluna `PHASE` fica vazia para sempre. O desenvolvedor jura que o código grava o status.

## Sintomas

```python
@kopf.on.create('caches')
def criar(name, namespace, **_):
    criar_deployment(name, namespace)
    api = kubernetes.client.CustomObjectsApi()
    api.patch_namespaced_custom_object(
        'cache.exemplo.com', 'v1', namespace, 'caches', name,
        {'status': {'phase': 'Ready'}})
```

```text
$ kubectl get caches -n loja
NAME     PHASE   AGE
sessao           12m

$ kubectl get cache sessao -n loja -o jsonpath='{.status}'
{"criar":null}
```

Nenhum erro nos logs do operador: o PATCH retorna `200 OK`.

<!-- solucao -->

## Investigação

```text
$ kubectl get crd caches.cache.exemplo.com -o jsonpath='{.spec.versions[0].subresources}'
{"status":{}}
```

O CRD tem o **subrecurso status** habilitado. O código faz o PATCH no endpoint principal (`/caches/sessao`), não em `/caches/sessao/status`.

## Causa raiz

Com `subresources.status`, o API server **ignora** mudanças em `.status` enviadas ao endpoint principal — e responde `200 OK`, porque a requisição em si é válida. Só o endpoint `/status` altera o status. Por isso nada falhava e nada mudava.

(O `{"criar": null}` é o Kopf gravando o retorno do handler, que era `None`, em `status.criar` — pelo caminho certo.)

## Correção

A forma idiomática no Kopf: usar `patch` (ou o valor de retorno), que o Kopf aplica pelo caminho certo:

```python
@kopf.on.create('caches')
def criar(name, namespace, meta, patch, **_):
    criar_deployment(name, namespace)
    patch.status['phase'] = 'Ready'
    patch.status['observedGeneration'] = meta['generation']
```

Chamando a API diretamente, use o método de status: `patch_namespaced_custom_object_status(...)`.

## Prevenção

- Em testes de integração, verifique o status após cada handler (`kubectl wait --for=jsonpath='{.status.phase}'=Ready`).
- Dê à ServiceAccount permissão em `caches/status` — e não dê `update` em `caches` se não for necessário.
- Prefira condições (`status.conditions`) a um campo `phase` solto.

No simulador de status, clique em "PATCH do status sem /status" com e sem o subrecurso.
