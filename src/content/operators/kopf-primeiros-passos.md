# Primeiro operator com Kopf

## Instalação e execução

```bash
pip install kopf kubernetes
kubectl apply -f crd.yaml
kopf run operator.py --verbose --namespace=loja    # ou --all-namespaces (-A)
```

Em desenvolvimento, o Kopf roda **fora do cluster** usando seu kubeconfig — o ciclo editar/testar leva segundos. Em produção, roda num Deployment com ServiceAccount (lição de produção).

## Handlers de mudança

```python
import kopf
import kubernetes

@kopf.on.create('db.exemplo.com', 'v1', 'databases')
def criar(spec, name, namespace, body, logger, **_):
    deployment = montar_deployment(name, spec)
    kopf.adopt(deployment)              # ownerReference + namespace: o GC apaga junto com o CR
    kubernetes.client.AppsV1Api().create_namespaced_deployment(namespace, deployment)
    logger.info("Deployment %s criado", name)
    return {'deployment': name}         # vai para status.criar

@kopf.on.update('databases', field='spec.replicas')
def escalar(old, new, name, namespace, **_):
    kubernetes.client.AppsV1Api().patch_namespaced_deployment_scale(
        name, namespace, {'spec': {'replicas': new}})

@kopf.on.delete('databases')
def apagar(name, logger, **_):
    remover_backups_externos(name)      # o que o GC não sabe limpar
    logger.info("Backups de %s removidos", name)

@kopf.on.resume('databases')
def retomar(name, memo, **_):
    memo.conexao = conectar(name)       # reconstrói estado em memória após reinício
```

A string de recurso aceita várias formas: `'databases'`, `'databases.db.exemplo.com'` ou `('db.exemplo.com', 'v1', 'databases')`.

| Decorador | Dispara quando |
| --- | --- |
| `@kopf.on.create` | O objeto aparece pela primeira vez para o operador |
| `@kopf.on.update` | A "essência" muda: spec, labels, anotações (não o status) |
| `@kopf.on.update(field=...)` / `@kopf.on.field` | Um campo específico muda |
| `@kopf.on.delete` | O objeto é marcado para remoção (o Kopf põe um finalizer para garantir a chamada) |
| `@kopf.on.resume` | O operador (re)inicia e encontra objetos já existentes |
| `@kopf.on.event` | Qualquer evento do watch, sem estado nem retentativas |

## Argumentos dos handlers

O Kopf injeta argumentos por nome; declare só os que usar e termine com `**_` (ou `**kwargs`) para ignorar o resto:

- `body`, `spec`, `meta`, `status`, `name`, `namespace`, `uid`, `labels`, `annotations`
- `old`, `new`, `diff` — em handlers de mudança
- `logger` — logs com contexto do objeto (e, por padrão, também postados como eventos do Kubernetes)
- `patch` — alterações a aplicar no objeto depois do handler
- `retry`, `started`, `runtime` — controle de retentativas
- `memo` — armazenamento em memória por objeto

## Como o Kopf sabe o que mudou

O Kopf guarda a última configuração tratada na anotação `kopf.zalando.org/last-handled-configuration`. A cada evento, compara a essência atual com ela e calcula o `diff`. Por isso:

- Se o operador estava parado e a spec mudou, ao voltar ele ainda chama `on.update`.
- Se nada mudou, um reinício chama só `on.resume`.
- O progresso de handlers em andamento fica em anotações `kopf.zalando.org/<handler>` — um reinício no meio continua de onde parou.

## Filtros

```python
@kopf.on.create('databases', labels={'tier': 'prod'})
@kopf.on.update('databases', annotations={'db.exemplo.com/managed': kopf.PRESENT})
@kopf.on.update('databases', when=lambda spec, **_: spec.get('engine') == 'postgres')
```

## Eventos e logs

```python
kopf.info(body, reason='Provisioned', message='Banco criado em 42s')
kopf.warn(body, reason='SlowBackup', message='Backup levou 2h')
```

Aparecem em `kubectl describe database pedidos`, junto com os logs de nível alto postados automaticamente.

## Configuração na inicialização

```python
@kopf.on.startup()
def configurar(settings: kopf.OperatorSettings, **_):
    settings.posting.level = logging.WARNING           # só avisos viram eventos
    settings.persistence.finalizer = 'db.exemplo.com/finalizer'
    settings.watching.server_timeout = 300
```

No simulador, registre handlers diferentes e veja quais disparam em cada situação — inclusive o reinício do operador e mudanças só no status.
