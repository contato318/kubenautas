# Handler preso em 409 AlreadyExists

## Contexto

O operador de filas cria, para cada `Queue`, um tópico no broker e um usuário com permissão no tópico. Numa madrugada de instabilidade do broker, várias filas novas ficaram sem `Ready` — e continuam assim horas depois, com o broker já estável.

## Sintomas

```text
$ kubectl get queues -n loja
NAME        READY   AGE
pagamentos          6h

$ kubectl logs deploy/queue-operator -n filas | grep pagamentos | tail -3
[ERROR] [loja/pagamentos] Handler 'criar' failed with an exception. Will retry.
ApiException: (409) Conflict: topic "loja.pagamentos" already exists
[ERROR] [loja/pagamentos] Handler 'criar' failed with an exception. Will retry.
```

<!-- solucao -->

## Investigação

```python
@kopf.on.create('queues')
def criar(name, namespace, **_):
    broker.create_topic(f"{namespace}.{name}")          # 1
    broker.create_user(f"{namespace}-{name}")           # 2 ← falhou na madrugada (timeout)
    broker.grant(f"{namespace}-{name}", f"{namespace}.{name}")
    return {'topic': f"{namespace}.{name}"}
```

A primeira tentativa criou o tópico e falhou no passo 2. Todas as tentativas seguintes falham já no passo 1.

## Causa raiz

Retentativas executam o handler **inteiro** de novo. O handler não é idempotente: o passo 1 assume que o tópico não existe. Depois de uma falha parcial, cada nova tentativa esbarra no efeito colateral da anterior — e, sem `retries` definido, o Kopf tenta para sempre.

## Correção

Tornar cada passo idempotente (ou separá-los em subhandlers com progresso próprio):

```python
@kopf.on.create('queues')
def criar(name, namespace, **_):
    for etapa in ('topico', 'usuario', 'permissao'):
        @kopf.subhandler(id=etapa)
        def _passo(etapa=etapa, **_):
            executar(etapa, namespace, name)     # cada executar() usa get-or-create

def criar_topico(nome):
    try:
        broker.create_topic(nome)
    except Conflict:
        pass    # já existe: é nosso (nome determinístico) → sucesso
```

## Prevenção

- Todo handler deve suportar rodar N vezes, inclusive depois de uma falha no meio.
- Teste que injeta falha em cada passo e verifica que a retentativa converge.
- `retries`/`timeout` com alerta quando um objeto excede o limite, em vez de laços silenciosos.
- Condição `Ready=False` com `reason` e `message` do erro, visível em `kubectl get`.

No simulador de retentativas, ligue "A 1ª tentativa cria o bucket externo e só depois falha" e alterne a idempotência.
