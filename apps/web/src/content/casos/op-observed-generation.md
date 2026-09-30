# O pipeline disse "deploy concluído" — e não estava

## Contexto

O pipeline de uma aplicação altera a versão do schema no CR `Database` (que dispara migrações) e espera o banco ficar pronto antes de publicar a nova versão da API:

```bash
kubectl apply -f database.yaml
kubectl wait database/pedidos --for=condition=Ready --timeout=10m
kubectl apply -f api.yaml
```

Numa sexta, a API nova subiu com erros `column "desconto" does not exist`: a migração não tinha rodado — mas o `kubectl wait` retornou em menos de 1 segundo.

## Sintomas

```text
$ kubectl get database pedidos -o yaml
metadata:
  generation: 15
spec:
  schemaVersion: 42
status:
  conditions:
    - type: Ready
      status: "True"
      reason: Migrated
      message: "schema na versão 41"
```

<!-- solucao -->

## Investigação

O `Ready=True` era da execução **anterior** (versão 41). O operador leva alguns segundos para receber o evento e começar a nova migração; nesse intervalo, o `kubectl wait` viu a condição antiga, já verdadeira, e retornou imediatamente. Não havia como distinguir "pronto para a spec atual" de "pronto para a spec anterior": o operador não grava `observedGeneration`.

## Causa raiz

Condições sem `observedGeneration` são ambíguas. Todo consumidor que decide com base no status (pipelines, Argo CD, Flux, outros operadores) precisa saber **a qual geração da spec** aquele status se refere.

## Correção

No operador, gravar a geração processada (no status e em cada condição) e marcar o progresso logo no início:

```python
@kopf.on.update('databases', field='spec.schemaVersion')
def migrar(meta, spec, patch, **_):
    patch.status['observedGeneration'] = meta['generation']
    ...
```

Com o handler atualizando a condição para `Ready=False, reason=Migrating` no começo da migração e `observedGeneration` coerente, o pipeline passa a esperar pelas duas coisas:

```bash
kubectl wait database/pedidos --for=jsonpath='{.status.observedGeneration}'=$(kubectl get database pedidos -o jsonpath='{.metadata.generation}')
kubectl wait database/pedidos --for=condition=Ready
```

(Ferramentas baseadas em `kstatus` já fazem essa checagem automaticamente quando o campo existe.)

## Prevenção

- `observedGeneration` é obrigatório no status de qualquer operador que outros consumam.
- Condições atualizadas no **início** do trabalho (`Progressing`/`Ready=False`), não só no fim.
- Testes de contrato do status: após um `apply`, `observedGeneration` deve alcançar `generation`.

No simulador de status, desligue "Operador grava observedGeneration", edite a spec e veja o que o `kubectl wait` conclui.
