# O operador que conversa sozinho

## Contexto

Depois de uma versão nova do operador de filas, o time de plataforma recebeu alerta de latência alta no API server. O audit log mostrou milhares de requisições `PATCH` por minuto vindas da ServiceAccount do operador — com apenas 40 objetos `Queue` no cluster.

## Sintomas

```text
$ kubectl logs deploy/queue-operator -n filas --tail=6
[10:02:11,120] kopf.objects [INFO] [loja/pedidos] Handler 'sincronizar' succeeded.
[10:02:11,390] kopf.objects [INFO] [loja/pedidos] Handler 'sincronizar' succeeded.
[10:02:11,655] kopf.objects [INFO] [loja/pedidos] Handler 'sincronizar' succeeded.
[10:02:11,902] kopf.objects [INFO] [loja/pedidos] Handler 'sincronizar' succeeded.

$ kubectl get queue pedidos -n loja -o jsonpath='{.metadata.annotations.filas\.exemplo\.com/last-sync}'
2026-09-27T10:02:11.902Z      ← muda várias vezes por segundo
```

<!-- solucao -->

## Investigação

O handler novo:

```python
@kopf.on.create('queues')
@kopf.on.update('queues')
def sincronizar(name, patch, **_):
    broker.aplicar(name)
    patch.metadata.annotations['filas.exemplo.com/last-sync'] = agora()
```

## Causa raiz

Para o Kopf, **anotações fazem parte da essência** do objeto (junto com spec e labels). O handler de update grava uma anotação com a hora atual → o objeto muda → o Kopf detecta diferença contra `last-handled-configuration` → chama `on.update` de novo → nova anotação… Um loop infinito, com uma chamada ao broker a cada volta.

## Correção

Grave informações de observação no **status**, que não faz parte da essência e não dispara handlers de mudança:

```python
    patch.status['lastSync'] = agora()
```

Para sincronização periódica (detectar drift no broker), use um timer em vez de depender de updates:

```python
@kopf.timer('queues', interval=300, idle=60)
def verificar(name, patch, **_):
    broker.aplicar(name)
    patch.status['lastSync'] = agora()
```

## Prevenção

- Regra de revisão: handlers de mudança não escrevem na spec, em labels nem em anotações do próprio objeto (a não ser uma única vez, de forma idempotente).
- Métrica de reconciliações por objeto por minuto, com alerta.
- Teste de integração que conta quantas vezes o handler roda após um único `apply`.

No simulador de handlers do Kopf, compare "Adicionar um label" com "Alguém muda só o status".
