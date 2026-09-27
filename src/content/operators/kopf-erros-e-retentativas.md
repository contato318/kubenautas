# Kopf: erros, retentativas, timers e daemons

Handlers falham: a API da nuvem está lenta, o banco ainda não subiu, a spec é inválida. O Kopf trata falhas de forma declarativa — você escolhe o tipo de erro e ele decide quando tentar de novo.

## Tipos de erro

```python
@kopf.on.create('databases', retries=5, backoff=30, timeout=600)
def criar(spec, name, retry, logger, **_):
    if spec['engine'] not in ('postgres', 'mysql'):
        raise kopf.PermanentError("engine não suportada")        # desiste: não adianta tentar

    if not nuvem.cota_disponivel():
        raise kopf.TemporaryError("sem cota, aguardando", delay=120)   # tenta de novo em 120 s

    bucket = storage.get_or_create(f"{name}-backup")               # idempotente
    logger.info("tentativa %d", retry)
    return {'bucket': bucket.id}
```

| O handler… | O Kopf… |
| --- | --- |
| retorna normalmente | marca como concluído (`Handler 'criar' succeeded.`) e não roda de novo |
| levanta `kopf.TemporaryError(delay=N)` | tenta de novo após N segundos |
| levanta qualquer outra exceção | trata como temporária: tenta de novo após `backoff` (60 s por padrão) |
| levanta `kopf.PermanentError` | marca como falho e **não** tenta mais para essa mudança |
| excede `retries=` ou `timeout=` | marca como falho |

O estado das tentativas (contagem, próximo horário) fica nas anotações de progresso do objeto — sobrevive a reinícios do operador. O argumento `retry` diz qual tentativa é (0 na primeira).

Sem `retries` nem `timeout`, uma exceção que nunca some faz o Kopf tentar **para sempre**, a cada backoff. Às vezes é o que você quer (esperar a cota voltar); outras, é um loop que lota logs e a API da nuvem.

## Idempotência: a regra de ouro

Uma tentativa pode falhar **depois** de ter feito efeitos colaterais. A próxima tentativa roda o handler inteiro de novo:

```python
# ❌ na 2ª tentativa: 409 AlreadyExists — para sempre
storage.create(f"{name}-backup")

# ✅ reconhece o que já existe
bucket = storage.get(f"{name}-backup") or storage.create(f"{name}-backup")
```

Técnicas: `get_or_create`, nomes determinísticos derivados do CR (nunca aleatórios), tratar `409 Conflict` como sucesso quando o recurso é seu, gravar IDs externos no status assim que criados.

## Subhandlers e progresso

Para processos em etapas, cada etapa pode ser um subhandler com progresso próprio:

```python
@kopf.on.create('databases')
def criar(spec, **_):
    for etapa in ['rede', 'volume', 'instancia', 'usuarios']:
        @kopf.subhandler(id=etapa)
        def _executar(etapa=etapa, **_):
            executar_etapa(etapa, spec)
```

Etapas concluídas não rodam de novo nas retentativas.

## Timers: reconciliação periódica

Handlers de mudança só rodam quando o objeto muda. Para detectar **drift** (alguém mexeu no recurso externo), use um timer:

```python
@kopf.timer('databases', interval=300, initial_delay=60, idle=30)
def verificar(spec, name, patch, **_):
    real = nuvem.descrever(name)
    if real.tamanho != spec['storageGB']:
        nuvem.redimensionar(name, spec['storageGB'])
    patch.status['lastCheck'] = agora()
```

- `interval` — de quantos em quantos segundos.
- `idle` — só roda se o objeto não mudou nos últimos N segundos (evita competir com handlers de mudança).
- `initial_delay` — espera após o operador iniciar.

⚠️ Um timer que escreve no **status** não dispara `on.update`; um que escreve em anotações ou na spec **dispara** — e pode virar um loop.

## Daemons: tarefas contínuas por objeto

```python
@kopf.daemon('databases', cancellation_timeout=10)
def monitorar(stopped, name, logger, **_):
    while not stopped:
        coletar_metricas(name)
        stopped.wait(30)
```

Um daemon roda enquanto o objeto existir (uma thread ou tarefa assíncrona por objeto). O Kopf sinaliza `stopped` quando o objeto é apagado ou o operador encerra — respeite-o para não travar a remoção.

## Handlers assíncronos

Com `async def`, os handlers rodam no event loop do Kopf e escalam melhor para muitos objetos. Nunca bloqueie o loop com chamadas síncronas lentas dentro de `async def` — use bibliotecas assíncronas ou `asyncio.to_thread`.

No simulador, combine resultados por tentativa, limite `retries` e ligue a opção "cria o bucket antes de falhar" para ver um handler não idempotente travar em `409 AlreadyExists`.
